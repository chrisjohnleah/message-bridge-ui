import { app } from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import { access, chmod, mkdir, readFile, unlink } from "node:fs/promises";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import type { BridgeStatus, Chat, ChatMessage } from "./types";

interface PairingFile {
  status?: string;
  qr_code?: string;
}

async function availablePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not allocate a private bridge port."));
        return;
      }
      const port = address.port;
      server.close((error) => error ? reject(error) : resolvePort(port));
    });
  });
}

export class BridgeService {
  private process?: ChildProcess;
  private port?: number;
  private lastError?: string;
  private lastLog?: string;

  constructor(private readonly dataDirectory: string) {}

  private get bridgeDirectory(): string {
    return join(this.dataDirectory, "bridge");
  }

  get tokenPath(): string {
    return join(this.bridgeDirectory, "store", ".bridge-token");
  }

  get runtimePort(): number | undefined {
    return this.port;
  }

  private get pairingPath(): string {
    return join(this.bridgeDirectory, "store", "pairing.json");
  }

  private get executablePath(): string {
    const name = process.platform === "win32" ? "whatsapp-bridge.exe" : "whatsapp-bridge";
    if (app.isPackaged) return join(process.resourcesPath, "bin", name);
    return resolve(__dirname, "..", "resources", "bin", name);
  }

  async start(): Promise<BridgeStatus> {
    if (this.process && !this.process.killed) return this.status();
    this.port = await availablePort();
    await mkdir(join(this.bridgeDirectory, "store"), { recursive: true });
    await mkdir(join(this.dataDirectory, "outbox"), { recursive: true });
    await access(this.executablePath);
    if (!app.isPackaged && process.platform !== "win32") {
      await chmod(this.executablePath, 0o755);
    }
    await unlink(this.pairingPath).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });

    this.lastError = undefined;
    this.lastLog = undefined;
    const child = spawn(this.executablePath, [], {
      cwd: this.bridgeDirectory,
      env: {
        ...process.env,
        WHATSAPP_BRIDGE_PORT: String(this.port),
        WEBHOOK_URL: "",
        FORWARD_SELF: "false",
        WHATSAPP_MEDIA_ROOTS: join(this.dataDirectory, "outbox")
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    this.process = child;
    // The bridge is intentionally chatty during history sync. Always drain
    // stdout so its pipe cannot fill and stall the WhatsApp event loop.
    child.stdout?.on("data", () => undefined);
    child.stderr?.on("data", (chunk) => {
      const line = String(chunk).trim();
      if (line) this.lastLog = line.slice(-500);
    });
    child.once("error", (error) => {
      this.lastError = `The WhatsApp bridge could not start: ${error.message}`;
      if (this.process === child) this.process = undefined;
    });
    child.on("exit", (code) => {
      if (code && code !== 0) {
        this.lastError = this.lastLog
          ? `The WhatsApp bridge stopped: ${this.lastLog}`
          : `The WhatsApp bridge stopped with exit code ${code}.`;
      }
      if (this.process === child) this.process = undefined;
    });
    return this.status();
  }

  async stop(): Promise<void> {
    const child = this.process;
    if (!child) {
      this.port = undefined;
      return;
    }
    this.process = undefined;
    await new Promise<void>((resolveStop) => {
      const forceTimeout = setTimeout(() => {
        if (child.exitCode === null) child.kill("SIGKILL");
      }, 2_000);
      const finishTimeout = setTimeout(resolveStop, 3_000);
      child.once("exit", () => {
        clearTimeout(forceTimeout);
        clearTimeout(finishTimeout);
        resolveStop();
      });
      child.kill("SIGTERM");
    });
    this.port = undefined;
  }

  async restart(): Promise<BridgeStatus> {
    await this.stop();
    return this.start();
  }

  async status(): Promise<BridgeStatus> {
    const processRunning = Boolean(this.process && !this.process.killed);
    try {
      if (!this.port) throw new Error("Bridge is not running.");
      const token = await this.token();
      const response = await fetch(`http://127.0.0.1:${this.port}/api/health`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const payload = await response.json() as { connected?: boolean };
      if (payload.connected) return { phase: "connected", connected: true };
    } catch {
      // During first pairing the REST server intentionally is not available.
    }

    if (!processRunning && this.lastError) {
      return { phase: "error", connected: false, message: this.lastError };
    }

    try {
      const pairing = JSON.parse(await readFile(this.pairingPath, "utf8")) as PairingFile;
      if (processRunning && pairing.status === "waiting_for_scan") {
        return {
          phase: "waiting_for_scan",
          connected: false,
          qrCode: pairing.qr_code
        };
      }
      if (processRunning && pairing.status === "expired") {
        return { phase: "expired", connected: false, message: "The code expired. Restart the bridge to get a new one." };
      }
    } catch {
      // File appears shortly after the process starts.
    }

    if (this.lastError) return { phase: "error", connected: false, message: this.lastError };
    return {
      phase: processRunning ? "starting" : "stopped",
      connected: false,
      message: processRunning ? "Starting the secure bridge…" : "Bridge is stopped."
    };
  }

  private async token(): Promise<string> {
    return (await readFile(this.tokenPath, "utf8")).trim();
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!this.port) throw new Error("This WhatsApp account is not running.");
    const token = await this.token();
    const response = await fetch(`http://127.0.0.1:${this.port}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...init.headers
      }
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || `Bridge request failed (${response.status}).`);
    }
    return response.json() as Promise<T>;
  }

  async chats(): Promise<Chat[]> {
    const payload = await this.request<{ chats: Chat[] }>("/api/chats?limit=200");
    return payload.chats;
  }

  async messages(jid: string): Promise<ChatMessage[]> {
    const payload = await this.request<{ messages: ChatMessage[] }>(
      `/api/messages?limit=200&chat_jid=${encodeURIComponent(jid)}`
    );
    return payload.messages;
  }

  async send(jid: string, message: string): Promise<void> {
    await this.request("/api/send", {
      method: "POST",
      body: JSON.stringify({ recipient: jid, message })
    });
  }
}
