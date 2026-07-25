import { app, BrowserWindow, clipboard, dialog, ipcMain, session, shell } from "electron";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { AccountStore } from "./account-store";
import { BridgeManager } from "./bridge-manager";
import { ConfigStore } from "./config-store";
import { MemoryStore } from "./memory-store";
import { buildDraftPrompt, callProvider, testProvider } from "./provider";
import type {
  BusinessProfile,
  CustomerMemory,
  DraftRequest,
  MemoryControls,
  MemoryFact,
  ProviderInput
} from "./types";

let mainWindow: BrowserWindow | undefined;
let bridge: BridgeManager;
let config: ConfigStore;
let memory: MemoryStore;
let quitting = false;

function customerKey(accountId: string, jid: string): string {
  return `${accountId}:${jid}`;
}

function mcpSetup() {
  const userDataPath = app.getPath("userData");
  const serverPath = app.isPackaged
    ? join(process.resourcesPath, "app.asar", "dist-electron", "mcp-server.js")
    : join(__dirname, "mcp-server.js");
  const command = process.execPath;
  const args = [serverPath];
  const env = {
    ELECTRON_RUN_AS_NODE: "1",
    MESSAGE_BRIDGE_USER_DATA: userDataPath
  };
  const entry = { command, args, env };
  const claudeConfig = JSON.stringify({ mcpServers: { "message-bridge": entry } }, null, 2);
  const otherConfig = JSON.stringify({ "message-bridge": entry }, null, 2);
  const codexConfig = [
    "[mcp_servers.message_bridge]",
    `command = ${JSON.stringify(command)}`,
    `args = [${args.map((value) => JSON.stringify(value)).join(", ")}]`,
    "",
    "[mcp_servers.message_bridge.env]",
    ...Object.entries(env).map(([key, value]) => `${key} = ${JSON.stringify(value)}`)
  ].join("\n");
  return { command, args, env, claudeConfig, codexConfig, otherConfig, userDataPath };
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1040,
    minHeight: 720,
    show: false,
    backgroundColor: "#F7F5EF",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition: process.platform === "darwin" ? { x: 18, y: 17 } : undefined,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const allowed = process.env.VITE_DEV_SERVER_URL && url.startsWith(process.env.VITE_DEV_SERVER_URL);
    if (!allowed && !url.startsWith("file:")) event.preventDefault();
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(join(__dirname, "..", "dist", "index.html"));
  }
}

