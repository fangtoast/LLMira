/**
 * @project LLMira
 * @file src/lib/mcp/runtime.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @function 统一 Web 与 Tauri MCP 运行时边界
 * @description 前端只依赖此适配器，不感知 SDK 或 Rust 命令细节。
 */
import { isTauriRuntime } from "@/lib/providers/runtime";
import type {
  McpConnectionInput,
  McpRuntimeLogEntry,
  McpRuntimeSnapshot,
  McpToolDescriptor,
} from "@/lib/mcp/types";

export interface McpCallOptions {
  callId: string;
  signal?: AbortSignal;
  timeoutMs: number;
}

export interface McpCallResult {
  content: unknown;
  isError: boolean;
  summary: string;
}

export interface McpRuntimeAdapter {
  connect(input: McpConnectionInput): Promise<McpRuntimeSnapshot>;
  disconnect(serverId: string): Promise<void>;
  testConnection(input: McpConnectionInput): Promise<McpRuntimeSnapshot>;
  listTools(input: McpConnectionInput): Promise<McpToolDescriptor[]>;
  callTool(input: McpConnectionInput, toolName: string, args: Record<string, unknown>, options: McpCallOptions): Promise<McpCallResult>;
  cancelCall(callId: string): Promise<void>;
  readLogs(serverId?: string): Promise<McpRuntimeLogEntry[]>;
}

let adapterPromise: Promise<McpRuntimeAdapter> | undefined;

export function getMcpRuntimeAdapter(): Promise<McpRuntimeAdapter> {
  adapterPromise ??= isTauriRuntime()
    ? import("@/lib/mcp/tauriAdapter").then((module) => module.tauriMcpRuntime)
    : import("@/lib/mcp/webAdapter").then((module) => module.webMcpRuntime);
  return adapterPromise;
}
