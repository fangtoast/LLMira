/**
 * @project LLMira
 * @file src/lib/mcp/wireName.test.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @description MCP 协议线名长度、字符集和同名隔离测试。
 */
import { describe, expect, it } from "vitest";
import { createMcpToolWireName } from "./wireName";

describe("MCP tool wire name", () => {
  it("生成最长 63 字符的 ASCII 名称", () => {
    const value = createMcpToolWireName("服务器-一", "获取一段非常长的天气预报和实时空气质量信息".repeat(4));
    expect(value).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(value.length).toBeLessThanOrEqual(63);
  });

  it("同名工具按 serverId 隔离", () => {
    expect(createMcpToolWireName("server-a", "search")).not.toBe(createMcpToolWireName("server-b", "search"));
  });
});
