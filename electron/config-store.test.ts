import { mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const secureStorage = vi.hoisted(() => ({
  isEncryptionAvailable: vi.fn(() => true),
  getSelectedStorageBackend: vi.fn(() => "keychain"),
  encryptString: vi.fn((value: string) => Buffer.from(`encrypted:${value}`)),
  decryptString: vi.fn((value: Buffer) => value.toString().replace(/^encrypted:/, ""))
}));

vi.mock("electron", () => ({ safeStorage: secureStorage }));

import { ConfigStore } from "./config-store";

describe("ConfigStore", () => {
  beforeEach(() => {
    secureStorage.isEncryptionAvailable.mockReturnValue(true);
    secureStorage.getSelectedStorageBackend.mockReturnValue("keychain");
  });

  it("encrypts credentials and refuses to reuse them for another provider", async () => {
    const directory = await mkdtemp(join(tmpdir(), "message-bridge-config-"));
    const store = new ConfigStore(join(directory, "config.json"));

    await store.saveProvider({ id: "openai", model: "gpt-test", apiKey: " secret " });
    await expect(store.apiKey()).resolves.toBe("secret");
    await expect(store.saveProvider({ id: "anthropic", model: "claude-test" }))
      .rejects.toThrow("Enter an API key");

    const saved = await store.saveProvider({ id: "anthropic", model: "claude-test", apiKey: "new-secret" });
    expect(saved.provider).toMatchObject({ id: "anthropic", model: "claude-test", hasApiKey: true });
    await expect(store.apiKey()).resolves.toBe("new-secret");
  });

  it("validates business details and custom provider URLs", async () => {
    const directory = await mkdtemp(join(tmpdir(), "message-bridge-config-"));
    const store = new ConfigStore(join(directory, "config.json"));

    await expect(store.saveBusiness({ name: " ", description: "", tone: "", hours: "" }))
      .rejects.toThrow("business name");
    await expect(store.saveProvider({
      id: "openai-compatible",
      model: "local",
      apiKey: "secret",
      baseUrl: "http://provider.example.com"
    })).rejects.toThrow("Use HTTPS");
    await expect(store.saveProvider({
      id: "openai-compatible",
      model: "local",
      apiKey: "secret",
      baseUrl: "http://127.0.0.1:11434/v1"
    })).resolves.toMatchObject({ provider: { id: "openai-compatible" } });
  });

  it("backs up malformed configuration and returns first-run defaults", async () => {
    const directory = await mkdtemp(join(tmpdir(), "message-bridge-config-"));
    const path = join(directory, "config.json");
    await writeFile(path, "{broken", "utf8");

    const config = await new ConfigStore(path).publicConfig();
    expect(config.setupComplete).toBe(false);
    expect(config.provider.id).toBe("openai");
    expect((await readdir(directory)).some((name) => name.startsWith("config.json.corrupt-"))).toBe(true);
  });

  it("allows setup to finish without configuring an AI provider", async () => {
    const directory = await mkdtemp(join(tmpdir(), "message-bridge-config-"));
    const store = new ConfigStore(join(directory, "config.json"));

    await store.saveBusiness({
      name: "Willow & Stitch",
      description: "Upholstery",
      tone: "Friendly",
      hours: ""
    });
    await expect(store.completeSetup()).resolves.toMatchObject({
      setupComplete: true,
      provider: { hasApiKey: false }
    });
  });
});
