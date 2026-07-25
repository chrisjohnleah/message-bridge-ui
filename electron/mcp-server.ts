import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

interface RuntimeAccount {
  id: string;
  name: string;
  port: number;
  tokenPath: string;
  mcpEnabled: boolean;
  mcpSendEnabled: boolean;
}

interface RuntimeRegistry {
  version: number;
  accounts: RuntimeAccount[];
}

function userDataDirectory(): string {
  const value = process.env.MESSAGE_BRIDGE_USER_DATA?.trim();
  if (!value) {
    throw new Error("MESSAGE_BRIDGE_USER_DATA is missing. Copy the MCP configuration from Message Bridge → Connections.");
  }
  return value;
}

async function registry(): Promise<RuntimeRegistry> {
  try {
    const value = JSON.parse(
      await readFile(join(userDataDirectory(), "mcp-runtime.json"), "utf8")
    ) as RuntimeRegistry;
    if (!Array.isArray(value.accounts)) throw new Error("Invalid account registry.");
    return value;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error("Message Bridge is not running. Open it, then try again.");
    }
    throw error;
  }
}

async function enabledAccount(accountId: string): Promise<RuntimeAccount> {
  const value = await registry();
  const account = value.accounts.find((item) => item.id === accountId);
  if (!account) throw new Error(`Messaging account "${accountId}" is not available.`);
  if (!account.mcpEnabled) throw new Error(`${account.name} is not shared with local MCP clients.`);
  return account;
}

async function bridgeRequest<T>(
  account: RuntimeAccount,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const token = (await readFile(account.tokenPath, "utf8")).trim();
  const response = await fetch(`http://127.0.0.1:${account.port}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers
    }
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `${account.name} bridge request failed (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

function result(value: unknown) {
  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify(value, null, 2)
    }]
  };
}

const server = new McpServer({
  name: "message-bridge",
  version: "0.2.0"
});

server.registerTool(
  "list_whatsapp_accounts",
  {
    description: "List messaging accounts currently shared through the local Message Bridge app.",
    inputSchema: {}
  },
  async () => {
    const value = await registry();
    const accounts = await Promise.all(
      value.accounts.filter((account) => account.mcpEnabled).map(async (account) => {
      let connected = false;
      try {
        const health = await bridgeRequest<{ connected?: boolean }>(account, "/api/health");
        connected = Boolean(health.connected);
      } catch {
        connected = false;
      }
      return {
        id: account.id,
        name: account.name,
        available_to_mcp: account.mcpEnabled,
        connected
      };
      })
    );
    return result({ accounts });
  }
);

server.registerTool(
  "list_whatsapp_chats",
  {
    description: "List recent WhatsApp chats from one account, or from every account shared with MCP.",
    inputSchema: {
      account_id: z.string().optional(),
      limit: z.number().int().min(1).max(200).optional()
    }
  } as any,
  (async ({ account_id, limit = 50 }: { account_id?: string; limit?: number }) => {
    const value = await registry();
    const accounts = account_id
      ? [await enabledAccount(account_id)]
      : value.accounts.filter((account) => account.mcpEnabled);
    const settled = await Promise.allSettled(accounts.map(async (account) => {
      const payload = await bridgeRequest<{ chats: Array<Record<string, unknown>> }>(
        account,
        `/api/chats?limit=${limit}`
      );
      return payload.chats.map((chat) => ({
        ...chat,
        account_id: account.id,
        account_name: account.name
      }));
    }));
    const chats: Array<Record<string, unknown> & { account_id: string; account_name: string }> =
      settled.flatMap((item) => item.status === "fulfilled" ? item.value : []);
    chats.sort((left, right) =>
      Date.parse(String(right.last_message_time ?? "")) - Date.parse(String(left.last_message_time ?? ""))
    );
    return result({ chats: chats.slice(0, limit) });
  }) as any
);

server.registerTool(
  "get_whatsapp_messages",
  {
    description: "Read recent messages in a chat from a specific Message Bridge account.",
    inputSchema: {
      account_id: z.string(),
      chat_jid: z.string(),
      limit: z.number().int().min(1).max(200).optional()
    }
  } as any,
  (async ({ account_id, chat_jid, limit = 50 }: { account_id: string; chat_jid: string; limit?: number }) => {
    const account = await enabledAccount(account_id);
    const payload = await bridgeRequest<{ messages: Array<Record<string, unknown>> }>(
      account,
      `/api/messages?limit=${limit}&chat_jid=${encodeURIComponent(chat_jid)}`
    );
    return result({
      account_id: account.id,
      account_name: account.name,
      chat_jid,
      messages: payload.messages
    });
  }) as any
);

server.registerTool(
  "send_whatsapp_message",
  {
    description: "Send a message from one explicitly selected Message Bridge account. This performs a real external action and is disabled by default.",
    inputSchema: {
      account_id: z.string(),
      recipient: z.string(),
      message: z.string().min(1).max(10_000)
    }
  } as any,
  (async ({ account_id, recipient, message }: { account_id: string; recipient: string; message: string }) => {
    const account = await enabledAccount(account_id);
    if (!account.mcpSendEnabled) {
      throw new Error(`${account.name} is shared read-only. Enable MCP sending in Message Bridge first.`);
    }
    await bridgeRequest(account, "/api/send", {
      method: "POST",
      body: JSON.stringify({ recipient, message: message.trim() })
    });
    return result({
      sent: true,
      account_id: account.id,
      account_name: account.name,
      recipient
    });
  }) as any
);

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
