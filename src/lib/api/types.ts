/**
 * @project LLMira
 * @file src/lib/api/types.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-04-30
 * @function
 *   - Chat/Image 请求体与流回调类型
 * @description 与 OpenAI 兼容 API 对齐；被 `client.ts` 与构建消息的模块引用。
 */
import type { ChatRole, TokenUsage } from "@/types";

/** 多模态单条 content 片段（文本或图片 URL）。 */
export type ChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

/** POST `/v1/chat/completions` 的请求体（节选扩展字段）。 */
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

/** 流式解析过程中的回调集合。 */
export interface StreamCallbacks {
  onStart?: () => void;
  onToken?: (token: string) => void;
  onReasoningToken?: (token: string) => void;
  onDone?: (usage?: TokenUsage) => void | Promise<void>;
  /** 流被 AbortController 中止（含 fetch/read 抛出的 AbortError） */
  onAbort?: () => void | Promise<void>;
}

export type StreamRequestOptions = {
  signal?: AbortSignal;
};

/** POST `/v1/images/generations` 请求体。 */
export interface ImageGenerationRequest {
  model: string;
  prompt: string;
  size?: string;
}

/** 未提供 API Key 时由 `getHeaders` 抛出。 */
export class MissingApiKeyError extends Error {
  constructor() {
    super("API key is required.");
    this.name = "MissingApiKeyError";
  }
}
