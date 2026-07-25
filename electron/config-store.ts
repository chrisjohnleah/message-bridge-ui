import { safeStorage } from "electron";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type {
  BusinessProfile,
  ProviderConfig,
  ProviderInput,
  PublicConfig
} from "./types";

interface StoredConfig {
  setupComplete: boolean;
  business: BusinessProfile;
  provider: Omit<ProviderConfig, "hasApiKey"> & {
    encryptedApiKey?: string;
  };
}

const defaultConfig: StoredConfig = {
  setupComplete: false,
  business: {
    name: "",
    description: "",
    tone: "Friendly, concise and helpful",
    hours: ""
  },
  provider: {
    id: "openai",
    model: "gpt-4.1-mini"
  }
};
const providerIds = new Set(["openai", "anthropic", "gemini", "openai-compatible"]);

function encryptionAvailable(): boolean {
  if (!safeStorage.isEncryptionAvailable()) return false;
  return process.platform !== "linux" || safeStorage.getSelectedStorageBackend() !== "basic_text";
}

export class ConfigStore {
  constructor(private readonly path: string) {}

  private async read(): Promise<StoredConfig> {
    try {
      const value = JSON.parse(await readFile(this.path, "utf8")) as Partial<StoredConfig>;
      return {
        ...defaultConfig,
        ...value,
        business: { ...defaultConfig.business, ...value.business },
        provider: { ...defaultConfig.provider, ...value.provider }
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return structuredClone(defaultConfig);
      }
      if (error instanceof SyntaxError) {
        await rename(this.path, `${this.path}.corrupt-${Date.now()}`).catch(() => undefined);
        return structuredClone(defaultConfig);
      }
      throw error;
    }
  }

  private async write(config: StoredConfig): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const temporaryPath = `${this.path}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(config, null, 2), {
      encoding: "utf8",
      mode: 0o600
    });
    await rename(temporaryPath, this.path);
  }

  async publicConfig(): Promise<PublicConfig> {
    const config = await this.read();
    return {
      setupComplete: config.setupComplete,
      business: config.business,
      provider: {
        id: config.provider.id,
        model: config.provider.model,
        baseUrl: config.provider.baseUrl,
        hasApiKey: Boolean(config.provider.encryptedApiKey)
      }
    };
  }

  async saveBusiness(business: BusinessProfile): Promise<PublicConfig> {
    const config = await this.read();
    const name = business.name.trim();
    const description = business.description.trim();
    if (!name || !description) {
      throw new Error("Enter your business name and what your business does.");
    }
    config.business = {
      name,
      description,
      tone: business.tone.trim(),
      hours: business.hours.trim()
    };
    await this.write(config);
    return this.publicConfig();
  }

  async saveProvider(input: ProviderInput): Promise<PublicConfig> {
    const config = await this.read();
    if (!providerIds.has(input.id)) {
      throw new Error("Choose a supported AI provider.");
    }
    const model = input.model.trim();
    const apiKey = input.apiKey?.trim();
    if (!model) {
      throw new Error("Enter a model name.");
    }
    if (input.id !== config.provider.id && !apiKey) {
      throw new Error("Enter an API key when changing AI provider.");
    }
    const baseUrl = input.baseUrl?.trim();
    if (input.id === "openai-compatible") {
      if (!baseUrl) {
        throw new Error("A base URL is required for an OpenAI-compatible provider.");
      }
      let parsed: URL;
      try {
        parsed = new URL(baseUrl);
      } catch {
        throw new Error("Enter a valid provider base URL.");
      }
      if (parsed.protocol !== "https:" && parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost") {
        throw new Error("Use HTTPS for remote provider URLs.");
      }
    }
    config.provider = {
      id: input.id,
      model,
      baseUrl,
      encryptedApiKey: input.id === config.provider.id ? config.provider.encryptedApiKey : undefined
    };
    if (apiKey) {
      if (!encryptionAvailable()) {
        throw new Error("Secure credential storage is unavailable on this computer.");
      }
      config.provider.encryptedApiKey = safeStorage.encryptString(apiKey).toString("base64");
    }
    await this.write(config);
    return this.publicConfig();
  }

  async apiKey(): Promise<string> {
    const config = await this.read();
    if (!config.provider.encryptedApiKey) {
      throw new Error("Add an API key before using the assistant.");
    }
    if (!encryptionAvailable()) {
      throw new Error("Secure credential storage is unavailable on this computer.");
    }
    return safeStorage.decryptString(Buffer.from(config.provider.encryptedApiKey, "base64"));
  }

  async completeSetup(): Promise<PublicConfig> {
    const config = await this.read();
    if (!config.business.name || !config.business.description) {
      throw new Error("Complete the business profile first.");
    }
    config.setupComplete = true;
    await this.write(config);
    return this.publicConfig();
  }
}
