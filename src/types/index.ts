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
  imageUrls?: string[];
  generatedImageUrls?: string[];
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
