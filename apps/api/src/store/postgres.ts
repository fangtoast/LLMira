/**
 * @project LLMira
 * @file apps/api/src/store/postgres.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-13
 * @function
 *   - 实现 PostgreSQL 团队数据访问与事务
 *   - 在查询入口设置用户上下文并执行工作区角色校验
 * @description 使用参数化 SQL、游标分页和显式租户条件；RLS 作为第二道隔离边界。
 */
import { AsyncLocalStorage } from "node:async_hooks";
import postgres, { type Sql } from "postgres";
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

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

/** PostgreSQL-backed team store. */
export class PostgresTeamStore implements TeamStore {
  private readonly pool: Sql;
  private readonly transactionContext = new AsyncLocalStorage<Sql>();

  private get sql(): Sql {
    return this.transactionContext.getStore() ?? this.pool;
  }

  constructor(databaseUrl: string) {
    this.pool = postgres(databaseUrl, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });
  }

  async close(): Promise<void> {
    await this.pool.end({ timeout: 5 });
  }

  async runAsUser<T>(userId: string, operation: () => Promise<T>): Promise<T> {
    return this.pool.begin(async (transaction) => {
      await transaction.unsafe("set local role llmira_app");
      await transaction`select set_config('app.current_user_id', ${userId}, true)`;
      return this.transactionContext.run(transaction as unknown as Sql, operation);
    }) as Promise<T>;
  }

  async isBootstrapped(): Promise<boolean> {
    const [row] = await this.sql<{ count: number }[]>`select count(*)::int as count from organizations`;
    return (row?.count ?? 0) > 0;
  }

  async bootstrap(input: BootstrapInput): Promise<BootstrapResult> {
    return this.sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(781109934)`;
      const [{ count }] = await tx<{ count: number }[]>`select count(*)::int as count from organizations`;
      if (count > 0) throw new Error("BOOTSTRAP_ALREADY_COMPLETED");
      const organizationId = uuidv7();
      const userId = uuidv7();
      const workspaceId = uuidv7();
      const now = new Date();
      await tx`insert into organizations (id, name, created_at, updated_at) values (${organizationId}, ${input.organizationName}, ${now}, ${now})`;
      await tx`insert into users (id, email, display_name, password_hash, created_at, updated_at) values (${userId}, ${input.email.toLowerCase()}, ${input.displayName}, ${input.passwordHash}, ${now}, ${now})`;
      await tx`insert into organization_members (organization_id, user_id, role, created_at) values (${organizationId}, ${userId}, 'org_admin', ${now})`;
      await tx`insert into workspaces (id, organization_id, name, slug, created_at, updated_at) values (${workspaceId}, ${organizationId}, '团队知识库', 'team-knowledge', ${now}, ${now})`;
      await tx`insert into workspace_members (workspace_id, user_id, role, created_at) values (${workspaceId}, ${userId}, 'workspace_owner', ${now})`;
      return {
        principal: {
          userId,
          organizationId,
          organizationRole: "org_admin",
          email: input.email.toLowerCase(),
          displayName: input.displayName,
        },
        workspace: {
          id: workspaceId,
          organizationId,
          name: "团队知识库",
          slug: "team-knowledge",
          role: "workspace_owner",
          updatedAt: now.toISOString(),
        },
      };
    });
  }

  async findUserByEmail(email: string): Promise<UserCredential | undefined> {
    const [row] = await this.sql<{
      user_id: string;
      organization_id: string;
      organization_role: "org_admin" | "member";
      email: string;
      display_name: string;
      password_hash: string;
    }[]>`
      select u.id as user_id, om.organization_id, om.role as organization_role,
             u.email, u.display_name, u.password_hash
      from users u
      join organization_members om on om.user_id = u.id
      where lower(u.email) = lower(${email}) and u.disabled_at is null
      limit 1
    `;
    if (!row) return undefined;
    return {
      userId: row.user_id,
      organizationId: row.organization_id,
      organizationRole: row.organization_role,
      email: row.email,
      displayName: row.display_name,
      passwordHash: row.password_hash,
    };
  }

  async findPrincipal(userId: string): Promise<Principal | undefined> {
    const [row] = await this.sql<{
      user_id: string;
      organization_id: string;
      organization_role: "org_admin" | "member";
      email: string;
      display_name: string;
    }[]>`
      select u.id as user_id, om.organization_id, om.role as organization_role,
             u.email, u.display_name
      from users u join organization_members om on om.user_id = u.id
      where u.id = ${userId} and u.disabled_at is null limit 1
    `;
    return row ? {
      userId: row.user_id,
      organizationId: row.organization_id,
      organizationRole: row.organization_role,
      email: row.email,
      displayName: row.display_name,
    } : undefined;
  }

  async listWorkspaces(userId: string): Promise<WorkspaceSummary[]> {
    const rows = await this.sql<{
      id: string; organization_id: string; name: string; slug: string; role: WorkspaceRole; updated_at: Date;
    }[]>`
      select w.id, w.organization_id, w.name, w.slug,
             case when om.role = 'org_admin' then 'org_admin' else wm.role::text end as role,
             w.updated_at
      from workspaces w
      join organization_members om on om.organization_id = w.organization_id and om.user_id = ${userId}
      left join workspace_members wm on wm.workspace_id = w.id and wm.user_id = ${userId}
      where om.role = 'org_admin' or wm.user_id is not null
      order by w.updated_at desc, w.id desc
    `;
    return rows.map((row) => ({ ...row, organizationId: row.organization_id, updatedAt: iso(row.updated_at) }));
  }

  async requireWorkspaceRole(userId: string, workspaceId: string, roles: WorkspaceRole[]): Promise<WorkspaceSummary> {
    const workspaces = await this.listWorkspaces(userId);
    const workspace = workspaces.find((item) => item.id === workspaceId && roles.includes(item.role));
    if (!workspace) throw new Error("WORKSPACE_FORBIDDEN");
    return workspace;
  }

  async storeRefreshSession(input: { id: string; userId: string; tokenHash: string; expiresAt: Date }): Promise<void> {
    await this.sql`insert into refresh_sessions (id, user_id, token_hash, expires_at) values (${input.id}, ${input.userId}, ${input.tokenHash}, ${input.expiresAt})`;
  }

  async rotateRefreshSession(input: { oldTokenHash: string; id: string; tokenHash: string; expiresAt: Date }): Promise<Principal | undefined> {
    return this.sql.begin(async (tx) => {
      const [session] = await tx<{ id: string; user_id: string }[]>`
        update refresh_sessions set revoked_at = now()
        where token_hash = ${input.oldTokenHash} and revoked_at is null and expires_at > now()
        returning id, user_id
      `;
      if (!session) return undefined;
      await tx`insert into refresh_sessions (id, user_id, token_hash, expires_at, rotated_from_id) values (${input.id}, ${session.user_id}, ${input.tokenHash}, ${input.expiresAt}, ${session.id})`;
      const [row] = await tx<{
        user_id: string; organization_id: string; organization_role: "org_admin" | "member"; email: string; display_name: string;
      }[]>`
        select u.id as user_id, om.organization_id, om.role as organization_role, u.email, u.display_name
        from users u join organization_members om on om.user_id = u.id where u.id = ${session.user_id} limit 1
      `;
      return row ? { userId: row.user_id, organizationId: row.organization_id, organizationRole: row.organization_role, email: row.email, displayName: row.display_name } : undefined;
    });
  }

  async revokeRefreshSession(tokenHash: string): Promise<void> {
    await this.sql`update refresh_sessions set revoked_at = coalesce(revoked_at, now()) where token_hash = ${tokenHash}`;
  }

  async createInvitation(input: CreateInvitationInput): Promise<TeamInvitation> {
    const [row] = await this.sql<any[]>`
      insert into invitations (id, organization_id, workspace_id, email, role, token_hash, invited_by, expires_at)
      values (${uuidv7()}, ${input.organizationId}, ${input.workspaceId ?? null}, ${input.email.toLowerCase()}, ${input.role}, ${input.tokenHash}, ${input.invitedBy}, ${input.expiresAt})
      returning *
    `;
    return this.mapInvitation(row);
  }

  async acceptInvitation(input: { tokenHash: string; displayName: string; passwordHash: string }): Promise<BootstrapResult | undefined> {
    return this.sql.begin(async (tx) => {
      const [invitation] = await tx<any[]>`
        update invitations set accepted_at = now()
        where token_hash = ${input.tokenHash} and accepted_at is null and expires_at > now()
        returning *
      `;
      if (!invitation) return undefined;
      const userId = uuidv7();
      await tx`
        insert into users (id, email, display_name, password_hash)
        values (${userId}, ${invitation.email}, ${input.displayName}, ${input.passwordHash})
      `;
      await tx`
        insert into organization_members (organization_id, user_id, role)
        values (${invitation.organization_id}, ${userId}, 'member')
      `;
      const workspaceId = invitation.workspace_id as string | null;
      if (workspaceId) {
        await tx`
          insert into workspace_members (workspace_id, user_id, role)
          values (${workspaceId}, ${userId}, ${invitation.role})
        `;
      }
      const [workspace] = workspaceId
        ? await tx<{ id: string; organization_id: string; name: string; slug: string; updated_at: Date }[]>`
            select id, organization_id, name, slug, updated_at from workspaces where id = ${workspaceId}
          `
        : await tx<{ id: string; organization_id: string; name: string; slug: string; updated_at: Date }[]>`
            select id, organization_id, name, slug, updated_at from workspaces
            where organization_id = ${invitation.organization_id}
            order by updated_at desc limit 1
          `;
      if (!workspace) throw new Error("INVITATION_WORKSPACE_MISSING");
      return {
        principal: {
          userId,
          organizationId: invitation.organization_id,
          organizationRole: "member",
          email: invitation.email,
          displayName: input.displayName,
        },
        workspace: {
          id: workspace.id,
          organizationId: workspace.organization_id,
          name: workspace.name,
          slug: workspace.slug,
          role: invitation.role,
          updatedAt: iso(workspace.updated_at),
        },
      };
    });
  }

  async listProviderProfiles(organizationId: string, userId: string): Promise<ProviderProfile[]> {
    const rows = await this.sql<any[]>`
      select * from provider_profiles
      where organization_id = ${organizationId}
        and enabled = true
        and (scope = 'team' or owner_user_id = ${userId})
      order by case when owner_user_id = ${userId} then 0 else 1 end, updated_at desc
    `;
    return rows.map((row) => this.mapProvider(row));
  }

  async upsertProviderProfile(input: UpsertProviderInput): Promise<ProviderProfile> {
    const id = input.id ?? uuidv7();
    const [row] = await this.sql<any[]>`
      insert into provider_profiles (
        id, organization_id, workspace_id, owner_user_id, name, base_url,
        provider_type, execution_mode, scope, encrypted_secret, model_preset, enabled,
        scan_status, last_scanned_at, scan_error
      ) values (
        ${id}, ${input.organizationId}, ${input.workspaceId ?? null}, ${input.ownerUserId ?? null},
        ${input.name}, ${input.baseUrl}, 'openai_compatible', 'server', ${input.scope},
        ${input.encryptedSecret ?? null}, ${JSON.stringify(input.modelPreset)}::jsonb, ${input.enabled},
        ${input.modelPreset.length ? "ready" : "never"}, ${input.modelPreset.length ? new Date() : null}, null
      )
      on conflict (id) do update set
        name = excluded.name,
        base_url = excluded.base_url,
        encrypted_secret = coalesce(excluded.encrypted_secret, provider_profiles.encrypted_secret),
        model_preset = excluded.model_preset,
        enabled = excluded.enabled,
        scan_status = case when jsonb_array_length(excluded.model_preset) > 0 then 'ready' else provider_profiles.scan_status end,
        last_scanned_at = case when jsonb_array_length(excluded.model_preset) > 0 then now() else provider_profiles.last_scanned_at end,
        scan_error = null,
        updated_at = now()
      returning *
    `;
    return this.mapProvider(row);
  }

  async resolveProviderCredential(organizationId: string, userId: string, workspaceId?: string, providerId?: string): Promise<ProviderCredential | undefined> {
    const [row] = await this.sql<{
      id: string;
      base_url: string;
      encrypted_secret: string;
      model_preset: string[];
      scope: "team" | "personal";
    }[]>`
      select id, base_url, encrypted_secret, model_preset, scope
      from provider_profiles
      where organization_id = ${organizationId}
        and enabled = true
        and encrypted_secret is not null
        and (${providerId ?? null}::uuid is null or id = ${providerId ?? null})
        and (workspace_id is null or workspace_id = ${workspaceId ?? null})
        and (owner_user_id = ${userId} or (scope = 'team' and owner_user_id is null))
      order by (owner_user_id = ${userId}) desc, updated_at desc
      limit 1
    `;
    return row ? {
      id: row.id,
      baseUrl: row.base_url,
      encryptedSecret: row.encrypted_secret,
      models: row.model_preset,
      scope: row.scope,
    } : undefined;
  }

  async listMcpServers(workspaceId: string): Promise<McpServer[]> {
    const rows = await this.sql<any[]>`select * from mcp_servers where workspace_id = ${workspaceId} order by updated_at desc, id desc`;
    return rows.map((row) => this.mapMcpServer(row));
  }

  async upsertMcpServer(input: UpsertMcpServerInput): Promise<McpServer> {
    const id = input.id ?? uuidv7();
    const [row] = await this.sql<any[]>`
      insert into mcp_servers (id, workspace_id, name, transport, endpoint, container_image, default_risk, allowed_domains, timeout_ms, output_limit_bytes, enabled)
      values (${id}, ${input.workspaceId}, ${input.name}, ${input.transport}, ${input.endpoint ?? null}, ${input.containerImage ?? null}, ${input.defaultRisk}, ${input.allowedDomains}, ${input.timeoutMs}, ${input.outputLimitBytes}, ${input.enabled})
      on conflict (id) do update set name = excluded.name, transport = excluded.transport,
        endpoint = excluded.endpoint, container_image = excluded.container_image,
        default_risk = excluded.default_risk, allowed_domains = excluded.allowed_domains,
        timeout_ms = excluded.timeout_ms, output_limit_bytes = excluded.output_limit_bytes,
        enabled = excluded.enabled, updated_at = now()
      returning *
    `;
    return this.mapMcpServer(row);
  }

  async getMcpServer(id: string): Promise<McpServer | undefined> {
    const [row] = await this.sql<any[]>`select * from mcp_servers where id = ${id}`;
    return row ? this.mapMcpServer(row) : undefined;
  }

  async listDocuments(workspaceId: string, cursor?: string, limit = 50) {
    const safeLimit = Math.min(100, Math.max(1, limit));
    const cursorDate = cursor ? new Date(Buffer.from(cursor, "base64url").toString("utf8")) : undefined;
    const rows = cursorDate
      ? await this.sql<any[]>`select * from knowledge_documents where workspace_id = ${workspaceId} and updated_at < ${cursorDate} order by updated_at desc, id desc limit ${safeLimit + 1}`
      : await this.sql<any[]>`select * from knowledge_documents where workspace_id = ${workspaceId} order by updated_at desc, id desc limit ${safeLimit + 1}`;
    const hasMore = rows.length > safeLimit;
    const items = rows.slice(0, safeLimit).map((row) => this.mapDocument(row));
    return { items, nextCursor: hasMore ? Buffer.from(items.at(-1)!.updatedAt).toString("base64url") : undefined };
  }

  async createDocument(input: CreateDocumentInput): Promise<KnowledgeDocument> {
    const id = uuidv7();
    const [row] = await this.sql<any[]>`
      insert into knowledge_documents (id, workspace_id, name, mime_type, size_bytes, status, source_type, source_url, object_key)
      values (${id}, ${input.workspaceId}, ${input.name}, ${input.mimeType}, ${input.size}, 'queued', ${input.sourceType}, ${input.sourceUrl ?? null}, ${input.objectKey ?? null})
      returning *
    `;
    return this.mapDocument(row);
  }

  async createRun(input: { workspaceId: string; requestedBy: string; title: string; prompt: string; model?: string; tools?: string[]; idempotencyKey?: string; comparisonId?: string }): Promise<AgentRun> {
    const id = uuidv7();
    const [row] = await this.sql<any[]>`
      insert into agent_runs (id, workspace_id, requested_by, client_request_id, comparison_id, title, prompt, status, model, tools)
      values (${id}, ${input.workspaceId}, ${input.requestedBy}, ${input.idempotencyKey ?? null}, ${input.comparisonId ?? null}, ${input.title}, ${input.prompt}, 'queued', ${input.model ?? null}, ${JSON.stringify(input.tools ?? [])}::jsonb)
      on conflict (requested_by, client_request_id) where client_request_id is not null do update set id = agent_runs.id
      returning *, (xmax = 0) as inserted
    `;
    return this.mapRun(row);
  }

  async updateRunStatus(runId: string, status: AgentRun["status"]): Promise<void> {
    await this.sql`update agent_runs set status = ${status}, updated_at = now() where id = ${runId}`;
  }

  async getRun(runId: string): Promise<AgentRun | undefined> {
    const [row] = await this.sql<any[]>`select * from agent_runs where id = ${runId}`;
    return row ? this.mapRun(row) : undefined;
  }

  async appendRunEvent(runId: string, type: RunEvent["type"], payload: Record<string, unknown>): Promise<RunEvent> {
    const [row] = await this.sql<any[]>`
      insert into run_events (id, run_id, sequence, event_type, payload)
      values (${uuidv7()}, ${runId}, (select coalesce(max(sequence), 0) + 1 from run_events where run_id = ${runId}), ${type}, ${JSON.stringify(payload)}::jsonb) returning *
    `;
    return { id: row.id, runId: row.run_id, sequence: row.sequence, type: row.event_type, createdAt: iso(row.created_at), payload: row.payload };
  }

  async listRunEvents(runId: string, afterSequence = 0): Promise<RunEvent[]> {
    const rows = await this.sql<any[]>`select * from run_events where run_id = ${runId} and sequence > ${afterSequence} order by sequence asc`;
    return rows.map((row) => ({ id: row.id, runId: row.run_id, sequence: row.sequence, type: row.event_type, createdAt: iso(row.created_at), payload: row.payload }));
  }

  async createApproval(input: Omit<ApprovalRequest, "id" | "requestedAt" | "status">): Promise<ApprovalRequest> {
    const [row] = await this.sql<any[]>`
      insert into approval_requests (id, run_id, tool_name, risk, summary, redacted_arguments, status)
      values (${uuidv7()}, ${input.runId}, ${input.toolName}, ${input.risk}, ${input.summary}, ${JSON.stringify(input.redactedArguments)}::jsonb, 'pending') returning *
    `;
    return this.mapApproval(row);
  }

  async resolveApproval(input: { approvalId: string; userId: string; decision: "approved" | "rejected" }): Promise<ApprovalRequest | undefined> {
    const [row] = await this.sql<any[]>`
      update approval_requests set status = ${input.decision}, resolved_at = now(), resolved_by = ${input.userId}
      where id = ${input.approvalId} and status = 'pending' returning *
    `;
    return row ? this.mapApproval(row) : undefined;
  }

  async appendAudit(input: Omit<AuditEntry, "id" | "createdAt">): Promise<AuditEntry> {
    const [row] = await this.sql<any[]>`
      insert into audit_logs (id, workspace_id, actor_user_id, action, target_type, target_id, redacted_input, result_summary)
      values (${uuidv7()}, ${input.workspaceId ?? null}, ${input.actorUserId ?? null}, ${input.action}, ${input.targetType}, ${input.targetId ?? null}, ${JSON.stringify(input.redactedInput)}::jsonb, ${input.resultSummary ?? null}) returning *
    `;
    return this.mapAudit(row);
  }

  async listAudit(workspaceId: string, cursor?: string, limit = 50) {
    const safeLimit = Math.min(100, Math.max(1, limit));
    const cursorDate = cursor ? new Date(Buffer.from(cursor, "base64url").toString("utf8")) : undefined;
    const rows = cursorDate
      ? await this.sql<any[]>`select * from audit_logs where workspace_id = ${workspaceId} and created_at < ${cursorDate} order by created_at desc, id desc limit ${safeLimit + 1}`
      : await this.sql<any[]>`select * from audit_logs where workspace_id = ${workspaceId} order by created_at desc, id desc limit ${safeLimit + 1}`;
    const hasMore = rows.length > safeLimit;
    const items = rows.slice(0, safeLimit).map((row) => this.mapAudit(row));
    return { items, nextCursor: hasMore ? Buffer.from(items.at(-1)!.createdAt).toString("base64url") : undefined };
  }

  async usageSummary(workspaceId: string): Promise<WorkspaceUsageSummary> {
    const [row] = await this.sql<{
      run_count: number;
      completed_count: number;
      failed_count: number;
      input_tokens: number;
      output_tokens: number;
    }[]>`
      select
        count(distinct r.id)::int as run_count,
        count(distinct r.id) filter (where r.status = 'completed')::int as completed_count,
        count(distinct r.id) filter (where r.status = 'failed')::int as failed_count,
        coalesce(sum(case when e.event_type = 'run.completed' then coalesce((e.payload->'usage'->>'prompt_tokens')::bigint, (e.payload->'usage'->>'input_tokens')::bigint, 0) else 0 end), 0)::bigint as input_tokens,
        coalesce(sum(case when e.event_type = 'run.completed' then coalesce((e.payload->'usage'->>'completion_tokens')::bigint, (e.payload->'usage'->>'output_tokens')::bigint, 0) else 0 end), 0)::bigint as output_tokens
      from agent_runs r left join run_events e on e.run_id = r.id
      where r.workspace_id = ${workspaceId}
    `;
    const inputTokens = Number(row?.input_tokens ?? 0);
    const outputTokens = Number(row?.output_tokens ?? 0);
    return { runCount: row?.run_count ?? 0, completedCount: row?.completed_count ?? 0, failedCount: row?.failed_count ?? 0, inputTokens, outputTokens, totalTokens: inputTokens + outputTokens };
  }

  async listScheduledTasks(workspaceId: string): Promise<ScheduledTask[]> {
    const rows = await this.sql<any[]>`
      select * from scheduled_tasks where workspace_id = ${workspaceId}
      order by updated_at desc, id desc
    `;
    return rows.map((row) => this.mapScheduledTask(row));
  }

  async createScheduledTask(input: CreateScheduledTaskInput): Promise<ScheduledTask> {
    const [row] = await this.sql<any[]>`
      insert into scheduled_tasks (
        id, workspace_id, created_by, name, cron_expression, timezone, prompt, enabled
      ) values (
        ${uuidv7()}, ${input.workspaceId}, ${input.createdBy}, ${input.name},
        ${input.cronExpression}, ${input.timezone}, ${input.prompt}, true
      ) returning *
    `;
    return this.mapScheduledTask(row);
  }

  async importLegacy(input: MigrationImport, userId: string): Promise<{ imported: number; duplicate: boolean }> {
    const operation = async (tx: Sql): Promise<{ imported: number; duplicate: boolean }> => {
      const [existing] = await tx<{ id: string }[]>`select id from migration_imports where import_id = ${input.importId} and user_id = ${userId}`;
      if (existing) return { imported: 0, duplicate: true };
      for (const conversation of input.conversations) {
        const conversationId = uuidv7();
        await tx`
          insert into conversations (id, workspace_id, owner_user_id, title, model, created_at, updated_at)
          values (${conversationId}, ${input.workspaceId}, ${userId}, ${conversation.title}, ${conversation.model}, ${new Date(conversation.createdAt)}, ${new Date(conversation.updatedAt)})
        `;
        for (const message of conversation.messages) {
          const candidateRole = typeof message.role === "string" ? message.role : "user";
          const role = ["system", "user", "assistant", "tool"].includes(candidateRole) ? candidateRole : "user";
          const createdAt = typeof message.createdAt === "number" ? new Date(message.createdAt) : new Date(conversation.createdAt);
          await tx`
            insert into messages (id, conversation_id, role, content, created_at)
            values (${uuidv7()}, ${conversationId}, ${role}, ${JSON.stringify(message)}::jsonb, ${createdAt})
          `;
        }
      }
      await tx`insert into migration_imports (id, import_id, user_id, workspace_id, imported_count) values (${uuidv7()}, ${input.importId}, ${userId}, ${input.workspaceId}, ${input.conversations.length})`;
      return { imported: input.conversations.length, duplicate: false };
    };
    const scopedTransaction = this.transactionContext.getStore();
    if (scopedTransaction) return operation(scopedTransaction);
    return this.pool.begin(async (transaction) => operation(transaction as unknown as Sql)) as Promise<{ imported: number; duplicate: boolean }>;
  }

  async createModelComparison(input: { workspaceId: string; requestedBy: string; prompt: string; models: string[] }): Promise<string> {
    const id = uuidv7();
    await this.sql`
      insert into model_comparisons (id, workspace_id, requested_by, prompt, models)
      values (${id}, ${input.workspaceId}, ${input.requestedBy}, ${input.prompt}, ${JSON.stringify(input.models)}::jsonb)
    `;
    return id;
  }

  private mapDocument(row: any): KnowledgeDocument {
    return { id: row.id, workspaceId: row.workspace_id, name: row.name, mimeType: row.mime_type, size: Number(row.size_bytes), status: row.status, sourceType: row.source_type, sourceUrl: row.source_url ?? undefined, chunkCount: Number(row.chunk_count ?? 0), errorMessage: row.error_message ?? undefined, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) };
  }

  private mapRun(row: any): AgentRun {
    return { id: row.id, workspaceId: row.workspace_id, requestedBy: row.requested_by, title: row.title, prompt: row.prompt, status: row.status, model: row.model ?? undefined, tools: row.tools ?? [], duplicate: row.inserted === undefined ? undefined : !row.inserted, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) };
  }

  private mapApproval(row: any): ApprovalRequest {
    return { id: row.id, runId: row.run_id, toolName: row.tool_name, risk: row.risk, summary: row.summary, redactedArguments: row.redacted_arguments, status: row.status, requestedAt: iso(row.requested_at), resolvedAt: row.resolved_at ? iso(row.resolved_at) : undefined, resolvedBy: row.resolved_by ?? undefined };
  }

  private mapAudit(row: any): AuditEntry {
    return { id: row.id, workspaceId: row.workspace_id ?? undefined, actorUserId: row.actor_user_id ?? undefined, action: row.action, targetType: row.target_type, targetId: row.target_id ?? undefined, redactedInput: row.redacted_input, resultSummary: row.result_summary ?? undefined, createdAt: iso(row.created_at) };
  }

  private mapInvitation(row: any): TeamInvitation {
    return {
      id: row.id,
      organizationId: row.organization_id,
      workspaceId: row.workspace_id ?? undefined,
      email: row.email,
      role: row.role,
      status: row.accepted_at ? "accepted" : new Date(row.expires_at) <= new Date() ? "expired" : "pending",
      expiresAt: iso(row.expires_at),
      createdAt: iso(row.created_at),
    };
  }

  private mapProvider(row: any): ProviderProfile {
    return {
      id: row.id,
      workspaceId: row.workspace_id ?? undefined,
      ownerUserId: row.owner_user_id ?? undefined,
      name: row.name,
      baseUrl: row.base_url,
      providerType: row.provider_type,
      executionMode: row.execution_mode ?? "server",
      scope: row.scope,
      modelPreset: row.model_preset,
      hasSecret: Boolean(row.encrypted_secret),
      enabled: row.enabled,
      scanStatus: row.scan_status ?? (row.model_preset?.length ? "ready" : "never"),
      lastScannedAt: row.last_scanned_at ? iso(row.last_scanned_at) : undefined,
      scanError: row.scan_error ?? undefined,
      createdAt: iso(row.created_at),
      updatedAt: iso(row.updated_at),
    };
  }

  private mapScheduledTask(row: any): ScheduledTask {
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      createdBy: row.created_by,
      name: row.name,
      cronExpression: row.cron_expression,
      timezone: row.timezone,
      prompt: row.prompt,
      enabled: row.enabled,
      nextRunAt: row.next_run_at ? iso(row.next_run_at) : undefined,
      createdAt: iso(row.created_at),
      updatedAt: iso(row.updated_at),
    };
  }

  private mapMcpServer(row: any): McpServer {
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      name: row.name,
      transport: row.transport,
      endpoint: row.endpoint ?? undefined,
      containerImage: row.container_image ?? undefined,
      defaultRisk: row.default_risk,
      allowedDomains: row.allowed_domains ?? [],
      timeoutMs: row.timeout_ms,
      outputLimitBytes: row.output_limit_bytes,
      enabled: row.enabled,
      createdAt: iso(row.created_at),
      updatedAt: iso(row.updated_at),
    };
  }
}
