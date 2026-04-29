import Dexie, { type Table } from "dexie";
import type { ChatMessage, Conversation } from "@/types";

export interface ConversationRecord extends Conversation {
  keyword?: string;
}

export interface MessageRecord extends ChatMessage {
  conversationId: string;
}

class LlmiraDB extends Dexie {
  conversations!: Table<ConversationRecord, string>;
  messages!: Table<MessageRecord, string>;

  constructor() {
    super("llmira-db");
    this.version(1).stores({
      conversations: "id, title, model, updatedAt, createdAt, keyword",
      messages: "id, conversationId, role, createdAt",
    });
  }
}

export const db = new LlmiraDB();
