/**
 * @project LLMira
 * @file src/lib/team/api.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-13
 * @function
 *   - 封装团队 API、Cookie/Bearer 会话与错误语义
 *   - 为 Web 与 Tauri 客户端提供一致的请求边界
 * @description 不在 localStorage 持久化令牌或模型供应商密钥。
 */
import type {
  AgentRun,
  ApprovalDecision,
  ApprovalRequest,
  AuditEntry,
  CursorPage,
  KnowledgeDocument,
  MigrationImport,
  McpServer,
  ModelComparison,
  ProviderProfile,
  RunEvent,
  ScheduledTask,
  TeamInvitation,
  WorkspaceRole,
  WorkspaceUsageSummary,
} from "@llmira/contracts";

const API_BASE_KEY = "llmira:team-api:v1";
const DEFAULT_API_BASE = process.env.NEXT_PUBLIC_TEAM_API_URL ?? "http://localhost:4000";

export interface TeamSession {
  accessToken?: string;
  user: {
    userId: string;
    organizationId: string;
    email: string;
    displayName: string;
  };
  workspace: {
    id: string;
    name: string;
    role: WorkspaceRole;
  };
}

export class TeamApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export function getTeamApiBase(): string {
  if (typeof window === "undefined") return DEFAULT_API_BASE;
  try {
    return localStorage.getItem(API_BASE_KEY) ?? DEFAULT_API_BASE;
  } catch {
    return DEFAULT_API_BASE;
  }
}

export function setTeamApiBase(value: string): string {
  const normalized = value.trim().replace(/\/+$/, "");
  const parsed = new URL(normalized);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("团队服务器必须使用 HTTP 或 HTTPS 地址。");
  }
  const result = parsed.toString().replace(/\/$/, "");
  try {
    localStorage.setItem(API_BASE_KEY, result);
  } catch {
    // 浏览器禁用持久化时，当前页面仍可继续使用返回值。
  }
  return result;
}

