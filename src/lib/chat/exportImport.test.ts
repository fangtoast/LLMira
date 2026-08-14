/**
 * @project LLMira
 * @file src/lib/chat/exportImport.test.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @description 全量备份 v2/v3/v4 兼容、用量与秘密字段剔除测试。
 */
import { describe, expect, it } from "vitest";
import { buildFullBackupPayload, parseImportedFullBackupJson } from "./exportImport";
import { useSettingsStore } from "@/lib/store/settingsStore";

describe("full backup v4", () => {
  it("继续接受 v2", () => {
    expect(parseImportedFullBackupJson(JSON.stringify({ version: 2, exportedAt: 1, chats: [] })).version).toBe(2);
  });

  it("继续接受 v3", () => {
    expect(parseImportedFullBackupJson(JSON.stringify({ version: 3, exportedAt: 1, chats: [], settings: {} })).version).toBe(3);
  });

  it("导入 v4 时丢弃用量事件中的未知敏感字段", () => {
    const imported = parseImportedFullBackupJson(JSON.stringify({ version: 4, exportedAt: 1, chats: [], settings: {}, usageEvents: [{ id: "u", operationId: "o", occurredAt: 1, kind: "chat", status: "completed", durationMs: 2, prompt: "secret prompt", headers: { Authorization: "secret" } }] }));
    expect(imported.version).toBe(4);
    if (imported.version !== 4) throw new Error("expected v4");
    expect(imported.usageEvents[0]).not.toHaveProperty("prompt");
    expect(imported.usageEvents[0]).not.toHaveProperty("headers");
  });

  it("导出聊天、非敏感设置并剔除 MCP 秘密值", () => {
    const now = Date.now();
    useSettingsStore.setState({ mcpServers: [{ id: "mcp-1", name: "test", description: "", transport: "streamable_http", url: "https://example.com/mcp", command: "", args: [], cwd: "", authMode: "headers", enabled: true, disabledTools: [], timeoutSeconds: 60, createdAt: now, updatedAt: now, env: [{ id: "env-1", name: "TOKEN", value: "secret-env", sensitive: true }], headers: [{ id: "header-1", name: "Authorization", value: "secret-header", sensitive: true }] }] });
    const payload = buildFullBackupPayload([], {}, useSettingsStore.getState(), [{ id: "usage-1", operationId: "op-1", occurredAt: now, kind: "mcp", status: "completed", durationMs: 10, tokenDataAvailable: false, pricingSource: "unknown", mcp: { serverId: "mcp-1", serverName: "test", toolName: "read" } }]);
    const serialized = JSON.stringify(payload);
    expect(payload.version).toBe(4);
    expect(payload.usageEvents).toHaveLength(1);
    expect(serialized).not.toContain("secret-env");
    expect(serialized).not.toContain("secret-header");
  });
});
