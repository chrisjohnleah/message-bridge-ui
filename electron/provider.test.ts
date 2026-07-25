import { afterEach, describe, expect, it, vi } from "vitest";
import { buildDraftPrompt, callProvider } from "./provider";

afterEach(() => {
  vi.unstubAllGlobals();
});

function successfulResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

describe("buildDraftPrompt", () => {
  it("combines business, customer memory, and recent chat without authorizing automatic actions", () => {
    const result = buildDraftPrompt({
      business: {
        name: "Willow & Stitch",
        description: "Upholstery",
        tone: "Warm and concise",
        hours: "9–5"
      },
      chat: {
        jid: "123@s.whatsapp.net",
        name: "Maya",
        last_message_time: new Date().toISOString(),
        last_message: "Is oat available?",
        last_is_from_me: false
      },
      messages: [{
        id: "1",
        chat_jid: "123@s.whatsapp.net",
        sender: "123",
        content: "Is oat available?",
        timestamp: new Date().toISOString(),
        is_from_me: false,
        media_type: "",
        filename: ""
      }],
      facts: [{
        id: "fact",
        category: "products",
        content: "Oat linen is in stock.",
        createdAt: new Date().toISOString()
      }],
      customer: {
        jid: "123@s.whatsapp.net",
        summary: "Wedding customer",
        facts: ["Needs 18 pads"],
        nextStep: "Confirm colour",
        updatedAt: new Date().toISOString()
      }
    });

    expect(result.instructions).toContain("Never invent");
    expect(result.prompt).toContain("Oat linen is in stock.");
    expect(result.prompt).toContain("Needs 18 pads");
    expect(result.prompt).toContain("Maya: Is oat available?");
  });
});

describe("callProvider", () => {
  it.each([
    {
      id: "openai" as const,
      model: "gpt-test",
      url: "https://api.openai.com/v1/responses",
      payload: { output: [{ content: [{ text: "OpenAI reply" }] }] },
      expected: "OpenAI reply"
    },
    {
      id: "anthropic" as const,
      model: "claude-test",
      url: "https://api.anthropic.com/v1/messages",
      payload: { content: [{ type: "text", text: "Anthropic reply" }] },
      expected: "Anthropic reply"
    },
    {
      id: "gemini" as const,
      model: "gemini test/model",
      url: "https://generativelanguage.googleapis.com/v1beta/models/gemini%20test%2Fmodel:generateContent",
      payload: { candidates: [{ content: { parts: [{ text: "Gemini reply" }] } }] },
      expected: "Gemini reply"
    },
    {
      id: "openai-compatible" as const,
      model: "local-model",
      baseUrl: "http://127.0.0.1:11434/v1/",
      url: "http://127.0.0.1:11434/v1/chat/completions",
      payload: { choices: [{ message: { content: "Local reply" } }] },
      expected: "Local reply"
    }
  ])("calls the $id adapter and extracts its reply", async ({ id, model, baseUrl, url, payload, expected }) => {
    const fetchMock = vi.fn().mockResolvedValue(successfulResponse(payload));
    vi.stubGlobal("fetch", fetchMock);

    await expect(callProvider({
      provider: { id, model, baseUrl, hasApiKey: true },
      apiKey: "test-key",
      instructions: "Be concise.",
      prompt: "Hello"
    })).resolves.toBe(expected);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe(url);
  });

  it("shows the provider's useful error message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: { message: "That model is unavailable." } }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    )));

    await expect(callProvider({
      provider: { id: "openai", model: "missing", hasApiKey: true },
      apiKey: "test-key",
      instructions: "Test",
      prompt: "Test"
    })).rejects.toThrow("That model is unavailable.");
  });
});
