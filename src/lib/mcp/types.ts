/**
 * @project LLMira
 * @file src/lib/mcp/types.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @function 个人 MCP 配置、运行状态与聊天工具调用的共享类型
 * @description 配置对象只包含可持久化元数据；秘密值由运行时安全存储单独管理。
 */

export type McpTransport = "streamable_http" | "stdio";
export type McpAuthMode = "none" | "bearer" | "headers";
export type McpRuntimeStatus = "disconnected" | "connecting" | "connected" | "error";
export type McpToolApprovalStatus = "required" | "approved" | "rejected";
export type McpToolCallStatus = "pending" | "running" | "completed" | "failed" | "cancelled" | "rejected";

export interface McpNameValueEntry {
  id: string;
  name: string;
  /** 非敏感请求头可直接保存；敏感值仅在运行时注入。 */
  value?: string;
  sensitive?: boolean;
}

export interface McpServerConfig {
  id: string;
  name: string;
  description: string;
  transport: McpTransport;
  url: string;
  command: string;
  args: string[];
  cwd: string;
  env: McpNameValueEntry[];
  headers: McpNameValueEntry[];
  authMode: McpAuthMode;
  enabled: boolean;
  disabledTools: string[];
  timeoutSeconds: number;
  createdAt: number;
  updatedAt: number;
  /** 恢复备份后提示用户重新填写秘密值。 */
  secretsRequired?: boolean;
}

export interface McpToolDescriptor {
  serverId: string;
  serverName: string;
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  wireName: string;
  enabled: boolean;
}

export interface McpToolCall {
  id: string;
  wireName: string;
  serverId: string;
  serverName: string;
  toolName: string;
  argumentsText: string;
  arguments?: Record<string, unknown>;
  approval: McpToolApprovalStatus;
  status: McpToolCallStatus;
  resultSummary?: string;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

export interface McpRuntimeLogEntry {
  id: string;
  serverId: string;
  level: "info" | "warn" | "error";
  message: string;
  createdAt: number;
}

export interface McpRuntimeSnapshot {
  serverId: string;
  status: McpRuntimeStatus;
  fingerprint?: string;
  tools: McpToolDescriptor[];
  error?: string;
}

export interface McpConnectionInput {
  config: McpServerConfig;
  bearerToken?: string;
  sensitiveHeaders?: Record<string, string>;
  environment?: Record<string, string>;
}
