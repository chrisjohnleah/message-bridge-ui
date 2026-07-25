import type { MessageBridgeApi } from "./types";
import { createMockApi } from "./mock-api";

const unavailable = async (): Promise<never> => {
  throw new Error("The secure desktop bridge is unavailable. Close Message Bridge and open it again.");
};

const unavailableApi: MessageBridgeApi = {
  config: { get: unavailable, saveBusiness: unavailable, saveProvider: unavailable, complete: unavailable },
  bridge: {
    start: unavailable,
    restart: unavailable,
    status: unavailable,
    chats: unavailable,
    messages: unavailable,
    send: unavailable
  },
  accounts: {
    list: unavailable,
    add: unavailable,
    rename: unavailable,
    setMcpEnabled: unavailable,
    setMcpSendEnabled: unavailable
  },
  mcp: {
    setup: unavailable,
    copy: unavailable
  },
  assistant: { test: unavailable, draft: unavailable },
  memory: {
    get: unavailable,
    addFact: unavailable,
    updateControls: unavailable,
    reviewSuggestion: unavailable,
    saveCustomer: unavailable,
    export: unavailable,
    erase: unavailable
  }
};

export const api: MessageBridgeApi = window.messageBridge ??
  (import.meta.env.DEV ? createMockApi() : unavailableApi);
