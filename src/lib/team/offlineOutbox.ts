/**
 * @project LLMira
 * @file src/lib/team/offlineOutbox.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-13
 * @function
 *   - 在 Tauri SQLite 中保存离线草稿与待同步操作
 *   - 通过幂等键避免重连后重复提交
 * @description Web 浏览器沿用现有 Dexie；本模块只在 Tauri 运行时动态加载 SQL 插件。
 */
import { v7 as uuidv7 } from "uuid";

export interface OutboxItem {
  id: string;
  workspaceId: string;
  operation: "message.create" | "draft.sync";
  payload: Record<string, unknown>;
  idempotencyKey: string;
  attempts: number;
  lastError?: string;
  createdAt: string;
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function database() {
  if (!isTauriRuntime()) return undefined;
  const { default: Database } = await import("@tauri-apps/plugin-sql");
  return Database.load("sqlite:llmira-cache.db");
}

/** 保存或覆盖当前设备草稿。 */
export async function saveOfflineDraft(input: {
  id: string;
  workspaceId: string;
  conversationId?: string;
  content: string;
}): Promise<boolean> {
  const db = await database();
  if (!db) return false;
  await db.execute(
    `insert into offline_drafts (id, workspace_id, conversation_id, content, updated_at)
     values ($1, $2, $3, $4, $5)
     on conflict(id) do update set content = excluded.content, updated_at = excluded.updated_at`,
    [input.id, input.workspaceId, input.conversationId ?? null, input.content, new Date().toISOString()],
  );
  return true;
}

export async function readOfflineDraft(id: string): Promise<string | undefined> {
  const db = await database();
  if (!db) return undefined;
  const rows = await db.select<Array<{ content: string }>>("select content from offline_drafts where id = $1 limit 1", [id]);
  return rows[0]?.content;
}

/** 把可安全重放的操作放入 outbox。 */
export async function enqueueOfflineOperation(input: {
  workspaceId: string;
  operation: OutboxItem["operation"];
  payload: Record<string, unknown>;
  idempotencyKey?: string;
}): Promise<OutboxItem | undefined> {
  const db = await database();
  if (!db) return undefined;
  const item: OutboxItem = {
    id: uuidv7(),
    workspaceId: input.workspaceId,
    operation: input.operation,
    payload: input.payload,
    idempotencyKey: input.idempotencyKey ?? uuidv7(),
    attempts: 0,
    createdAt: new Date().toISOString(),
  };
  await db.execute(
    `insert or ignore into outbox
      (id, workspace_id, operation, payload_json, idempotency_key, attempts, created_at)
     values ($1, $2, $3, $4, $5, 0, $6)`,
    [item.id, item.workspaceId, item.operation, JSON.stringify(item.payload), item.idempotencyKey, item.createdAt],
  );
  return item;
}

/** 联网后按创建顺序重放 outbox；失败项保留并记录错误。 */
export async function flushOfflineOperations(
  handler: (item: OutboxItem) => Promise<void>,
): Promise<{ completed: number; failed: number }> {
  const db = await database();
  if (!db) return { completed: 0, failed: 0 };
  const rows = await db.select<Array<{
    id: string;
    workspace_id: string;
    operation: OutboxItem["operation"];
    payload_json: string;
    idempotency_key: string;
    attempts: number;
    last_error: string | null;
    created_at: string;
  }>>("select * from outbox order by created_at asc limit 100");
  let completed = 0;
  let failed = 0;
  for (const row of rows) {
    const item: OutboxItem = { id: row.id, workspaceId: row.workspace_id, operation: row.operation, payload: JSON.parse(row.payload_json) as Record<string, unknown>, idempotencyKey: row.idempotency_key, attempts: row.attempts, lastError: row.last_error ?? undefined, createdAt: row.created_at };
    try {
      await handler(item);
      await db.execute("delete from outbox where id = $1", [item.id]);
      completed += 1;
    } catch (error) {
      await db.execute("update outbox set attempts = attempts + 1, last_error = $2 where id = $1", [item.id, error instanceof Error ? error.message.slice(0, 500) : "UNKNOWN_SYNC_ERROR"]);
      failed += 1;
      break;
    }
  }
  return { completed, failed };
}
