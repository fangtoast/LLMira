export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  senderName?: string;
  senderAvatar?: string;
  modelName?: string;
  content: string;
  thinkingContent?: string;
  createdAt: number;
  tokenUsage?: TokenUsage;
  imageUrls?: string[];
  generatedImageUrls?: string[];
}

export interface Conversation {
  id: string;
  title: string;
  model: string;
  updatedAt: number;
  createdAt: number;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUSD?: number;
}
