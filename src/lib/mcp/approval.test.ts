/**
 * @project LLMira
 * @file src/lib/mcp/approval.test.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @description 工具人工批准、拒绝和取消测试。
 */
import { afterEach, describe, expect, it } from "vitest";
import { clearPendingToolApprovals, requestToolApproval, resolveToolApproval } from "./approval";

describe("MCP approval bridge", () => {
  afterEach(() => clearPendingToolApprovals());

  it("接受批准与拒绝", async () => {
    const approved = requestToolApproval("approve");
    expect(resolveToolApproval("approve", true)).toBe(true);
    await expect(approved).resolves.toBe(true);
    const rejected = requestToolApproval("reject");
    resolveToolApproval("reject", false);
    await expect(rejected).resolves.toBe(false);
  });

  it("AbortSignal 取消待审批调用", async () => {
    const controller = new AbortController();
    const result = requestToolApproval("cancel", controller.signal);
    controller.abort();
    await expect(result).resolves.toBe(false);
  });
});
