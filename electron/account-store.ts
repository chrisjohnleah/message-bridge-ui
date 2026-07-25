import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export interface StoredWhatsAppAccount {
  id: string;
  name: string;
  createdAt: string;
  isPrimary: boolean;
  mcpEnabled: boolean;
  mcpSendEnabled: boolean;
}

export class AccountStore {
  constructor(
    private readonly path: string,
    private readonly userDataDirectory: string
  ) {}

  async list(): Promise<StoredWhatsAppAccount[]> {
    try {
      const parsed = JSON.parse(await readFile(this.path, "utf8")) as StoredWhatsAppAccount[];
      if (!Array.isArray(parsed) || parsed.length === 0) return this.createPrimary();
      return parsed.map((account, index) => ({
        id: account.id,
        name: account.name,
        createdAt: account.createdAt,
        isPrimary: account.isPrimary ?? index === 0,
        mcpEnabled: account.mcpEnabled ?? false,
        mcpSendEnabled: account.mcpSendEnabled ?? false
      }));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return this.createPrimary();
      if (error instanceof SyntaxError) {
        await rename(this.path, `${this.path}.corrupt-${Date.now()}`).catch(() => undefined);
        return this.createPrimary();
      }
      throw error;
    }
  }

  dataDirectory(account: StoredWhatsAppAccount): string {
    return account.isPrimary
      ? this.userDataDirectory
      : join(this.userDataDirectory, "accounts", account.id);
  }

  async add(name: string): Promise<StoredWhatsAppAccount> {
    const normalized = this.validName(name);
    const accounts = await this.list();
    const account: StoredWhatsAppAccount = {
      id: randomUUID(),
      name: normalized,
      createdAt: new Date().toISOString(),
      isPrimary: false,
      mcpEnabled: false,
      mcpSendEnabled: false
    };
    accounts.push(account);
    await this.write(accounts);
    return account;
  }

  async renameAccount(accountId: string, name: string): Promise<StoredWhatsAppAccount[]> {
    const normalized = this.validName(name);
    const accounts = await this.list();
    const account = accounts.find((item) => item.id === accountId);
    if (!account) throw new Error("That messaging account no longer exists.");
    account.name = normalized;
    await this.write(accounts);
    return accounts;
  }

  async setMcpEnabled(accountId: string, enabled: boolean): Promise<StoredWhatsAppAccount[]> {
    const accounts = await this.list();
    const account = accounts.find((item) => item.id === accountId);
    if (!account) throw new Error("That messaging account no longer exists.");
    account.mcpEnabled = enabled;
    if (!enabled) account.mcpSendEnabled = false;
    await this.write(accounts);
    return accounts;
  }

  async setMcpSendEnabled(accountId: string, enabled: boolean): Promise<StoredWhatsAppAccount[]> {
    const accounts = await this.list();
    const account = accounts.find((item) => item.id === accountId);
    if (!account) throw new Error("That messaging account no longer exists.");
    if (enabled && !account.mcpEnabled) {
      throw new Error("Share the account with MCP before enabling sends.");
    }
    account.mcpSendEnabled = enabled;
    await this.write(accounts);
    return accounts;
  }

  private async createPrimary(): Promise<StoredWhatsAppAccount[]> {
    const accounts: StoredWhatsAppAccount[] = [{
      id: "primary",
      name: "Primary account",
      createdAt: new Date().toISOString(),
      isPrimary: true,
      mcpEnabled: false,
      mcpSendEnabled: false
    }];
    await this.write(accounts);
    return accounts;
  }

  private validName(name: string): string {
    const normalized = name.trim().replace(/\s+/g, " ");
    if (normalized.length < 2 || normalized.length > 60) {
      throw new Error("Give this account a name between 2 and 60 characters.");
    }
    return normalized;
  }

  private async write(accounts: StoredWhatsAppAccount[]): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const temporary = `${this.path}.tmp`;
    await writeFile(temporary, JSON.stringify(accounts, null, 2), {
      encoding: "utf8",
      mode: 0o600
    });
    await rename(temporary, this.path);
  }
}
