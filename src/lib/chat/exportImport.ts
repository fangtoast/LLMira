import type { ChatMessage, Conversation } from "@/types";

const EXPORT_VERSION = 1 as const;

export type ExportedChat = {
  version: typeof EXPORT_VERSION;
  exportedAt: number;
  conversation: Pick<Conversation, "title" | "model" | "createdAt" | "updatedAt">;
  messages: ChatMessage[];
};

export function exportConversationJson(conv: Conversation, messages: ChatMessage[]): string {
  const payload: ExportedChat = {
    version: EXPORT_VERSION,
    exportedAt: Date.now(),
    conversation: {
      title: conv.title,
      model: conv.model,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
    },
    messages,
  };
  return JSON.stringify(payload, null, 2);
}

export function exportConversationMarkdown(messages: ChatMessage[]): string {
  const lines: string[] = [];
  for (const m of messages) {
    if (m.role === "user") {
      lines.push(`## 用户\n\n${m.content}\n`);
    } else {
      lines.push(`## 助手\n\n${m.content}\n`);
    }
  }
  return lines.join("\n");
}

export function exportConversationPlain(messages: ChatMessage[]): string {
  return messages.map((m) => `[${m.role}]\n${m.content}`).join("\n\n---\n\n");
}

export function parseImportedChatJson(text: string): ExportedChat {
  const data = JSON.parse(text) as unknown;
  if (!data || typeof data !== "object") throw new Error("无效的 JSON");
  const o = data as Record<string, unknown>;
  if (o.version !== EXPORT_VERSION) throw new Error("不支持的导出版本");
  if (!o.conversation || typeof o.conversation !== "object") throw new Error("缺少 conversation");
  if (!Array.isArray(o.messages)) throw new Error("缺少 messages 数组");
  return data as ExportedChat;
}
