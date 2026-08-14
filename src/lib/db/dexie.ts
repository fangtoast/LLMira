/**
 * @project LLMira
 * @file src/lib/db/dexie.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-04-30
 * @function
 *   - IndexedDB 单库实例与表索引
 * @description `useConversations` 等通过 `db` 读写；版本迁移在此扩展。
 */
import Dexie, { type Table } from "dexie";
import type { ChatMessage, Conversation } from "@/types";
import type { UsageEvent } from "@/lib/usage/types";

export interface ConversationRecord extends Conversation {
  keyword?: string;
}

export interface MessageRecord extends ChatMessage {
  conversationId: string;
}

class LlmiraDB extends Dexie {
  conversations!: Table<ConversationRecord, string>;
  messages!: Table<MessageRecord, string>;
  usageEvents!: Table<UsageEvent, string>;

  constructor() {
    super("llmira-db");
    this.version(1).stores({
      conversations: "id, title, model, updatedAt, createdAt, keyword",
      messages: "id, conversationId, role, createdAt",
    });
    this.version(2).stores({
      conversations: "id, title, model, updatedAt, createdAt, keyword",
      messages: "id, conversationId, role, createdAt",
      usageEvents: "id, occurredAt, operationId, kind, providerId, modelId, status, [providerId+modelId]",
    });
  }
}

export const db = new LlmiraDB();
