/**
 * @project LLMira
 * @file src/types/index.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-04-30
 * @function
 *   - 全局共享领域类型（消息、会话、用量）
 * @description Dexie、Zustand、API 层共用；变更时需兼顾导出 JSON 兼容。
 */

/** 消息发送方角色（协议层）。 */
export type ChatRole = "system" | "user" | "assistant";

/** 用户上传附件的解析结果；正文会随消息持久化到 IndexedDB。 */
export interface ChatAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  kind: "image" | "text" | "pdf" | "unsupported";
  status: "reading" | "ready" | "unsupported" | "error";
  dataUrl?: string;
  textContent?: string;
  textTruncated?: boolean;
  textCharCount?: number;
  errorMessage?: string;
  storageKey?: string;
  remoteUrl?: string;
}

/** 助手消息单次回答的快照（用于多版本历史浏览）。 */
export interface ChatMessageVariant {
  content: string;
  thinkingContent?: string;
  modelName?: string;
  tokenUsage?: TokenUsage;
  generatedImageUrls?: string[];
  requestSnapshot?: ApiRequestSnapshot;
  createdAt: number;
}

/** 单次请求快照；仅保存可调试字段，不保存 API Key。 */
export interface ApiRequestSnapshot {
  kind: "chat" | "image";
  baseUrl: string;
  endpoint: string;
  body: unknown;
  createdAt: number;
}

/** 单条聊天消息（含可选多模态与思考内容）。 */
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
  attachments?: ChatAttachment[];
  /** @deprecated 旧版图片附件字段；新逻辑优先使用 `attachments`。 */
  imageUrls?: string[];
  generatedImageUrls?: string[];
  /** 最近一次实际发送的请求体快照，便于核对模型与中转站。 */
  requestSnapshot?: ApiRequestSnapshot;
  /** 重新生成时保留的历史版本快照（按生成顺序，0-based）。 */
  variants?: ChatMessageVariant[];
  /** 持久化上次浏览的版本索引，默认展示最新版本。 */
  activeVariantIdx?: number;
}

/** 会话元数据（标题与时间戳；模型记录在会话级）。 */
export interface Conversation {
  id: string;
  title: string;
  model: string;
  updatedAt: number;
  createdAt: number;
}

/** 单次补全用量统计（来自流结束时 usage 字段）。 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUSD?: number;
}
