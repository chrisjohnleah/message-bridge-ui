import { contextBridge, ipcRenderer } from "electron";
import type {
  BusinessProfile,
  CustomerMemory,
  DraftRequest,
  MemoryControls,
  MemoryFact,
  ProviderInput
} from "./types";

contextBridge.exposeInMainWorld("messageBridge", {
  config: {
    get: () => ipcRenderer.invoke("config:get"),
    saveBusiness: (business: BusinessProfile) => ipcRenderer.invoke("config:save-business", business),
    saveProvider: (provider: ProviderInput) => ipcRenderer.invoke("config:save-provider", provider),
    complete: () => ipcRenderer.invoke("config:complete")
  },
  bridge: {
    start: (accountId?: string) => ipcRenderer.invoke("bridge:start", accountId),
    restart: (accountId?: string) => ipcRenderer.invoke("bridge:restart", accountId),
    status: (accountId?: string) => ipcRenderer.invoke("bridge:status", accountId),
    chats: () => ipcRenderer.invoke("bridge:chats"),
    messages: (accountId: string, jid: string) => ipcRenderer.invoke("bridge:messages", accountId, jid),
    send: (accountId: string, jid: string, message: string) =>
      ipcRenderer.invoke("bridge:send", accountId, jid, message)
  },
  accounts: {
    list: () => ipcRenderer.invoke("accounts:list"),
    add: (name: string) => ipcRenderer.invoke("accounts:add", name),
    rename: (accountId: string, name: string) => ipcRenderer.invoke("accounts:rename", accountId, name),
    setMcpEnabled: (accountId: string, enabled: boolean) =>
      ipcRenderer.invoke("accounts:set-mcp-enabled", accountId, enabled),
    setMcpSendEnabled: (accountId: string, enabled: boolean) =>
      ipcRenderer.invoke("accounts:set-mcp-send-enabled", accountId, enabled)
  },
  mcp: {
    setup: () => ipcRenderer.invoke("mcp:setup"),
    copy: (value: string) => ipcRenderer.invoke("mcp:copy", value)
  },
  assistant: {
    test: (provider: ProviderInput) => ipcRenderer.invoke("assistant:test", provider),
    draft: (request: DraftRequest) => ipcRenderer.invoke("assistant:draft", request)
  },
  memory: {
    get: () => ipcRenderer.invoke("memory:get"),
    addFact: (category: MemoryFact["category"], content: string) =>
      ipcRenderer.invoke("memory:add-fact", category, content),
    updateControls: (controls: MemoryControls) =>
      ipcRenderer.invoke("memory:update-controls", controls),
    reviewSuggestion: (id: string, keep: boolean) =>
      ipcRenderer.invoke("memory:review-suggestion", id, keep),
    saveCustomer: (customer: CustomerMemory) =>
      ipcRenderer.invoke("memory:save-customer", customer),
    export: () => ipcRenderer.invoke("memory:export"),
    erase: () => ipcRenderer.invoke("memory:erase")
  }
});
