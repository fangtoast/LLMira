/**
 * @project LLMira
 * @file apps/worker/src/scheduler.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-13
 * @function
 *   - 计算工作区定时任务的下次执行时间
 *   - 使用事务锁创建唯一 Agent 运行并写入审计
 * @description 调度器只创建运行；后续工具仍遵守 Agent 的逐次授权边界。
 */
import { Cron } from "croner";
import type { Sql } from "postgres";
import { v7 as uuidv7 } from "uuid";

interface ScheduledRow {
  id: string;
  workspace_id: string;
  created_by: string;
  name: string;
  cron_expression: string;
  timezone: string;
  prompt: string;
  next_run_at: Date | null;
}

function nextDate(task: ScheduledRow, from = new Date()): Date {
  const cron = new Cron(task.cron_expression, { timezone: task.timezone, paused: true });
  const next = cron.nextRun(from);
  cron.stop();
  if (!next) throw new Error("SCHEDULE_HAS_NO_NEXT_RUN");
  return next;
}

/** 领取到期任务并返回需要进入 BullMQ 的运行 ID。 */
export async function createDueRuns(sql: Sql): Promise<string[]> {
  return sql.begin(async (tx) => {
    const uninitialized = await tx<ScheduledRow[]>`
      select * from scheduled_tasks where enabled = true and next_run_at is null
      order by created_at asc for update skip locked limit 100
    `;
    for (const task of uninitialized) {
      try {
        await tx`update scheduled_tasks set next_run_at = ${nextDate(task)}, updated_at = now() where id = ${task.id}`;
      } catch {
        await tx`update scheduled_tasks set enabled = false, updated_at = now() where id = ${task.id}`;
      }
    }

    const due = await tx<ScheduledRow[]>`
      select * from scheduled_tasks
      where enabled = true and next_run_at <= now()
      order by next_run_at asc for update skip locked limit 20
    `;
    const runIds: string[] = [];
    for (const task of due) {
      const runId = uuidv7();
      const eventId = uuidv7();
      const nextRunAt = nextDate(task, new Date());
      await tx`
        insert into agent_runs (id, workspace_id, requested_by, title, prompt, status)
        values (${runId}, ${task.workspace_id}, ${task.created_by}, ${`定时任务 · ${task.name}`}, ${task.prompt}, 'queued')
      `;
      await tx`
        insert into run_events (id, run_id, sequence, event_type, payload)
        values (${eventId}, ${runId}, 1, 'run.queued', ${JSON.stringify({ scheduledTaskId: task.id })}::jsonb)
      `;
      await tx`update scheduled_tasks set next_run_at = ${nextRunAt}, updated_at = now() where id = ${task.id}`;
      await tx`
        insert into audit_logs (id, workspace_id, actor_user_id, action, target_type, target_id, redacted_input, result_summary)
        values (${uuidv7()}, ${task.workspace_id}, ${task.created_by}, 'scheduled_task.trigger', 'scheduled_task', ${task.id}, '{}'::jsonb, ${`run:${runId}`})
      `;
      runIds.push(runId);
    }
    return runIds;
  }) as Promise<string[]>;
}
