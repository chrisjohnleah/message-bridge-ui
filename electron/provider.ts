import type {
  BusinessProfile,
  Chat,
  ChatMessage,
  CustomerMemory,
  MemoryFact,
  ProviderConfig
} from "./types";

interface ProviderCall {
  provider: ProviderConfig;
  apiKey: string;
  prompt: string;
  instructions: string;
}

function compatibleEndpoint(base: string): string {
  const normalized = base.replace(/\/+$/, "");
  return normalized.endsWith("/v1")
    ? `${normalized}/chat/completions`
    : `${normalized}/v1/chat/completions`;
}

async function requestJson(url: string, init: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      const nested = payload.error as Record<string, unknown> | undefined;
      const message = nested?.message ?? payload.message ?? `Provider returned ${response.status}.`;
      throw new Error(String(message));
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function openAIOutput(payload: unknown): string {
  const value = payload as {
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string }> }>;
  };
  return value.output_text ??
    value.output?.flatMap((item) => item.content ?? []).map((item) => item.text ?? "").join("").trim() ??
    "";
}

function anthropicOutput(payload: unknown): string {
  const value = payload as { content?: Array<{ type?: string; text?: string }> };
  return value.content?.filter((item) => item.type === "text").map((item) => item.text ?? "").join("").trim() ?? "";
}

function geminiOutput(payload: unknown): string {
  const value = payload as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return value.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim() ?? "";
}

function compatibleOutput(payload: unknown): string {
  const value = payload as { choices?: Array<{ message?: { content?: string } }> };
  return value.choices?.[0]?.message?.content?.trim() ?? "";
}

export async function callProvider(call: ProviderCall): Promise<string> {
  const headers = { "Content-Type": "application/json" };
  let result = "";

  if (call.provider.id === "openai") {
    const payload = await requestJson("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { ...headers, Authorization: `Bearer ${call.apiKey}` },
      body: JSON.stringify({
        model: call.provider.model,
        instructions: call.instructions,
        input: call.prompt,
        max_output_tokens: 500,
        store: false
      })
    });
    result = openAIOutput(payload);
  } else if (call.provider.id === "anthropic") {
    const payload = await requestJson("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        ...headers,
        "x-api-key": call.apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: call.provider.model,
        system: call.instructions,
        messages: [{ role: "user", content: call.prompt }],
        max_tokens: 500
      })
    });
    result = anthropicOutput(payload);
  } else if (call.provider.id === "gemini") {
    const payload = await requestJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(call.provider.model)}:generateContent`,
      {
        method: "POST",
        headers: { ...headers, "x-goog-api-key": call.apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: call.instructions }] },
          contents: [{ role: "user", parts: [{ text: call.prompt }] }],
          generationConfig: { maxOutputTokens: 500 }
        })
      }
    );
    result = geminiOutput(payload);
  } else {
    const baseUrl = call.provider.baseUrl ?? "";
    const payload = await requestJson(compatibleEndpoint(baseUrl), {
      method: "POST",
      headers: { ...headers, Authorization: `Bearer ${call.apiKey}` },
      body: JSON.stringify({
        model: call.provider.model,
        messages: [
          { role: "system", content: call.instructions },
          { role: "user", content: call.prompt }
        ],
        max_tokens: 500
      })
    });
    result = compatibleOutput(payload);
  }

  if (!result) {
    throw new Error("The provider returned no text.");
  }
  return result;
}

export async function testProvider(provider: ProviderConfig, apiKey: string): Promise<void> {
  await callProvider({
    provider,
    apiKey,
    instructions: "Return only the word OK.",
    prompt: "Connection test."
  });
}

export function buildDraftPrompt(input: {
  business: BusinessProfile;
  chat: Chat;
  messages: ChatMessage[];
  facts: MemoryFact[];
  customer?: CustomerMemory;
}): { instructions: string; prompt: string } {
  const businessFacts = input.facts.map((fact) => `- ${fact.content}`).join("\n") || "- No additional facts yet.";
  const customerFacts = input.customer?.facts.map((fact) => `- ${fact}`).join("\n") || "- No saved customer facts.";
  const conversation = input.messages.slice(-30).map((message) => {
    const speaker = message.is_from_me ? input.business.name || "Business" : input.chat.name;
    return `${speaker}: ${message.content || `[${message.media_type || "attachment"}]`}`;
  }).join("\n");

  return {
    instructions: [
      `You draft customer-service replies for ${input.business.name || "a small business"}.`,
      `Write in this voice: ${input.business.tone || "friendly, concise and helpful"}.`,
      "Never invent availability, prices, delivery dates, policies or facts.",
      "If essential information is missing, ask one short clarifying question.",
      "Return only the proposed message. Do not include analysis, labels or quotation marks."
    ].join("\n"),
    prompt: [
      "BUSINESS KNOWLEDGE",
      businessFacts,
      "",
      "CUSTOMER CONTEXT",
      input.customer?.summary ? `Summary: ${input.customer.summary}` : "Summary: none saved",
      customerFacts,
      input.customer?.nextStep ? `Next step: ${input.customer.nextStep}` : "",
      "",
      "RECENT CONVERSATION",
      conversation || "No messages are available.",
      "",
      "Draft the next helpful reply."
    ].join("\n")
  };
}
