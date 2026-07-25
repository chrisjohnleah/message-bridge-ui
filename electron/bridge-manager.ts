import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { AccountStore, type StoredWhatsAppAccount } from "./account-store";
import { BridgeService } from "./bridge-service";
import type { BridgeStatus, Chat, ChatMessage, WhatsAppAccount } from "./types";

interface RuntimeAccount {
  id: string;
  name: string;
  port: number;
  tokenPath: string;
  mcpEnabled: boolean;
  mcpSendEnabled: boolean;
}

export class BridgeManager {
  private accounts: StoredWhatsAppAccount[] = [];
  private readonly services = new Map<string, BridgeService>();

  constructor(
    private readonly store: AccountStore,
    private readonly runtimePath: string
  ) {}

  async initialize(): Promise<void> {
    this.accounts = await this.store.list();
    for (const account of this.accounts) this.ensureService(account);
    await Promise.allSettled(this.accounts.map((account) => this.start(account.id)));
    await this.writeRuntime();
  }

  async list(): Promise<WhatsAppAccount[]> {
    this.accounts = await this.store.list();
    return Promise.all(this.accounts.map(async (account) => ({
      ...account,
      status: await this.ensureService(account).status()
    })));
  }

  async add(name: string): Promise<WhatsAppAccount> {
    const account = await this.store.add(name);
    this.accounts = await this.store.list();
    const status = await this.ensureService(account).start();
    await this.writeRuntime();
    return { ...account, status };
  }

  async renameAccount(accountId: string, name: string): Promise<WhatsAppAccount[]> {
    this.accounts = await this.store.renameAccount(accountId, name);
    await this.writeRuntime();
    return this.list();
  }

  async setMcpEnabled(accountId: string, enabled: boolean): Promise<WhatsAppAccount[]> {
    this.accounts = await this.store.setMcpEnabled(accountId, enabled);
    await this.writeRuntime();
    return this.list();
  }

  async setMcpSendEnabled(accountId: string, enabled: boolean): Promise<WhatsAppAccount[]> {
    this.accounts = await this.store.setMcpSendEnabled(accountId, enabled);
    await this.writeRuntime();
    return this.list();
  }

  async start(accountId?: string): Promise<BridgeStatus> {
    const account = this.resolveAccount(accountId);
    const result = await this.ensureService(account).start();
    await this.writeRuntime();
    return result;
  }

  async restart(accountId?: string): Promise<BridgeStatus> {
    const account = this.resolveAccount(accountId);
    const result = await this.ensureService(account).restart();
    await this.writeRuntime();
    return result;
  }

  async status(accountId?: string): Promise<BridgeStatus> {
    return this.ensureService(this.resolveAccount(accountId)).status();
  }

  async chats(): Promise<Chat[]> {
    const settled = await Promise.allSettled(this.accounts.map(async (account) => {
      const chats = await this.ensureService(account).chats();
      return chats.map((chat) => ({
        ...chat,
        accountId: account.id,
        accountName: account.name
      }));
    }));
    return settled
      .flatMap((result) => result.status === "fulfilled" ? result.value : [])
      .sort((left, right) => Date.parse(right.last_message_time) - Date.parse(left.last_message_time));
  }

  async messages(accountId: string, jid: string): Promise<ChatMessage[]> {
    return this.ensureService(this.resolveAccount(accountId)).messages(jid);
  }

  async send(accountId: string, jid: string, message: string): Promise<void> {
    await this.ensureService(this.resolveAccount(accountId)).send(jid, message);
  }

  async stopAll(): Promise<void> {
    await Promise.allSettled([...this.services.values()].map((service) => service.stop()));
    await this.writeRuntime();
  }

  private resolveAccount(accountId?: string): StoredWhatsAppAccount {
    const account = accountId
      ? this.accounts.find((item) => item.id === accountId)
      : this.accounts.find((item) => item.isPrimary) ?? this.accounts[0];
    if (!account) throw new Error("That messaging account no longer exists.");
    return account;
  }

  private ensureService(account: StoredWhatsAppAccount): BridgeService {
    let service = this.services.get(account.id);
    if (!service) {
      service = new BridgeService(this.store.dataDirectory(account));
      this.services.set(account.id, service);
    }
    return service;
  }

  private async writeRuntime(): Promise<void> {
    const entries: RuntimeAccount[] = this.accounts.flatMap((account) => {
      const service = this.services.get(account.id);
      return service?.runtimePort
        ? [{
            id: account.id,
            name: account.name,
            port: service.runtimePort,
            tokenPath: service.tokenPath,
            mcpEnabled: account.mcpEnabled,
            mcpSendEnabled: account.mcpSendEnabled
          }]
        : [];
    });
    await mkdir(dirname(this.runtimePath), { recursive: true });
    const temporary = `${this.runtimePath}.tmp`;
    await writeFile(temporary, JSON.stringify({ version: 1, accounts: entries }, null, 2), {
      encoding: "utf8",
      mode: 0o600
    });
    await rename(temporary, this.runtimePath);
  }
}
