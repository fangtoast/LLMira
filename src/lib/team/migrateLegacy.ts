/**
 * @project LLMira
 * @file src/lib/team/migrateLegacy.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-13
 * @function
 *   - 预览旧 Dexie 会话并构造幂等团队导入载荷
 *   - 仅在用户确认且服务端验证后清理本地副本
 * @description 动态加载旧数据库模块，避免进入团队工作台首屏依赖。
 */
import type { MigrationImport } from "@llmira/contracts";

export interface LegacyMigrationPreview {
  conversationCount: number;
  messageCount: number;
  latestUpdatedAt?: number;
}

export async function previewLegacyData(): Promise<LegacyMigrationPreview> {
  const { db } = await import("@/lib/db/dexie");
  const [conversations, messageCount] = await Promise.all([
    db.conversations.orderBy("updatedAt").reverse().toArray(),
    db.messages.count(),
  ]);
  return {
    conversationCount: conversations.length,
    messageCount,
    latestUpdatedAt: conversations[0]?.updatedAt,
  };
}

export async function buildLegacyImport(workspaceId: string): Promise<MigrationImport> {
  const { db } = await import("@/lib/db/dexie");
  const conversations = await db.conversations.toArray();
  const rows = await Promise.all(conversations.map(async (conversation) => ({
    id: conversation.id,
    title: conversation.title,
    model: conversation.model,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    messages: (await db.messages.where("conversationId").equals(conversation.id).sortBy("createdAt"))
      .map((message) => {
        const clone = { ...message } as Partial<typeof message>;
        delete clone.conversationId;
        return clone;
      }),
  })));
  const stableKey = rows
    .map((item) => `${item.id}:${item.updatedAt}:${item.messages.length}`)
    .sort()
    .join("|");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(stableKey || "empty"));
  const importId = `dexie-${Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  return { workspaceId, importId, conversations: rows };
}

export async function clearLegacyData(): Promise<void> {
  const { db } = await import("@/lib/db/dexie");
  await db.transaction("rw", db.conversations, db.messages, async () => {
    await Promise.all([db.conversations.clear(), db.messages.clear()]);
  });
}
