export type ProviderId = "openai" | "anthropic" | "gemini" | "openai-compatible";

export interface BusinessProfile {
  name: string;
  description: string;
  tone: string;
  hours: string;
}

export interface ProviderConfig {
  id: ProviderId;
  model: string;
  baseUrl?: string;
  hasApiKey: boolean;
}

export interface PublicConfig {
  setupComplete: boolean;
  business: BusinessProfile;
  provider: ProviderConfig;
}

export interface ProviderInput {
  id: ProviderId;
  model: string;
  baseUrl?: string;
  apiKey?: string;
}

export interface BridgeStatus {
  phase: "stopped" | "starting" | "waiting_for_scan" | "connected" | "expired" | "error";
  connected: boolean;
  qrCode?: string;
  message?: string;
}

export interface WhatsAppAccount {
  id: string;
  name: string;
  createdAt: string;
  isPrimary: boolean;
  mcpEnabled: boolean;
  mcpSendEnabled: boolean;
  status: BridgeStatus;
}

export interface Chat {
  jid: string;
  name: string;
  last_message_time: string;
  last_message: string;
  last_is_from_me: boolean;
  accountId: string;
  accountName: string;
}

export interface ChatMessage {
  id: string;
  chat_jid: string;
  sender: string;
  content: string;
  timestamp: string;
  is_from_me: boolean;
  media_type: string;
  filename: string;
  quoted_message_id?: string;
  deleted_at?: string;
}

export interface MemoryFact {
  id: string;
  category: "business" | "products" | "voice";
  content: string;
  createdAt: string;
}

export interface CustomerMemory {
  jid: string;
  accountId?: string;
  accountName?: string;
  name?: string;
  summary: string;
  facts: string[];
  nextStep: string;
  updatedAt: string;
}

export interface LearningSuggestion {
  id: string;
  content: string;
  source: string;
  createdAt: string;
}

export interface MemoryControls {
  learnFromApprovedReplies: boolean;
  suggestFactsForReview: boolean;
  includeCustomerHistory: boolean;
}

export interface MemorySnapshot {
  facts: MemoryFact[];
  customers: Record<string, CustomerMemory>;
  suggestions: LearningSuggestion[];
  controls: MemoryControls;
}

export interface DraftRequest {
  chat: Chat;
  messages: ChatMessage[];
}

export interface McpSetup {
  command: string;
  args: string[];
  env: Record<string, string>;
  claudeConfig: string;
  codexConfig: string;
  otherConfig: string;
  userDataPath: string;
}
