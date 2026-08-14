/**
 * @project LLMira
 * @file src/lib/mcp/tauriAdapter.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @function Tauri MCP 命令适配器
 * @description Rust 运行时负责 HTTP/STDIO 生命周期；前端只传已解密的瞬时秘密值。
 */
import { invoke } from "@tauri-apps/api/core";
import type { McpRuntimeAdapter } from "@/lib/mcp/runtime";
import type { McpRuntimeLogEntry, McpRuntimeSnapshot, McpToolDescriptor } from "@/lib/mcp/types";

export const tauriMcpRuntime: McpRuntimeAdapter = {
  connect: (input) => invoke<McpRuntimeSnapshot>("mcp_connect", { input }),
  disconnect: (serverId) => invoke<void>("mcp_disconnect", { serverId }),
  testConnection: (input) => invoke<McpRuntimeSnapshot>("mcp_test_connection", { input }),
  listTools: (input) => invoke<McpToolDescriptor[]>("mcp_list_tools", { input }),
  callTool: async (input, toolName, args, options) => {
    const onAbort = () => void invoke<void>("mcp_cancel_call", { callId: options.callId }).catch(() => undefined);
    options.signal?.addEventListener("abort", onAbort, { once: true });
    try {
      return await invoke("mcp_call_tool", { input, toolName, args, callId: options.callId, timeoutMs: options.timeoutMs });
    } finally {
      options.signal?.removeEventListener("abort", onAbort);
    }
  },
  cancelCall: (callId) => invoke<void>("mcp_cancel_call", { callId }),
  readLogs: (serverId) => invoke<McpRuntimeLogEntry[]>("mcp_read_logs", { serverId }),
};
