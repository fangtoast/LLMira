/**
 * @project LLMira
 * @file src/lib/chat/exportImport.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-04-30
 * @function
 *   - 会话 JSON 导出/解析、Markdown 与纯文本导出
 * @description 与侧栏导入导出联动；`version` 用于向后兼容。
 */
import type { ChatMessage, Conversation } from "@/types";

const EXPORT_VERSION = 1 as const;

/** 单份可导入的会话快照结构。 */
export type ExportedChat = {
  version: typeof EXPORT_VERSION;
  exportedAt: number;
  conversation: Pick<Conversation, "title" | "model" | "createdAt" | "updatedAt">;
  messages: ChatMessage[];
};

/** 导出为带版本号的 JSON 字符串。 */
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

/** Markdown 分段（用户/助手二级标题）。 */
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

/** 纯文本 role + 分隔线。 */
export function exportConversationPlain(messages: ChatMessage[]): string {
  return messages.map((m) => `[${m.role}]\n${m.content}`).join("\n\n---\n\n");
}

/**
 * 校验版本与必填字段后返回结构化数据。
 *
 * @throws Error 格式或版本不兼容时
 */
export function parseImportedChatJson(text: string): ExportedChat {
  const data = JSON.parse(text) as unknown;
  if (!data || typeof data !== "object") throw new Error("无效的 JSON");
  const o = data as Record<string, unknown>;
  if (o.version !== EXPORT_VERSION) throw new Error("不支持的导出版本");
  if (!o.conversation || typeof o.conversation !== "object") throw new Error("缺少 conversation");
  if (!Array.isArray(o.messages)) throw new Error("缺少 messages 数组");
  return data as ExportedChat;
}
