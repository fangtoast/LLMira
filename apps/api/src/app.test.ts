/**
 * @project LLMira
 * @file apps/api/src/app.test.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-13
 * @function
 *   - 验证管理员初始化、认证与团队工作区访问
 *   - 验证 Agent 写操作授权和迁移幂等性
 * @description 使用 Fastify inject 与内存 Store，不依赖外部服务。
 */
import { describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import type { ApiConfig } from "./config.js";
import { NoopJobDispatcher } from "./queue.js";
import { MemoryTeamStore } from "./store/memory.js";

const testConfig: ApiConfig = {
  nodeEnv: "test",
  host: "127.0.0.1",
  port: 4000,
  databaseUrl: "postgres://test:test@localhost:5432/test",
  redisUrl: "redis://localhost:6379",
  jwtSecret: "test-jwt-secret-with-at-least-32-characters",
  encryptionKey: Buffer.alloc(32, 1),
  publicAppOrigin: "http://localhost:3000",
  cookieSecure: false,
  trustProxy: false,
  s3Endpoint: "http://localhost:9000",
  s3Region: "us-east-1",
  s3Bucket: "llmira-test",
  s3AccessKey: "test",
  s3SecretKey: "test-secret",
};

async function initializedApp() {
  const app = await buildApp({ config: testConfig, store: new MemoryTeamStore(), dispatcher: new NoopJobDispatcher() });
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/bootstrap",
    payload: { organizationName: "LLMira 研发组", displayName: "管理员", email: "admin@example.com", password: "strong-password-2026" },
  });
  expect(response.statusCode).toBe(201);
  return { app, body: response.json() as { accessToken: string; workspace: { id: string } } };
}

