/**
 * @project LLMira
 * @file apps/api/src/store/types.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-13
 * @function
 *   - 定义团队服务的数据访问边界
 *   - 隔离 PostgreSQL 与测试内存实现
 * @description 路由只依赖本接口，所有租户校验在 Store 边界重复执行。
 */
import type {
  AgentRun,
  ApprovalRequest,
  AuditEntry,
  CursorPage,
  KnowledgeDocument,
  MigrationImport,
  McpServer,
  ProviderProfile,
  RunEvent,
  ScheduledTask,
  TeamInvitation,
  WorkspaceRole,
  WorkspaceUsageSummary,
} from "@llmira/contracts";

export interface Principal {
  userId: string;
  organizationId: string;
  organizationRole: "org_admin" | "member";
  email: string;
  displayName: string;
}

export interface UserCredential extends Principal {
  passwordHash: string;
}

export interface WorkspaceSummary {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
  updatedAt: string;
}

export interface BootstrapInput {
  organizationName: string;
  displayName: string;
  email: string;
  passwordHash: string;
}

export interface BootstrapResult {
  principal: Principal;
  workspace: WorkspaceSummary;
}

export interface CreateDocumentInput {
  workspaceId: string;
  name: string;
  mimeType: string;
  size: number;
  sourceType: "upload" | "url";
  sourceUrl?: string;
  objectKey?: string;
}

export interface CreateInvitationInput {
  organizationId: string;
  workspaceId?: string;
  email: string;
  role: Exclude<WorkspaceRole, "org_admin">;
  tokenHash: string;
  invitedBy: string;
  expiresAt: Date;
}

export interface UpsertProviderInput {
  id?: string;
  organizationId: string;
  workspaceId?: string;
  ownerUserId?: string;
  name: string;
  baseUrl: string;
  scope: "team" | "personal";
  encryptedSecret?: string;
  modelPreset: string[];
  enabled: boolean;
}

export interface ProviderCredential {
  id: string;
  baseUrl: string;
  encryptedSecret: string;
  models: string[];
  scope: "team" | "personal";
}

export interface CreateScheduledTaskInput {
  workspaceId: string;
  createdBy: string;
  name: string;
  cronExpression: string;
  timezone: string;
  prompt: string;
}

export interface UpsertMcpServerInput {
  id?: string;
  workspaceId: string;
  name: string;
  transport: McpServer["transport"];
  endpoint?: string;
  containerImage?: string;
  defaultRisk: McpServer["defaultRisk"];
  allowedDomains: string[];
  timeoutMs: number;
  outputLimitBytes: number;
  enabled: boolean;
}

export interface TeamStore {
  close(): Promise<void>;
  runAsUser<T>(userId: string, operation: () => Promise<T>): Promise<T>;
  isBootstrapped(): Promise<boolean>;
  bootstrap(input: BootstrapInput): Promise<BootstrapResult>;
  findUserByEmail(email: string): Promise<UserCredential | undefined>;
  findPrincipal(userId: string): Promise<Principal | undefined>;
  listWorkspaces(userId: string): Promise<WorkspaceSummary[]>;
  requireWorkspaceRole(userId: string, workspaceId: string, roles: WorkspaceRole[]): Promise<WorkspaceSummary>;
  storeRefreshSession(input: { id: string; userId: string; tokenHash: string; expiresAt: Date }): Promise<void>;
  rotateRefreshSession(input: { oldTokenHash: string; id: string; tokenHash: string; expiresAt: Date }): Promise<Principal | undefined>;
  revokeRefreshSession(tokenHash: string): Promise<void>;
  createInvitation(input: CreateInvitationInput): Promise<TeamInvitation>;
  acceptInvitation(input: { tokenHash: string; displayName: string; passwordHash: string }): Promise<BootstrapResult | undefined>;
  listProviderProfiles(organizationId: string, userId: string): Promise<ProviderProfile[]>;
  resolveProviderCredential(organizationId: string, userId: string, workspaceId?: string, providerId?: string): Promise<ProviderCredential | undefined>;
  upsertProviderProfile(input: UpsertProviderInput): Promise<ProviderProfile>;
  listMcpServers(workspaceId: string): Promise<McpServer[]>;
  upsertMcpServer(input: UpsertMcpServerInput): Promise<McpServer>;
  getMcpServer(id: string): Promise<McpServer | undefined>;
  listDocuments(workspaceId: string, cursor?: string, limit?: number): Promise<CursorPage<KnowledgeDocument>>;
  createDocument(input: CreateDocumentInput): Promise<KnowledgeDocument>;
  createRun(input: { workspaceId: string; requestedBy: string; title: string; prompt: string; model?: string; tools?: string[]; idempotencyKey?: string; comparisonId?: string }): Promise<AgentRun>;
  updateRunStatus(runId: string, status: AgentRun["status"]): Promise<void>;
  getRun(runId: string): Promise<AgentRun | undefined>;
  appendRunEvent(runId: string, type: RunEvent["type"], payload: Record<string, unknown>): Promise<RunEvent>;
  listRunEvents(runId: string, afterSequence?: number): Promise<RunEvent[]>;
  createApproval(input: Omit<ApprovalRequest, "id" | "requestedAt" | "status">): Promise<ApprovalRequest>;
  resolveApproval(input: { approvalId: string; userId: string; decision: "approved" | "rejected" }): Promise<ApprovalRequest | undefined>;
  appendAudit(input: Omit<AuditEntry, "id" | "createdAt">): Promise<AuditEntry>;
  listAudit(workspaceId: string, cursor?: string, limit?: number): Promise<CursorPage<AuditEntry>>;
  usageSummary(workspaceId: string): Promise<WorkspaceUsageSummary>;
  listScheduledTasks(workspaceId: string): Promise<ScheduledTask[]>;
  createScheduledTask(input: CreateScheduledTaskInput): Promise<ScheduledTask>;
  importLegacy(input: MigrationImport, userId: string): Promise<{ imported: number; duplicate: boolean }>;
  createModelComparison(input: { workspaceId: string; requestedBy: string; prompt: string; models: string[] }): Promise<string>;
}
