import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type {
  BusinessProfile,
  CustomerMemory,
  MemoryControls,
  MemoryFact,
  MemorySnapshot
} from "./types";

const emptyMemory: MemorySnapshot = {
  facts: [],
  customers: {},
  suggestions: [],
  controls: {
    learnFromApprovedReplies: true,
    suggestFactsForReview: true,
    includeCustomerHistory: true
  }
};

export class MemoryStore {
  constructor(private readonly path: string) {}

  async snapshot(): Promise<MemorySnapshot> {
    try {
      const value = JSON.parse(await readFile(this.path, "utf8")) as Partial<MemorySnapshot>;
      return {
        ...structuredClone(emptyMemory),
        ...value,
        customers: value.customers ?? {},
        controls: { ...emptyMemory.controls, ...value.controls }
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return structuredClone(emptyMemory);
      }
      if (error instanceof SyntaxError) {
        await rename(this.path, `${this.path}.corrupt-${Date.now()}`).catch(() => undefined);
        return structuredClone(emptyMemory);
      }
      throw error;
    }
  }

  private async write(memory: MemorySnapshot): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const temporaryPath = `${this.path}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(memory, null, 2), {
      encoding: "utf8",
      mode: 0o600
    });
    await rename(temporaryPath, this.path);
  }

  async seedFromBusiness(profile: BusinessProfile): Promise<void> {
    const memory = await this.snapshot();
    if (memory.facts.length > 0) return;
    const facts = [
      profile.description && { category: "business" as const, content: profile.description },
      profile.hours && { category: "business" as const, content: `Opening hours: ${profile.hours}` },
      profile.tone && { category: "voice" as const, content: `Reply style: ${profile.tone}` }
    ].filter(Boolean) as Array<Pick<MemoryFact, "category" | "content">>;
    memory.facts = facts.map((fact) => ({
      id: randomUUID(),
      ...fact,
      createdAt: new Date().toISOString()
    }));
    await this.write(memory);
  }

  async addFact(category: MemoryFact["category"], content: string): Promise<MemorySnapshot> {
    const normalized = content.trim();
    if (!["business", "products", "voice"].includes(category)) {
      throw new Error("Choose a valid memory category.");
    }
    if (!normalized) {
      throw new Error("Enter something for Message Bridge to remember.");
    }
    const memory = await this.snapshot();
    memory.facts.push({
      id: randomUUID(),
      category,
      content: normalized,
      createdAt: new Date().toISOString()
    });
    await this.write(memory);
    return memory;
  }

  async updateControls(controls: MemoryControls): Promise<MemorySnapshot> {
    const memory = await this.snapshot();
    memory.controls = controls;
    await this.write(memory);
    return memory;
  }

  async reviewSuggestion(id: string, keep: boolean): Promise<MemorySnapshot> {
    const memory = await this.snapshot();
    const suggestion = memory.suggestions.find((item) => item.id === id);
    if (keep && suggestion) {
      memory.facts.push({
        id: randomUUID(),
        category: "business",
        content: suggestion.content,
        createdAt: new Date().toISOString()
      });
    }
    memory.suggestions = memory.suggestions.filter((item) => item.id !== id);
    await this.write(memory);
    return memory;
  }

  async saveCustomer(customer: CustomerMemory): Promise<MemorySnapshot> {
    const jid = customer.jid.trim();
    if (!jid || (!jid.endsWith("@s.whatsapp.net") && !jid.endsWith("@g.us") && !jid.endsWith("@lid"))) {
      throw new Error("Choose a valid WhatsApp customer.");
    }
    const memory = await this.snapshot();
    const key = customer.accountId ? `${customer.accountId}:${jid}` : jid;
    memory.customers[key] = {
      ...customer,
      jid,
      name: customer.name?.trim(),
      summary: customer.summary.trim(),
      facts: customer.facts.map((fact) => fact.trim()).filter(Boolean),
      nextStep: customer.nextStep.trim(),
      updatedAt: new Date().toISOString()
    };
    await this.write(memory);
    return memory;
  }

  async clear(): Promise<MemorySnapshot> {
    const memory = structuredClone(emptyMemory);
    await this.write(memory);
    return memory;
  }

  async recordApprovedReply(jid: string, reply: string): Promise<void> {
    const memory = await this.snapshot();
    if (!memory.controls.learnFromApprovedReplies || !memory.controls.suggestFactsForReview) return;
    const normalized = reply.trim();
    if (normalized.length < 24) return;
    const duplicate = memory.suggestions.some((item) => item.content === normalized);
    if (!duplicate) {
      memory.suggestions.unshift({
        id: randomUUID(),
        content: normalized,
        source: `Approved reply in ${jid}`,
        createdAt: new Date().toISOString()
      });
      memory.suggestions = memory.suggestions.slice(0, 20);
      await this.write(memory);
    }
  }
}