function registerIpc(): void {
  ipcMain.handle("config:get", () => config.publicConfig());
  ipcMain.handle("config:save-business", (_event, value: BusinessProfile) => config.saveBusiness(value));
  ipcMain.handle("config:save-provider", (_event, value: ProviderInput) => config.saveProvider(value));
  ipcMain.handle("config:complete", async () => {
    const result = await config.completeSetup();
    await memory.seedFromBusiness(result.business);
    const primary = (await bridge.list()).find((account) => account.isPrimary);
    if (primary?.name === "Primary account" && result.business.name.trim()) {
      await bridge.renameAccount(primary.id, result.business.name);
    }
    return result;
  });

  ipcMain.handle("bridge:start", (_event, accountId?: string) => bridge.start(accountId));
  ipcMain.handle("bridge:restart", (_event, accountId?: string) => bridge.restart(accountId));
  ipcMain.handle("bridge:status", (_event, accountId?: string) => bridge.status(accountId));
  ipcMain.handle("bridge:chats", () => bridge.chats());
  ipcMain.handle("bridge:messages", (_event, accountId: string, jid: string) => bridge.messages(accountId, jid));
  ipcMain.handle("bridge:send", async (_event, accountId: string, jid: string, message: string) => {
    const trimmed = message.trim();
    if (!trimmed) throw new Error("Write a message before sending.");
    await bridge.send(accountId, jid, trimmed);
    await memory.recordApprovedReply(customerKey(accountId, jid), trimmed);
  });
  ipcMain.handle("accounts:list", () => bridge.list());
  ipcMain.handle("accounts:add", (_event, name: string) => bridge.add(name));
  ipcMain.handle("accounts:rename", (_event, accountId: string, name: string) =>
    bridge.renameAccount(accountId, name));
  ipcMain.handle("accounts:set-mcp-enabled", (_event, accountId: string, enabled: boolean) =>
    bridge.setMcpEnabled(accountId, enabled));
  ipcMain.handle("accounts:set-mcp-send-enabled", (_event, accountId: string, enabled: boolean) =>
    bridge.setMcpSendEnabled(accountId, enabled));
  ipcMain.handle("mcp:setup", () => mcpSetup());
  ipcMain.handle("mcp:copy", (_event, value: string) => {
    clipboard.writeText(value);
    return true;
  });

  ipcMain.handle("assistant:test", async (_event, input: ProviderInput) => {
    const saved = await config.publicConfig();
    const replacementKey = input.apiKey?.trim();
    if (input.id !== saved.provider.id && !replacementKey) {
      throw new Error("Enter an API key when changing AI provider.");
    }
    const apiKey = replacementKey || await config.apiKey();
    const model = input.model.trim();
    if (!model) throw new Error("Enter a model name.");
    if (input.id === "openai-compatible") {
      if (!input.baseUrl?.trim()) throw new Error("A base URL is required.");
      const parsed = new URL(input.baseUrl);
      if (parsed.protocol !== "https:" && parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost") {
        throw new Error("Use HTTPS for remote provider URLs.");
      }
    }
    await testProvider({
      id: input.id,
      model,
      baseUrl: input.baseUrl?.trim(),
      hasApiKey: true
    }, apiKey);
    return config.saveProvider(input);
  });
  ipcMain.handle("assistant:draft", async (_event, request: DraftRequest) => {
    const saved = await config.publicConfig();
    const snapshot = await memory.snapshot();
    const prompt = buildDraftPrompt({
      business: saved.business,
      chat: request.chat,
      messages: snapshot.controls.includeCustomerHistory ? request.messages : request.messages.slice(-8),
      facts: snapshot.facts,
      customer: snapshot.customers[customerKey(request.chat.accountId, request.chat.jid)]
        ?? snapshot.customers[request.chat.jid]
    });
    return callProvider({
      provider: saved.provider,
      apiKey: await config.apiKey(),
      ...prompt
    });
  });

  ipcMain.handle("memory:get", () => memory.snapshot());
  ipcMain.handle(
    "memory:add-fact",
    (_event, category: MemoryFact["category"], content: string) => memory.addFact(category, content)
  );
  ipcMain.handle(
    "memory:update-controls",
    (_event, controls: MemoryControls) => memory.updateControls(controls)
  );
  ipcMain.handle(
    "memory:review-suggestion",
    (_event, id: string, keep: boolean) => memory.reviewSuggestion(id, keep)
  );
  ipcMain.handle(
    "memory:save-customer",
    (_event, customer: CustomerMemory) => memory.saveCustomer(customer)
  );
  ipcMain.handle("memory:export", async () => {
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: "Export Message Bridge memory",
      defaultPath: "message-bridge-memory.json",
      filters: [{ name: "JSON", extensions: ["json"] }]
    });
    if (result.canceled || !result.filePath) return false;
    await writeFile(result.filePath, JSON.stringify(await memory.snapshot(), null, 2), "utf8");
    return true;
  });
  ipcMain.handle("memory:erase", async () => {
    const result = await dialog.showMessageBox(mainWindow!, {
      type: "warning",
      title: "Erase business memory?",
      message: "This removes saved business facts, customer context and learning suggestions from this computer.",
      detail: "Your WhatsApp message archive is not affected. This cannot be undone unless you exported a copy.",
      buttons: ["Cancel", "Erase memory"],
      cancelId: 0,
      defaultId: 0
    });
    if (result.response !== 1) return memory.snapshot();
    return memory.clear();
  });
}

const primaryInstance = app.requestSingleInstanceLock();
if (!primaryInstance) {
  app.quit();
}

app.on("second-instance", () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

app.whenReady().then(async () => {
  if (!primaryInstance) return;
  const userData = app.getPath("userData");
  config = new ConfigStore(join(userData, "config.json"));
  memory = new MemoryStore(join(userData, "memory.json"));
  bridge = new BridgeManager(
    new AccountStore(join(userData, "accounts.json"), userData),
    join(userData, "mcp-runtime.json")
  );
  await bridge.initialize();
  const currentConfig = await config.publicConfig();
  const accounts = await bridge.list();
  const primary = accounts.find((account) => account.isPrimary);
  if (primary?.name === "Primary account" && currentConfig.business.name.trim()) {
    await bridge.renameAccount(primary.id, currentConfig.business.name);
  }

  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          process.env.VITE_DEV_SERVER_URL
            ? "default-src 'self' http://127.0.0.1:5173; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws://127.0.0.1:5173 http://127.0.0.1:5173"
            : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'"
        ]
      }
    });
  });

  registerIpc();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", (event) => {
  if (quitting || !bridge) return;
  event.preventDefault();
  quitting = true;
  void bridge.stopAll().finally(() => app.quit());
});
