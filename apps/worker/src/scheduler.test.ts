/**
 * @project LLMira
 * @file apps/worker/src/scheduler.test.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-13
 * @description 验证定时任务初始化和到期运行的事务行为。
 */
import { describe, expect, it, vi } from "vitest";
import { createDueRuns } from "./scheduler.js";

describe("scheduled task polling", () => {
  it("initializes next_run_at without creating an early run", async () => {
    const updates: unknown[] = [];
    const transaction = vi.fn(async (strings: TemplateStringsArray) => {
      const sql = strings.join("?");
      if (sql.includes("next_run_at is null")) return [{ id: "task-1", workspace_id: "workspace-1", created_by: "user-1", name: "日报", cron_expression: "0 9 * * *", timezone: "Asia/Shanghai", prompt: "生成日报", next_run_at: null }];
      if (sql.includes("next_run_at <= now()")) return [];
      updates.push(sql); return [];
    });
    const sql = { begin: (operation: (tx: unknown) => Promise<string[]>) => operation(transaction) };
    const result = await createDueRuns(sql as never);
    expect(result).toEqual([]);
    expect(updates.some((value) => String(value).includes("update scheduled_tasks set next_run_at"))).toBe(true);
  });
});