/** 团队服务浏览器客户端。 */
export class TeamApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly accessToken?: string,
  ) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        accept: "application/json",
        ...(init.body && !isFormData ? { "content-type": "application/json" } : {}),
        ...(this.accessToken ? { authorization: `Bearer ${this.accessToken}` } : {}),
        ...init.headers,
      },
    });
    if (response.status === 204) return undefined as T;
    const body = (await response.json().catch(() => ({}))) as {
      error?: { code?: string; message?: string };
    };
    if (!response.ok) {
      throw new TeamApiError(
        body.error?.code ?? "REQUEST_FAILED",
        body.error?.message ?? `请求失败（${response.status}）`,
        response.status,
      );
    }
    return body as T;
  }

  private async deviceRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        accept: "application/json",
        "x-llmira-client": "tauri",
        ...(init.body ? { "content-type": "application/json" } : {}),
        ...init.headers,
      },
    });
    const body = await response.json().catch(() => ({})) as T & { error?: { code?: string; message?: string } };
    if (!response.ok) throw new TeamApiError(body.error?.code ?? "REQUEST_FAILED", body.error?.message ?? `请求失败（${response.status}）`, response.status);
    return body;
  }

  health(): Promise<{ status: string; service: string }> {
    return this.request("/api/v1/health");
  }

  bootstrapStatus(): Promise<{ bootstrapped: boolean }> {
    return this.request("/api/v1/bootstrap/status");
  }

  bootstrap(input: {
    organizationName: string;
    displayName: string;
    email: string;
    password: string;
  }): Promise<TeamSession> {
    return this.request("/api/v1/bootstrap", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  login(input: { email: string; password: string }): Promise<Omit<TeamSession, "workspace">> {
    return this.request("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  loginDevice(input: { email: string; password: string }): Promise<Omit<TeamSession, "workspace"> & { refreshToken?: string }> {
    return this.deviceRequest("/api/v1/auth/login", { method: "POST", body: JSON.stringify(input) });
  }

  refreshDevice(refreshToken: string): Promise<{ accessToken: string; refreshToken?: string; expiresIn: number }> {
    return this.deviceRequest("/api/v1/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken }) });
  }

  me(): Promise<{ user: TeamSession["user"] }> {
    return this.request("/api/v1/me");
  }

  workspaces(): Promise<{ items: TeamSession["workspace"][] }> {
    return this.request("/api/v1/workspaces");
  }

  providers(): Promise<{ items: ProviderProfile[]; resolutionOrder: string[] }> {
    return this.request("/api/v1/providers");
  }

  saveProvider(input: {
    workspaceId: string;
    name: string;
    baseUrl: string;
    scope: "team" | "personal";
    apiKey?: string;
    modelPreset: string[];
  }): Promise<ProviderProfile> {
    return this.request("/api/v1/providers", { method: "POST", body: JSON.stringify(input) });
  }

  mcpServers(workspaceId: string): Promise<{ items: McpServer[] }> {
    return this.request(`/api/v1/mcp-servers?workspaceId=${encodeURIComponent(workspaceId)}`);
  }

  saveMcpServer(input: {
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
  }): Promise<McpServer> {
    return this.request("/api/v1/mcp-servers", { method: "POST", body: JSON.stringify(input) });
  }

  invite(input: {
    workspaceId: string;
    email: string;
    role: "workspace_owner" | "editor" | "viewer";
    expiresInHours?: number;
  }): Promise<{ invitation: TeamInvitation; token: string }> {
    return this.request("/api/v1/invitations", { method: "POST", body: JSON.stringify(input) });
  }

  documents(workspaceId: string): Promise<CursorPage<KnowledgeDocument>> {
    return this.request(`/api/v1/documents?workspaceId=${encodeURIComponent(workspaceId)}`);
  }

  createUrlDocument(
    workspaceId: string,
    name: string,
    sourceUrl: string,
  ): Promise<KnowledgeDocument> {
    return this.request("/api/v1/documents", {
      method: "POST",
      body: JSON.stringify({
        workspaceId,
        name,
        sourceUrl,
        sourceType: "url",
        mimeType: "text/html",
        size: 0,
      }),
    });
  }

  uploadDocument(workspaceId: string, file: File): Promise<KnowledgeDocument> {
    const form = new FormData();
    form.append("workspaceId", workspaceId);
    form.append("file", file, file.name);
    return this.request("/api/v1/documents/upload", { method: "POST", body: form });
  }

  createRun(input: {
    workspaceId: string;
    title: string;
    prompt: string;
    model?: string;
    tools?: string[];
    idempotencyKey?: string;
  }): Promise<AgentRun & { approval?: ApprovalRequest }> {
    return this.request("/api/v1/runs", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  cancelRun(runId: string): Promise<AgentRun> {
    return this.request(`/api/v1/runs/${runId}/cancel`, { method: "POST" });
  }

  compareModels(input: { workspaceId: string; prompt: string; models: string[] }): Promise<ModelComparison> {
    return this.request("/api/v1/model-comparisons", { method: "POST", body: JSON.stringify(input) });
  }

  scheduledTasks(workspaceId: string): Promise<{ items: ScheduledTask[] }> {
    return this.request(`/api/v1/scheduled-tasks?workspaceId=${encodeURIComponent(workspaceId)}`);
  }

  createScheduledTask(input: {
    workspaceId: string;
    name: string;
    cronExpression: string;
    timezone: string;
    prompt: string;
  }): Promise<ScheduledTask> {
    return this.request("/api/v1/scheduled-tasks", { method: "POST", body: JSON.stringify(input) });
  }

  /** 使用 fetch 读取可带 Bearer 令牌、可续传的 SSE 运行事件。 */
  async streamRunEvents(
    runId: string,
    onEvent: (event: RunEvent) => void,
    signal?: AbortSignal,
    afterSequence = 0,
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/v1/runs/${runId}/events`, {
      credentials: "include",
      signal,
      headers: {
        accept: "text/event-stream",
        "last-event-id": String(afterSequence),
        ...(this.accessToken ? { authorization: `Bearer ${this.accessToken}` } : {}),
      },
    });
    if (!response.ok || !response.body) {
      const body = (await response.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
      throw new TeamApiError(
        body.error?.code ?? "EVENT_STREAM_FAILED",
        body.error?.message ?? `无法连接运行事件流（${response.status}）`,
        response.status,
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      buffer = buffer.replace(/\r\n/g, "\n");
      let boundary = buffer.indexOf("\n\n");
      while (boundary >= 0) {
        const frame = buffer.slice(0, boundary).replace(/\r/g, "");
        buffer = buffer.slice(boundary + 2);
        const data = frame
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");
        if (data) onEvent(JSON.parse(data) as RunEvent);
        boundary = buffer.indexOf("\n\n");
      }
      if (done) break;
    }
  }

  decideApproval(
    approvalId: string,
    decision: ApprovalDecision["decision"],
  ): Promise<ApprovalRequest> {
    return this.request(`/api/v1/approvals/${approvalId}/decision`, {
      method: "POST",
      body: JSON.stringify({ decision }),
    });
  }

  audit(workspaceId: string): Promise<CursorPage<AuditEntry>> {
    return this.request(`/api/v1/audit?workspaceId=${encodeURIComponent(workspaceId)}`);
  }

  usage(workspaceId: string): Promise<WorkspaceUsageSummary> {
    return this.request(`/api/v1/usage?workspaceId=${encodeURIComponent(workspaceId)}`);
  }

  importLegacy(input: MigrationImport): Promise<{ imported: number; duplicate: boolean }> {
    return this.request("/api/v1/migration/import", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }
}
