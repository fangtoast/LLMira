/**
 * @project LLMira
 * @file src/components/settings/McpSettings.test.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @description MCP 表单平台与连接字段校验测试。
 */
import { describe, expect, it } from "vitest";
import { validateMcpServerConfig } from "./McpSettings";
import type { McpServerConfig } from "@/lib/mcp/types";

const base: McpServerConfig = { id: "one", name: "One", description: "", transport: "streamable_http", url: "https://example.com/mcp", command: "", args: [], cwd: "", env: [], headers: [], authMode: "none", enabled: true, disabledTools: [], timeoutSeconds: 60, createdAt: 1, updatedAt: 1 };

describe("MCP settings validation", () => {
  it("拒绝无效 URL 和超时", () => {
    expect(validateMcpServerConfig({ ...base, url: "file:///tmp/mcp" }, false)).toContain("HTTP");
    expect(validateMcpServerConfig({ ...base, timeoutSeconds: 601 }, false)).toContain("5–600");
  });

  it("在 Web 禁用 STDIO，并要求桌面命令", () => {
    const stdio = { ...base, transport: "stdio" as const, url: "" };
    expect(validateMcpServerConfig(stdio, false)).toContain("不支持 STDIO");
    expect(validateMcpServerConfig(stdio, true)).toContain("启动命令");
  });
});
