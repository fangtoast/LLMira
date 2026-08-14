/**
 * @project LLMira
 * @file packages/contracts/src/index.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-13
 * @function
 *   - 定义客户端、API、Worker 与 Tauri 共享的领域契约
 *   - 提供运行事件、授权、知识库与团队权限的稳定类型
 * @description 本包只包含可序列化契约，不承载数据库或运行时实现。
 */
import { z } from "zod";

export const workspaceRoleSchema = z.enum([
  "org_admin",
  "workspace_owner",
  "editor",
  "viewer",
]);
export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;

export const agentRunStatusSchema = z.enum([
  "queued",
  "running",
  "waiting_approval",
  "completed",
  "failed",
  "cancelled",
]);
export type AgentRunStatus = z.infer<typeof agentRunStatusSchema>;

export const toolRiskSchema = z.enum([
  "read",
  "write",
  "external_side_effect",
  "irreversible",
]);
export type ToolRisk = z.infer<typeof toolRiskSchema>;

export const runEventTypeSchema = z.enum([
  "run.queued",
  "run.started",
  "run.delta",
  "tool.started",
  "tool.completed",
  "approval.required",
  "approval.resolved",
  "run.completed",
  "run.failed",
  "run.cancelled",
]);
export type RunEventType = z.infer<typeof runEventTypeSchema>;

export interface RunEvent<TPayload = Record<string, unknown>> {
  id: string;
  runId: string;
  sequence: number;
  type: RunEventType;
  createdAt: string;
  payload: TPayload;
}

export interface ApprovalRequest {
  id: string;
  runId: string;
  toolName: string;
  risk: Exclude<ToolRisk, "read">;
  summary: string;
  redactedArguments: Record<string, unknown>;
  status: "pending" | "approved" | "rejected" | "expired";
  requestedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface Citation {
  id: string;
  documentId: string;
  documentName: string;
  chunkId: string;
  page?: number;
  section?: string;
  quote: string;
  score: number;
}

export interface KnowledgeDocument {
  id: string;
  workspaceId: string;
  name: string;
  mimeType: string;
  size: number;
  status: "queued" | "processing" | "ready" | "failed";
  sourceType: "upload" | "url";
  sourceUrl?: string;
  chunkCount: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export type ProviderProtocol = "openai_compatible";

export type ExecutionMode = "device" | "server";

export interface ModelSelection {
  providerId: string;
  modelId: string;
}

export interface ModelCapabilities {
  chat: boolean;
  vision: boolean;
  imageGeneration: boolean;
  reasoning: boolean;
  tools: boolean;
  nativeWebSearch: boolean;
}

export interface ProviderModel {
  providerId: string;
  id: string;
  name: string;
  capabilities: ModelCapabilities;
  contextWindow?: number;
  ownedBy?: string;
  source: "upstream" | "rule" | "manual";
}

export interface ProviderProfile {
  id: string;
  workspaceId?: string;
  ownerUserId?: string;
  name: string;
  baseUrl: string;
  providerType: ProviderProtocol;
  executionMode: ExecutionMode;
  scope: "team" | "personal";
  modelPreset: string[];
  hasSecret: boolean;
  enabled: boolean;
  scanStatus: "never" | "scanning" | "ready" | "failed";
  lastScannedAt?: string;
  scanError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WebCitation {
  id: string;
  index: number;
  title: string;
  url: string;
  snippet: string;
  fetchedAt: string;
}

export interface SearchProfile {
  id: string;
  name: string;
  provider: "searxng" | "tavily" | "brave";
  baseUrl?: string;
  enabled: boolean;
  hasSecret: boolean;
}

export interface Conversation {
  id: string;
  workspaceId?: string;
  title: string;
  defaultModel: ModelSelection;
  systemPrompt?: string;
  summary?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: "system" | "user" | "assistant" | "tool";
  content: unknown;
  status: "queued" | "streaming" | "completed" | "partial" | "failed" | "cancelled";
  actualModel?: ModelSelection;
  usage?: Record<string, number>;
  citations: WebCitation[];
  error?: string;
  createdAt: string;
}

export interface ChatTurn {
  id: string;
  conversationId: string;
  userMessageId: string;
  assistantMessageId?: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  selection: ModelSelection;
  generationSettings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ChatTurnEvent<TPayload = Record<string, unknown>> {
  id: string;
  turnId: string;
  sequence: number;
  type: "turn.queued" | "turn.started" | "turn.delta" | "turn.completed" | "turn.failed" | "turn.cancelled";
  payload: TPayload;
  createdAt: string;
}

export interface McpServer {
  id: string;
  workspaceId: string;
  name: string;
  transport: "streamable_http" | "stdio_container";
  endpoint?: string;
  containerImage?: string;
  defaultRisk: ToolRisk;
  allowedDomains: string[];
  timeoutMs: number;
  outputLimitBytes: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TeamInvitation {
  id: string;
  organizationId: string;
  workspaceId?: string;
  email: string;
  role: Exclude<WorkspaceRole, "org_admin">;
  status: "pending" | "accepted" | "expired";
  expiresAt: string;
  createdAt: string;
}

export interface ScheduledTask {
  id: string;
  workspaceId: string;
  createdBy: string;
  name: string;
  cronExpression: string;
  timezone: string;
  prompt: string;
  enabled: boolean;
  nextRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ModelComparison {
  id: string;
  workspaceId: string;
  prompt: string;
  runs: AgentRun[];
  createdAt: string;
}

export interface AgentRun {
  id: string;
  workspaceId: string;
  requestedBy: string;
  title: string;
  prompt: string;
  status: AgentRunStatus;
  model?: string;
  tools?: string[];
  duplicate?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEntry {
  id: string;
  workspaceId?: string;
  actorUserId?: string;
  action: string;
  targetType: string;
  targetId?: string;
  redactedInput: Record<string, unknown>;
  resultSummary?: string;
  createdAt: string;
}

export interface WorkspaceUsageSummary {
  runCount: number;
  completedCount: number;
  failedCount: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor?: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId?: string;
  };
}

export const createRunInputSchema = z.object({
  workspaceId: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
  prompt: z.string().trim().min(1).max(100_000),
  model: z.string().trim().max(200).optional(),
  tools: z.array(z.string().trim().min(1).max(200)).max(32).default([]),
  idempotencyKey: z.string().uuid().optional(),
});
export type CreateRunInput = z.infer<typeof createRunInputSchema>;

export const approvalDecisionSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
});
export type ApprovalDecision = z.infer<typeof approvalDecisionSchema>;

export const migrationImportSchema = z.object({
  workspaceId: z.string().uuid(),
  importId: z.string().min(8).max(200),
  conversations: z.array(
    z.object({
      id: z.string().min(1).max(200),
      title: z.string().max(300),
      model: z.string().max(200),
      createdAt: z.number().int().nonnegative(),
      updatedAt: z.number().int().nonnegative(),
      messages: z.array(z.record(z.string(), z.unknown())).max(20_000),
    }),
  ).max(5_000),
});
export type MigrationImport = z.infer<typeof migrationImportSchema>;
