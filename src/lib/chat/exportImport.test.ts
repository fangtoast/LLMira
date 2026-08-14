/**
 * @project LLMira
 * @file src/lib/chat/exportImport.test.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @description 全量备份 v2/v3 兼容与秘密字段剔除测试。
 */
import { describe, expect, it } from "vitest";
import { buildFullBackupPayload, parseImportedFullBackupJson } from "./exportImport";
import { useSettingsStore } from "@/lib/store/settingsStore";

describe("full backup v3", () => {
  it("继续接受 v2", () => {
    expect(parseImportedFullBackupJson(JSON.stringify({ version: 2, exportedAt: 1, chats: [] })).version).toBe(2);
  });

  it("导出聊天、非敏感设置并剔除 MCP 秘密值", () => {
    const now = Date.now();
    useSettingsStore.setState({ mcpServers: [{ id: "mcp-1", name: "test", description: "", transport: "streamable_http", url: "https://example.com/mcp", command: "", args: [], cwd: "", authMode: "headers", enabled: true, disabledTools: [], timeoutSeconds: 60, createdAt: now, updatedAt: now, env: [{ id: "env-1", name: "TOKEN", value: "secret-env", sensitive: true }], headers: [{ id: "header-1", name: "Authorization", value: "secret-header", sensitive: true }] }] });
    const payload = buildFullBackupPayload([], {}, useSettingsStore.getState());
    const serialized = JSON.stringify(payload);
    expect(payload.version).toBe(3);
    expect(serialized).not.toContain("secret-env");
    expect(serialized).not.toContain("secret-header");
  });
});
