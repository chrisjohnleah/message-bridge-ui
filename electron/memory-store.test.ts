import { mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MemoryStore } from "./memory-store";

describe("MemoryStore", () => {
  it("seeds business context and requires review before a suggestion becomes a fact", async () => {
    const directory = await mkdtemp(join(tmpdir(), "message-bridge-memory-"));
    const store = new MemoryStore(join(directory, "memory.json"));

    await store.seedFromBusiness({
      name: "Willow & Stitch",
      description: "Bespoke upholstery",
      tone: "Warm and concise",
      hours: "9–5"
    });
    let snapshot = await store.snapshot();
    expect(snapshot.facts.map((fact) => fact.content)).toContain("Bespoke upholstery");

    await store.recordApprovedReply("123@s.whatsapp.net", "Natural linen samples can be posted free of charge.");
    snapshot = await store.snapshot();
    expect(snapshot.suggestions).toHaveLength(1);

    snapshot = await store.reviewSuggestion(snapshot.suggestions[0].id, true);
    expect(snapshot.suggestions).toHaveLength(0);
    expect(snapshot.facts.map((fact) => fact.content)).toContain("Natural linen samples can be posted free of charge.");
  });

  it("validates and normalizes customer-controlled memory", async () => {
    const directory = await mkdtemp(join(tmpdir(), "message-bridge-memory-"));
    const store = new MemoryStore(join(directory, "memory.json"));

    await expect(store.addFact("business", "   ")).rejects.toThrow("Enter something");
    await expect(store.saveCustomer({
      jid: "not-a-whatsapp-id",
      summary: "",
      facts: [],
      nextStep: "",
      updatedAt: ""
    })).rejects.toThrow("valid WhatsApp customer");

    const snapshot = await store.saveCustomer({
      jid: "123@s.whatsapp.net",
      name: "  Maya  ",
      summary: "  Returning customer  ",
      facts: [" Prefers oat ", " "],
      nextStep: " Send quote ",
      updatedAt: ""
    });
    expect(snapshot.customers["123@s.whatsapp.net"]).toMatchObject({
      name: "Maya",
      summary: "Returning customer",
      facts: ["Prefers oat"],
      nextStep: "Send quote"
    });
  });

  it("backs up malformed memory and recovers with safe defaults", async () => {
    const directory = await mkdtemp(join(tmpdir(), "message-bridge-memory-"));
    const path = join(directory, "memory.json");
    await writeFile(path, "{broken", "utf8");

    const snapshot = await new MemoryStore(path).snapshot();
    expect(snapshot.facts).toEqual([]);
    expect((await readdir(directory)).some((name) => name.startsWith("memory.json.corrupt-"))).toBe(true);
  });
});
