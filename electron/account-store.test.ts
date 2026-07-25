import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AccountStore } from "./account-store";

const temporaryDirectories: string[] = [];

async function store() {
  const directory = await mkdtemp(join(tmpdir(), "message-bridge-accounts-"));
  temporaryDirectories.push(directory);
  return {
    directory,
    value: new AccountStore(join(directory, "accounts.json"), directory)
  };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })
  ));
});

describe("AccountStore", () => {
  it("migrates a legacy install to one primary account without moving its bridge data", async () => {
    const { directory, value } = await store();
    const accounts = await value.list();

    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({
      id: "primary",
      name: "Primary account",
      isPrimary: true,
      mcpEnabled: false,
      mcpSendEnabled: false
    });
    expect(value.dataDirectory(accounts[0])).toBe(directory);
  });

  it("creates isolated account directories and persists separate MCP permissions", async () => {
    const { directory, value } = await store();
    await value.list();
    const showroom = await value.add("Showroom phone");

    expect(value.dataDirectory(showroom)).toBe(join(directory, "accounts", showroom.id));
    await value.setMcpEnabled(showroom.id, true);
    await value.setMcpSendEnabled(showroom.id, true);

    const persisted = JSON.parse(await readFile(join(directory, "accounts.json"), "utf8"));
    expect(persisted.find((account: { id: string }) => account.id === showroom.id)).toMatchObject({
      name: "Showroom phone",
      isPrimary: false,
      mcpEnabled: true,
      mcpSendEnabled: true
    });

    const revoked = await value.setMcpEnabled(showroom.id, false);
    expect(revoked.find((account) => account.id === showroom.id)).toMatchObject({
      mcpEnabled: false,
      mcpSendEnabled: false
    });
  });

  it("rejects account names that cannot be understood in the inbox", async () => {
    const { value } = await store();
    await expect(value.add(" ")).rejects.toThrow("between 2 and 60");
  });
});
