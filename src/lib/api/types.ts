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
  group?: "auto" | string;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  reasoning_effort?: "low" | "medium" | "high";
  web_search_options?: Record<string, unknown>;
}

export interface ModelInfo {
  id: string;
  object?: string;
  owned_by?: string;
}

export interface ModelsResponse {
  data: ModelInfo[];
}

/** `streamChatCompletion` 触发 `onAbort` 时的 coarse 分类（用户主动 / 超时 / 其它）。 */
export type StreamAbortReason = "timeout" | "user" | "unknown";

/** 流式解析过程中的回调集合。 */
export interface StreamCallbacks {
  onStart?: () => void;
  onToken?: (token: string) => void;
  onReasoningToken?: (token: string) => void;
  onDone?: (usage?: TokenUsage) => void | Promise<void>;
  /** 流被中止：`user` 为用户 signal；`timeout` 为整次流式等待超时；其余为 `unknown`。 */
  onAbort?: (reason: StreamAbortReason) => void | Promise<void>;
}

export type StreamRequestOptions = {
  signal?: AbortSignal;
  /** 流式整次请求最长等待（含首包与各 token），默认 30 分钟。 */
  streamTimeoutMs?: number;
};

/** POST `/v1/images/generations` 请求体。 */
export interface ImageGenerationRequest {
  model: string;
  prompt: string;
  size?: string;
  taskType?: "IMAGE" | string;
  quality?: "auto" | "standard" | "hd" | string;
  response_format?: "url" | "b64_json" | string;
  n?: number;
  image?: string[];
  aspect_ratio?: string;
}

/** 未提供 API Key 时由 `getHeaders` 抛出。 */
export class MissingApiKeyError extends Error {
  constructor() {
    super("API key is required.");
    this.name = "MissingApiKeyError";
  }
}
