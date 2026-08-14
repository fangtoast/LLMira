/**
 * @project LLMira
 * @file src/lib/mcp/approval.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @function 将聊天工具卡片的人工批准操作桥接回当前执行循环
 * @description 决策仅存在于当前页面会话；不提供永久授权。
 */
type PendingApproval = {
  resolve: (approved: boolean) => void;
  cleanup: () => void;
};

const pending = new Map<string, PendingApproval>();

export function requestToolApproval(callId: string, signal?: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    const finish = (approved: boolean) => {
      const current = pending.get(callId);
      if (!current) return;
      pending.delete(callId);
      current.cleanup();
      resolve(approved);
    };
    const onAbort = () => finish(false);
    signal?.addEventListener("abort", onAbort, { once: true });
    pending.set(callId, {
      resolve: finish,
      cleanup: () => signal?.removeEventListener("abort", onAbort),
    });
    if (signal?.aborted) finish(false);
  });
}

export function resolveToolApproval(callId: string, approved: boolean): boolean {
  const current = pending.get(callId);
  if (!current) return false;
  current.resolve(approved);
  return true;
}

export function clearPendingToolApprovals(): void {
  for (const approval of [...pending.values()]) approval.resolve(false);
}
