import type { ChatRole, TokenUsage } from "@/types";

export type ChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface ChatCompletionRequest {
  model: string;
  messages: { role: ChatRole; content: string | ChatContentPart[] }[];
  stream?: boolean;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  reasoning_effort?: "low" | "medium" | "high";
}

export interface ModelInfo {
  id: string;
  object?: string;
  owned_by?: string;
}

export interface ModelsResponse {
  data: ModelInfo[];
}

export interface StreamCallbacks {
  onStart?: () => void;
  onToken?: (token: string) => void;
  onReasoningToken?: (token: string) => void;
  onDone?: (usage?: TokenUsage) => void;
}

export interface ImageGenerationRequest {
  model: string;
  prompt: string;
  size?: string;
}

export class MissingApiKeyError extends Error {
  constructor() {
    super("API key is required.");
    this.name = "MissingApiKeyError";
  }
}