describe("LLMira team API", () => {
  it("bootstraps once and exposes the authenticated workspace", async () => {
    const { app, body } = await initializedApp();
    try {
      const workspaces = await app.inject({ method: "GET", url: "/api/v1/workspaces", headers: { authorization: `Bearer ${body.accessToken}` } });
      expect(workspaces.statusCode).toBe(200);
      expect(workspaces.json().items[0].name).toBe("团队知识库");
      const duplicate = await app.inject({ method: "POST", url: "/api/v1/bootstrap", payload: { organizationName: "另一个组织", displayName: "管理员", email: "other@example.com", password: "strong-password-2026" } });
      expect(duplicate.statusCode).toBe(409);
    } finally {
      await app.close();
    }
  });

  it("pauses write tools for per-action approval and records a decision", async () => {
    const { app, body } = await initializedApp();
    try {
      const runResponse = await app.inject({
        method: "POST",
        url: "/api/v1/runs",
        headers: { authorization: `Bearer ${body.accessToken}` },
        payload: { workspaceId: body.workspace.id, title: "更新知识索引", prompt: "读取文档并写入摘要", tools: ["knowledge.read", "workspace.write"] },
      });
      expect(runResponse.statusCode).toBe(202);
      const run = runResponse.json();
      expect(run.status).toBe("waiting_approval");
      expect(run.approval.risk).toBe("write");
      const decision = await app.inject({
        method: "POST",
        url: `/api/v1/approvals/${run.approval.id}/decision`,
        headers: { authorization: `Bearer ${body.accessToken}` },
        payload: { decision: "rejected" },
      });
      expect(decision.statusCode).toBe(200);
      expect(decision.json().status).toBe("rejected");
    } finally {
      await app.close();
    }
  });

  it("imports legacy conversations idempotently", async () => {
    const { app, body } = await initializedApp();
    try {
      const payload = {
        workspaceId: body.workspace.id,
        importId: "legacy-export-001",
        conversations: [{ id: "old-1", title: "旧会话", model: "gpt-4", createdAt: 1, updatedAt: 2, messages: [] }],
      };
      const first = await app.inject({ method: "POST", url: "/api/v1/migration/import", headers: { authorization: `Bearer ${body.accessToken}` }, payload });
      const second = await app.inject({ method: "POST", url: "/api/v1/migration/import", headers: { authorization: `Bearer ${body.accessToken}` }, payload });
      expect(first.json()).toEqual({ imported: 1, duplicate: false });
      expect(second.json()).toEqual({ imported: 0, duplicate: true });
    } finally {
      await app.close();
    }
  });

  it("creates an invitation and lets the invited member establish a session", async () => {
    const { app, body } = await initializedApp();
    try {
      const invitationResponse = await app.inject({
        method: "POST",
        url: "/api/v1/invitations",
        headers: { authorization: `Bearer ${body.accessToken}` },
        payload: { workspaceId: body.workspace.id, email: "member@example.com", role: "editor", expiresInHours: 24 },
      });
      expect(invitationResponse.statusCode).toBe(201);
      const accepted = await app.inject({
        method: "POST",
        url: "/api/v1/auth/invitations/accept",
        payload: { token: invitationResponse.json().token, displayName: "受邀成员", password: "member-password-2026" },
      });
      expect(accepted.statusCode).toBe(201);
      expect(accepted.json().workspace.role).toBe("editor");
    } finally {
      await app.close();
    }
  });

  it("stores team and personal providers without returning their secrets", async () => {
    const { app, body } = await initializedApp();
    try {
      for (const scope of ["team", "personal"] as const) {
        const response = await app.inject({
          method: "POST",
          url: "/api/v1/providers",
          headers: { authorization: `Bearer ${body.accessToken}` },
          payload: {
            workspaceId: body.workspace.id,
            name: `${scope} provider`,
            baseUrl: "https://models.example.com",
            scope,
            apiKey: `secret-${scope}-provider-key`,
            modelPreset: ["model-a"],
          },
        });
        expect(response.statusCode).toBe(201);
        expect(response.json()).toMatchObject({ scope, hasSecret: true });
        expect(response.body).not.toContain(`secret-${scope}-provider-key`);
      }
      const profiles = await app.inject({ method: "GET", url: "/api/v1/providers", headers: { authorization: `Bearer ${body.accessToken}` } });
      expect(profiles.json().resolutionOrder).toEqual(["personal", "team", "unavailable"]);
    } finally {
      await app.close();
    }
  });

  it("requires authentication and a configured provider for the OpenAI gateway", async () => {
    const { app, body } = await initializedApp();
    try {
      const anonymous = await app.inject({ method: "GET", url: "/v1/models", headers: { "x-llmira-workspace-id": body.workspace.id } });
      expect(anonymous.statusCode).toBe(401);
      const missingProvider = await app.inject({ method: "GET", url: "/v1/models", headers: { authorization: `Bearer ${body.accessToken}`, "x-llmira-workspace-id": body.workspace.id } });
      expect(missingProvider.statusCode).toBe(409);
      expect(missingProvider.json().error.code).toBe("PROVIDER_NOT_CONFIGURED");
    } finally {
      await app.close();
    }
  });

  it("validates MCP risk declarations and pinned container images", async () => {
    const { app, body } = await initializedApp();
    try {
      const invalid = await app.inject({
        method: "POST",
        url: "/api/v1/mcp-servers",
        headers: { authorization: `Bearer ${body.accessToken}` },
        payload: { workspaceId: body.workspace.id, name: "local files", transport: "stdio_container", containerImage: "example/mcp:latest", defaultRisk: "write", allowedDomains: [], timeoutMs: 30_000, outputLimitBytes: 1_048_576, enabled: true },
      });
      expect(invalid.statusCode).toBe(400);
      const valid = await app.inject({
        method: "POST",
        url: "/api/v1/mcp-servers",
        headers: { authorization: `Bearer ${body.accessToken}` },
        payload: { workspaceId: body.workspace.id, name: "remote search", transport: "streamable_http", endpoint: "https://mcp.example.com/api", defaultRisk: "read", allowedDomains: ["mcp.example.com"], timeoutMs: 30_000, outputLimitBytes: 1_048_576, enabled: true },
      });
      expect(valid.statusCode).toBe(201);
      expect(valid.json()).toMatchObject({ transport: "streamable_http", defaultRisk: "read" });
    } finally {
      await app.close();
    }
  });
});
