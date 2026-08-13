/**
 * @project LLMira
 * @file apps/api/src/store/memory.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-13
 * @function
 *   - 为 API 集成测试提供隔离的内存数据存储
 *   - 复现租户角色、授权与幂等迁移语义
 * @description 此实现不会用于生产启动，仅供 Fastify inject 测试。
 */
import { v7 as uuidv7 } from "uuid";
import type {
  AgentRun,
  ApprovalRequest,
  AuditEntry,
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
import type {
  BootstrapInput,
  BootstrapResult,
  CreateInvitationInput,
  CreateDocumentInput,
  CreateScheduledTaskInput,
  Principal,
  ProviderCredential,
  TeamStore,
  UpsertMcpServerInput,
  UpsertProviderInput,
  UserCredential,
  WorkspaceSummary,
} from "./types.js";

/** 测试专用内存 TeamStore。 */
export class MemoryTeamStore implements TeamStore {
  private credential?: UserCredential;
  private workspace?: WorkspaceSummary;
  private readonly sessions = new Map<string, string>();
  private readonly documents: KnowledgeDocument[] = [];
  private readonly runs = new Map<string, AgentRun>();
  private readonly events = new Map<string, RunEvent[]>();
  private readonly approvals = new Map<string, ApprovalRequest>();
  private readonly audits: AuditEntry[] = [];
  private readonly imports = new Set<string>();
  private readonly invitations = new Map<string, TeamInvitation & { tokenHash: string }>();
  private readonly providers = new Map<string, ProviderProfile>();
  private readonly providerSecrets = new Map<string, string>();
  private readonly scheduledTasks: ScheduledTask[] = [];
  private readonly mcpServers = new Map<string, McpServer>();

  async close(): Promise<void> {}

  async runAsUser<T>(_userId: string, operation: () => Promise<T>): Promise<T> {
    return operation();
  }

  async isBootstrapped(): Promise<boolean> {
    return Boolean(this.credential);
  }

  async bootstrap(input: BootstrapInput): Promise<BootstrapResult> {
    if (this.credential) throw new Error("BOOTSTRAP_ALREADY_COMPLETED");
    const organizationId = uuidv7();
    const userId = uuidv7();
    const workspaceId = uuidv7();
    this.credential = {
      userId,
      organizationId,
      organizationRole: "org_admin",
      email: input.email.toLowerCase(),
      displayName: input.displayName,
      passwordHash: input.passwordHash,
    };
    this.workspace = {
      id: workspaceId,
      organizationId,
      name: "团队知识库",
      slug: "team-knowledge",
      role: "workspace_owner",
      updatedAt: new Date().toISOString(),
    };
    return { principal: this.credential, workspace: this.workspace };
  }

  async findUserByEmail(email: string): Promise<UserCredential | undefined> {
    return this.credential?.email === email.toLowerCase() ? this.credential : undefined;
  }

  async findPrincipal(userId: string): Promise<Principal | undefined> {
    return this.credential?.userId === userId ? this.credential : undefined;
  }

  async listWorkspaces(userId: string): Promise<WorkspaceSummary[]> {
    return this.credential?.userId === userId && this.workspace ? [this.workspace] : [];
  }

  async requireWorkspaceRole(userId: string, workspaceId: string, roles: WorkspaceRole[]): Promise<WorkspaceSummary> {
    if (this.credential?.userId !== userId || this.workspace?.id !== workspaceId || !roles.includes(this.workspace.role)) {
      throw new Error("WORKSPACE_FORBIDDEN");
    }
    return this.workspace;
  }

  async storeRefreshSession(input: { tokenHash: string; userId: string }): Promise<void> {
    this.sessions.set(input.tokenHash, input.userId);
  }

  async rotateRefreshSession(input: { oldTokenHash: string; tokenHash: string }): Promise<Principal | undefined> {
    const userId = this.sessions.get(input.oldTokenHash);
    if (!userId) return undefined;
    this.sessions.delete(input.oldTokenHash);
    this.sessions.set(input.tokenHash, userId);
    return this.findPrincipal(userId);
  }

  async revokeRefreshSession(tokenHash: string): Promise<void> {
    this.sessions.delete(tokenHash);
  }

  async createInvitation(input: CreateInvitationInput): Promise<TeamInvitation> {
    const invitation: TeamInvitation & { tokenHash: string } = {
      id: uuidv7(),
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      email: input.email,
      role: input.role,
      status: "pending",
      expiresAt: input.expiresAt.toISOString(),
      createdAt: new Date().toISOString(),
      tokenHash: input.tokenHash,
    };
    this.invitations.set(input.tokenHash, invitation);
    return invitation;
  }

  async acceptInvitation(input: { tokenHash: string; displayName: string; passwordHash: string }): Promise<BootstrapResult | undefined> {
    const invitation = this.invitations.get(input.tokenHash);
    if (!invitation || invitation.status !== "pending" || new Date(invitation.expiresAt) <= new Date()) return undefined;
    const userId = uuidv7();
    const principal: UserCredential = {
      userId,
      organizationId: invitation.organizationId,
      organizationRole: "member",
      email: invitation.email,
      displayName: input.displayName,
      passwordHash: input.passwordHash,
    };
    this.credential = principal;
    this.invitations.set(input.tokenHash, { ...invitation, status: "accepted" });
    if (this.workspace) this.workspace = { ...this.workspace, role: invitation.role };
    return this.workspace ? { principal, workspace: this.workspace } : undefined;
  }

  async listProviderProfiles(organizationId: string, userId: string): Promise<ProviderProfile[]> {
    return [...this.providers.values()].filter((item) =>
      item.scope === "team" ? this.workspace?.organizationId === organizationId : item.ownerUserId === userId,
    );
  }

  async upsertProviderProfile(input: UpsertProviderInput): Promise<ProviderProfile> {
    const existing = input.id ? this.providers.get(input.id) : undefined;
    const now = new Date().toISOString();
    const provider: ProviderProfile = {
      id: input.id ?? uuidv7(),
      workspaceId: input.workspaceId,
      ownerUserId: input.ownerUserId,
      name: input.name,
      baseUrl: input.baseUrl,
      providerType: "openai_compatible",
      scope: input.scope,
      modelPreset: input.modelPreset,
      hasSecret: Boolean(input.encryptedSecret || existing?.hasSecret),
      enabled: input.enabled,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.providers.set(provider.id, provider);
    if (input.encryptedSecret) this.providerSecrets.set(provider.id, input.encryptedSecret);
    return provider;
  }

  async resolveProviderCredential(organizationId: string, userId: string, workspaceId?: string): Promise<ProviderCredential | undefined> {
    const profiles = await this.listProviderProfiles(organizationId, userId);
    const profile = profiles
      .filter((item) => item.enabled && (!item.workspaceId || item.workspaceId === workspaceId))
      .sort((left, right) => Number(right.ownerUserId === userId) - Number(left.ownerUserId === userId))
      .find((item) => this.providerSecrets.has(item.id));
    const encryptedSecret = profile ? this.providerSecrets.get(profile.id) : undefined;
    return profile && encryptedSecret ? {
      id: profile.id,
      baseUrl: profile.baseUrl,
      encryptedSecret,
      models: profile.modelPreset,
      scope: profile.scope,
    } : undefined;
  }

  async listMcpServers(workspaceId: string): Promise<McpServer[]> {
    return [...this.mcpServers.values()].filter((item) => item.workspaceId === workspaceId);
  }

  async upsertMcpServer(input: UpsertMcpServerInput): Promise<McpServer> {
    const existing = input.id ? this.mcpServers.get(input.id) : undefined;
    const now = new Date().toISOString();
    const { id, ...values } = input;
    const server: McpServer = { id: id ?? uuidv7(), createdAt: existing?.createdAt ?? now, updatedAt: now, ...values };
    this.mcpServers.set(server.id, server);
    return server;
  }

  async getMcpServer(id: string): Promise<McpServer | undefined> {
    return this.mcpServers.get(id);
  }

  async listDocuments(workspaceId: string) {
    return { items: this.documents.filter((item) => item.workspaceId === workspaceId) };
  }

  async createDocument(input: CreateDocumentInput): Promise<KnowledgeDocument> {
    const now = new Date().toISOString();
    const document: KnowledgeDocument = {
      id: uuidv7(),
      workspaceId: input.workspaceId,
      name: input.name,
      mimeType: input.mimeType,
      size: input.size,
      status: "queued",
      sourceType: input.sourceType,
      sourceUrl: input.sourceUrl,
      chunkCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.documents.unshift(document);
    return document;
  }

  async createRun(input: { workspaceId: string; requestedBy: string; title: string; prompt: string; model?: string; tools?: string[]; idempotencyKey?: string; comparisonId?: string }): Promise<AgentRun> {
    if (input.idempotencyKey) {
      const existing = [...this.runs.values()].find((run) => (run as AgentRun & { idempotencyKey?: string }).idempotencyKey === input.idempotencyKey && run.requestedBy === input.requestedBy);
      if (existing) return { ...existing, duplicate: true };
    }
    const now = new Date().toISOString();
    const run: AgentRun = { id: uuidv7(), status: "queued", createdAt: now, updatedAt: now, duplicate: false, ...input };
    this.runs.set(run.id, run);
    return run;
  }

  async updateRunStatus(runId: string, status: AgentRun["status"]): Promise<void> {
    const run = this.runs.get(runId);
    if (run) this.runs.set(runId, { ...run, status, updatedAt: new Date().toISOString() });
  }

  async getRun(runId: string): Promise<AgentRun | undefined> {
    return this.runs.get(runId);
  }

  async appendRunEvent(runId: string, type: RunEvent["type"], payload: Record<string, unknown>): Promise<RunEvent> {
    const current = this.events.get(runId) ?? [];
    const event: RunEvent = { id: uuidv7(), runId, sequence: current.length + 1, type, createdAt: new Date().toISOString(), payload };
    this.events.set(runId, [...current, event]);
    return event;
  }

  async listRunEvents(runId: string, afterSequence = 0): Promise<RunEvent[]> {
    return (this.events.get(runId) ?? []).filter((item) => item.sequence > afterSequence);
  }

  async createApproval(input: Omit<ApprovalRequest, "id" | "requestedAt" | "status">): Promise<ApprovalRequest> {
    const approval: ApprovalRequest = { id: uuidv7(), status: "pending", requestedAt: new Date().toISOString(), ...input };
    this.approvals.set(approval.id, approval);
    return approval;
  }

  async resolveApproval(input: { approvalId: string; userId: string; decision: "approved" | "rejected" }): Promise<ApprovalRequest | undefined> {
    const approval = this.approvals.get(input.approvalId);
    if (!approval || approval.status !== "pending") return undefined;
    const resolved: ApprovalRequest = { ...approval, status: input.decision, resolvedAt: new Date().toISOString(), resolvedBy: input.userId };
    this.approvals.set(resolved.id, resolved);
    return resolved;
  }

  async appendAudit(input: Omit<AuditEntry, "id" | "createdAt">): Promise<AuditEntry> {
    const audit: AuditEntry = { id: uuidv7(), createdAt: new Date().toISOString(), ...input };
    this.audits.unshift(audit);
    return audit;
  }

  async listAudit(workspaceId: string) {
    return { items: this.audits.filter((item) => item.workspaceId === workspaceId) };
  }

  async usageSummary(workspaceId: string): Promise<WorkspaceUsageSummary> {
    const runs = [...this.runs.values()].filter((run) => run.workspaceId === workspaceId);
    const usage = [...this.events.values()].flat().filter((event) => runs.some((run) => run.id === event.runId) && event.type === "run.completed");
    const inputTokens = usage.reduce((total, event) => total + Number((event.payload.usage as Record<string, unknown> | undefined)?.prompt_tokens ?? (event.payload.usage as Record<string, unknown> | undefined)?.input_tokens ?? 0), 0);
    const outputTokens = usage.reduce((total, event) => total + Number((event.payload.usage as Record<string, unknown> | undefined)?.completion_tokens ?? (event.payload.usage as Record<string, unknown> | undefined)?.output_tokens ?? 0), 0);
    return { runCount: runs.length, completedCount: runs.filter((run) => run.status === "completed").length, failedCount: runs.filter((run) => run.status === "failed").length, inputTokens, outputTokens, totalTokens: inputTokens + outputTokens };
  }

  async listScheduledTasks(workspaceId: string): Promise<ScheduledTask[]> {
    return this.scheduledTasks.filter((task) => task.workspaceId === workspaceId);
  }

  async createScheduledTask(input: CreateScheduledTaskInput): Promise<ScheduledTask> {
    const now = new Date().toISOString();
    const task: ScheduledTask = {
      id: uuidv7(),
      ...input,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    };
    this.scheduledTasks.push(task);
    return task;
  }

  async importLegacy(input: MigrationImport, userId: string): Promise<{ imported: number; duplicate: boolean }> {
    const key = `${userId}:${input.importId}`;
    if (this.imports.has(key)) return { imported: 0, duplicate: true };
    this.imports.add(key);
    return { imported: input.conversations.length, duplicate: false };
  }

  async createModelComparison(): Promise<string> {
    return uuidv7();
  }
}
