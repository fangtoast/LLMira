/**
 * @project LLMira
 * @file apps/api/src/app.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-13
 * @function
 *   - 组装团队 API、认证、知识库、Agent、授权、审计与迁移路由
 *   - 暴露可注入的 Fastify 实例供集成测试使用
 * @description 所有受保护接口统一位于 /api/v1；OpenAI 兼容网关保留 /v1 前缀。
 */
import { randomBytes } from "node:crypto";
import { Readable } from "node:stream";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import argon2 from "argon2";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { v7 as uuidv7 } from "uuid";
import { z, ZodError } from "zod";
import {
  approvalDecisionSchema,
  createRunInputSchema,
  migrationImportSchema,
  type ToolRisk,
} from "@llmira/contracts";
import { decryptSecret, encryptSecret, hashToken } from "@llmira/security";
import { authCookies, hashRefreshToken, issueSession, requireAuth } from "./auth.js";
import type { ApiConfig } from "./config.js";
import { loadConfig } from "./config.js";
import { PostgresTeamStore } from "./store/postgres.js";
import type { TeamStore } from "./store/types.js";
import { BullJobDispatcher, type JobDispatcher } from "./queue.js";

const bootstrapSchema = z.object({
  organizationName: z.string().trim().min(2).max(120),
  displayName: z.string().trim().min(1).max(80),
  email: z.email().transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(200),
});

const loginSchema = z.object({
  email: z.email().transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(200),
});

const invitationSchema = z.object({
  workspaceId: z.string().uuid(),
  email: z.email().transform((value) => value.toLowerCase()),
  role: z.enum(["workspace_owner", "editor", "viewer"]),
  expiresInHours: z.number().int().min(1).max(24 * 30).default(72),
});

const acceptInvitationSchema = z.object({
  token: z.string().min(32).max(500),
  displayName: z.string().trim().min(1).max(80),
  password: z.string().min(12).max(200),
});

const providerSchema = z.object({
  id: z.string().uuid().optional(),
  workspaceId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(80),
  baseUrl: z.url().refine((value) => ["http:", "https:"].includes(new URL(value).protocol)),
  scope: z.enum(["team", "personal"]),
  apiKey: z.string().min(8).max(10_000).optional(),
  modelPreset: z.array(z.string().trim().min(1).max(200)).max(200).default([]),
  enabled: z.boolean().default(true),
});

const mcpServerSchema = z.object({
  id: z.string().uuid().optional(),
  workspaceId: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
  transport: z.enum(["streamable_http", "stdio_container"]),
  endpoint: z.url().optional(),
  containerImage: z.string().trim().max(300).optional(),
  defaultRisk: z.enum(["read", "write", "external_side_effect", "irreversible"]),
  allowedDomains: z.array(z.string().trim().min(1).max(253)).max(100),
  timeoutMs: z.number().int().min(1_000).max(300_000).default(30_000),
  outputLimitBytes: z.number().int().min(1_024).max(10 * 1024 * 1024).default(1024 * 1024),
  enabled: z.boolean().default(true),
}).superRefine((value, context) => {
  if (value.transport === "streamable_http" && !value.endpoint) context.addIssue({ code: "custom", path: ["endpoint"], message: "HTTP MCP 必须提供 endpoint。" });
  if (value.endpoint) {
    const url = new URL(value.endpoint);
    if (!value.allowedDomains.includes(url.hostname)) context.addIssue({ code: "custom", path: ["allowedDomains"], message: "允许域名必须包含 MCP endpoint 主机。" });
    if (url.username || url.password) context.addIssue({ code: "custom", path: ["endpoint"], message: "MCP endpoint 不得内嵌凭据。" });
  }
  if (value.transport === "stdio_container" && !/@sha256:[a-f0-9]{64}$/i.test(value.containerImage ?? "")) context.addIssue({ code: "custom", path: ["containerImage"], message: "stdio 容器镜像必须固定 SHA-256 digest。" });
});

const scheduleSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  cronExpression: z.string().trim().min(5).max(120),
  timezone: z.string().trim().min(1).max(100).default("Asia/Shanghai"),
  prompt: z.string().trim().min(1).max(100_000),
});

const comparisonSchema = z.object({
  workspaceId: z.string().uuid(),
  prompt: z.string().trim().min(1).max(100_000),
  models: z.array(z.string().trim().min(1).max(200)).min(2).max(4),
});

const documentSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(200),
  size: z.number().int().min(0).max(250 * 1024 * 1024),
  sourceType: z.enum(["upload", "url"]),
  sourceUrl: z.url().optional(),
  objectKey: z.string().max(500).optional(),
});

const allowedDocumentTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "text/html",
  "text/csv",
]);

const allowedDocumentExtensions: Record<string, string[]> = {
  "application/pdf": ["pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
  "text/plain": ["txt"],
  "text/markdown": ["md", "markdown"],
  "text/html": ["html", "htm"],
  "text/csv": ["csv"],
};

const gatewayWorkspaceHeader = z.string().uuid();
const gatewayBodySchema = z.object({ model: z.string().trim().min(1).max(200) }).passthrough();

function toolRisk(toolName: string): ToolRisk {
  if (/delete|remove|drop|destroy/i.test(toolName)) return "irreversible";
  if (/post|send|publish|email|notify/i.test(toolName)) return "external_side_effect";
  if (/write|update|create|edit/i.test(toolName)) return "write";
  return "read";
}

export interface BuildAppOptions {
  config?: ApiConfig;
  store?: TeamStore;
  dispatcher?: JobDispatcher;
}

/** 构建可运行或可注入测试的团队 API。 */
export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const config = options.config ?? loadConfig();
  const store = options.store ?? new PostgresTeamStore(config.databaseUrl);
  const dispatcher = options.dispatcher ?? new BullJobDispatcher(config.redisUrl);
  const objects = new S3Client({
    endpoint: config.s3Endpoint,
    region: config.s3Region,
    forcePathStyle: true,
    credentials: { accessKeyId: config.s3AccessKey, secretAccessKey: config.s3SecretKey },
  });

  const resolveGateway = async (request: FastifyRequest) => {
    const workspaceId = gatewayWorkspaceHeader.parse(request.headers["x-llmira-workspace-id"]);
    await store.requireWorkspaceRole(request.principal!.userId, workspaceId, ["org_admin", "workspace_owner", "editor", "viewer"]);
    const provider = await store.resolveProviderCredential(request.principal!.organizationId, request.principal!.userId, workspaceId);
    if (!provider) throw new Error("PROVIDER_NOT_CONFIGURED");
    return { workspaceId, provider, apiKey: decryptSecret(provider.encryptedSecret, config.encryptionKey) };
  };
  const app = Fastify({ logger: { level: config.nodeEnv === "test" ? "silent" : "info", redact: ["req.headers.authorization", "req.headers.cookie", "password", "apiKey", "refreshToken"] }, trustProxy: config.trustProxy });

  await app.register(cookie);
  await app.register(jwt, { secret: config.jwtSecret, cookie: { cookieName: authCookies.access, signed: false } });
  await app.register(cors, { origin: config.publicAppOrigin, credentials: true });
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });
  await app.register(multipart, { limits: { files: 1, fileSize: 250 * 1024 * 1024, fields: 8 } });

  app.addHook("onClose", async () => {
    await Promise.all([store.close(), dispatcher.close()]);
  });
  app.setErrorHandler(async (error, request, reply) => {
    const cause = error instanceof Error ? error : new Error("Unknown request failure");
    if (cause instanceof ZodError) {
      await reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: cause.issues[0]?.message ?? "请求参数无效。", requestId: request.id } });
      return;
    }
    if (cause.message === "WORKSPACE_FORBIDDEN") {
      await reply.code(403).send({ error: { code: "WORKSPACE_FORBIDDEN", message: "没有此工作区的操作权限。", requestId: request.id } });
      return;
    }
    if (cause.message === "BOOTSTRAP_ALREADY_COMPLETED") {
      await reply.code(409).send({ error: { code: "BOOTSTRAP_ALREADY_COMPLETED", message: "组织已经完成初始化。", requestId: request.id } });
      return;
    }
    if (cause.message === "PROVIDER_NOT_CONFIGURED") {
      await reply.code(409).send({ error: { code: "PROVIDER_NOT_CONFIGURED", message: "请先为当前工作区配置个人或团队 Provider。", requestId: request.id } });
      return;
    }
    if (cause.message === "MCP_SERVER_UNAVAILABLE") {
      await reply.code(400).send({ error: { code: "MCP_SERVER_UNAVAILABLE", message: "所选 MCP 服务器不存在、已停用或不属于当前工作区。", requestId: request.id } });
      return;
    }
    if ((cause as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE") {
      await reply.code(413).send({ error: { code: "DOCUMENT_TOO_LARGE", message: "单个文件不能超过 250 MB。", requestId: request.id } });
      return;
    }
    request.log.error({ err: cause }, "request failed");
    await reply.code(500).send({ error: { code: "INTERNAL_ERROR", message: "服务暂时不可用。", requestId: request.id } });
  });

  app.get("/api/v1/health", async () => ({ status: "ok", service: "llmira-api", version: "0.1.0" }));
  app.get("/api/v1/bootstrap/status", async () => ({ bootstrapped: await store.isBootstrapped() }));

  app.post("/api/v1/bootstrap", { config: { rateLimit: { max: 5, timeWindow: "1 hour" } } }, async (request, reply) => {
    const input = bootstrapSchema.parse(request.body);
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 });
    const result = await store.bootstrap({ ...input, passwordHash });
    const session = await issueSession(app, reply, store, config, result.principal);
    await store.appendAudit({ workspaceId: result.workspace.id, actorUserId: result.principal.userId, action: "organization.bootstrap", targetType: "organization", targetId: result.principal.organizationId, redactedInput: { email: input.email }, resultSummary: "success" });
    return reply.code(201).send({ user: result.principal, workspace: result.workspace, accessToken: session.accessToken, refreshToken: request.headers["x-llmira-client"] === "tauri" ? session.refreshToken : undefined, expiresIn: session.expiresIn });
  });

  app.post("/api/v1/auth/login", { config: { rateLimit: { max: 10, timeWindow: "15 minutes" } } }, async (request, reply) => {
    const input = loginSchema.parse(request.body);
    const credential = await store.findUserByEmail(input.email);
    if (!credential || !(await argon2.verify(credential.passwordHash, input.password))) {
      return reply.code(401).send({ error: { code: "INVALID_CREDENTIALS", message: "邮箱或密码不正确。", requestId: request.id } });
    }
    const session = await issueSession(app, reply, store, config, credential);
    return { user: { ...credential, passwordHash: undefined }, accessToken: session.accessToken, refreshToken: request.headers["x-llmira-client"] === "tauri" ? session.refreshToken : undefined, expiresIn: session.expiresIn };
  });

  app.post("/api/v1/auth/invitations/accept", { config: { rateLimit: { max: 10, timeWindow: "1 hour" } } }, async (request, reply) => {
    const input = acceptInvitationSchema.parse(request.body);
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 });
    const result = await store.acceptInvitation({ tokenHash: hashToken(input.token), displayName: input.displayName, passwordHash });
    if (!result) return reply.code(410).send({ error: { code: "INVITATION_INVALID", message: "邀请不存在、已使用或已过期。", requestId: request.id } });
    const session = await issueSession(app, reply, store, config, result.principal);
    await store.appendAudit({ workspaceId: result.workspace.id, actorUserId: result.principal.userId, action: "invitation.accept", targetType: "user", targetId: result.principal.userId, redactedInput: { email: result.principal.email }, resultSummary: "success" });
    return reply.code(201).send({ user: result.principal, workspace: result.workspace, accessToken: session.accessToken, refreshToken: request.headers["x-llmira-client"] === "tauri" ? session.refreshToken : undefined, expiresIn: session.expiresIn });
  });

  app.post("/api/v1/auth/refresh", async (request, reply) => {
    const refreshToken = request.cookies[authCookies.refresh] ?? (request.body as { refreshToken?: string } | undefined)?.refreshToken;
    if (!refreshToken) return reply.code(401).send({ error: { code: "REFRESH_REQUIRED", message: "缺少刷新凭据。", requestId: request.id } });
    const nextToken = randomBytes(32).toString("base64url");
    const principal = await store.rotateRefreshSession({ oldTokenHash: hashRefreshToken(refreshToken), id: uuidv7(), tokenHash: hashRefreshToken(nextToken), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) });
    if (!principal) return reply.code(401).send({ error: { code: "REFRESH_INVALID", message: "刷新凭据已失效。", requestId: request.id } });
    const accessToken = app.jwt.sign({ organizationId: principal.organizationId, role: principal.organizationRole, email: principal.email }, { sub: principal.userId, expiresIn: "15m" });
    const cookieBase = { httpOnly: true, secure: config.cookieSecure, sameSite: "lax" as const, path: "/" };
    reply.setCookie(authCookies.access, accessToken, { ...cookieBase, maxAge: 15 * 60 });
    reply.setCookie(authCookies.refresh, nextToken, { ...cookieBase, maxAge: 30 * 24 * 60 * 60 });
    return { accessToken, refreshToken: request.headers["x-llmira-client"] === "tauri" ? nextToken : undefined, expiresIn: 15 * 60 };
  });

  app.post("/api/v1/auth/logout", async (request, reply) => {
    const refreshToken = request.cookies[authCookies.refresh];
    if (refreshToken) await store.revokeRefreshSession(hashRefreshToken(refreshToken));
    reply.clearCookie(authCookies.access, { path: "/" });
    reply.clearCookie(authCookies.refresh, { path: "/" });
    return reply.code(204).send();
  });

  app.get("/api/v1/me", { preHandler: requireAuth }, async (request) => ({ user: request.principal }));
  app.get("/api/v1/workspaces", { preHandler: requireAuth }, async (request) =>
    store.runAsUser(request.principal!.userId, async () => ({ items: await store.listWorkspaces(request.principal!.userId) })),
  );

  app.post("/api/v1/invitations", { preHandler: requireAuth }, async (request, reply) => {
    return store.runAsUser(request.principal!.userId, async () => {
      const input = invitationSchema.parse(request.body);
      await store.requireWorkspaceRole(request.principal!.userId, input.workspaceId, ["org_admin", "workspace_owner"]);
      const token = randomBytes(32).toString("base64url");
      const invitation = await store.createInvitation({
        organizationId: request.principal!.organizationId,
        workspaceId: input.workspaceId,
        email: input.email,
        role: input.role,
        tokenHash: hashToken(token),
        invitedBy: request.principal!.userId,
        expiresAt: new Date(Date.now() + input.expiresInHours * 60 * 60 * 1000),
      });
      await store.appendAudit({ workspaceId: input.workspaceId, actorUserId: request.principal!.userId, action: "invitation.create", targetType: "invitation", targetId: invitation.id, redactedInput: { email: input.email, role: input.role }, resultSummary: "created" });
      return reply.code(201).send({ invitation, token });
    });
  });

  app.get("/api/v1/providers", { preHandler: requireAuth }, async (request) =>
    store.runAsUser(request.principal!.userId, async () => ({
      items: await store.listProviderProfiles(request.principal!.organizationId, request.principal!.userId),
      resolutionOrder: ["personal", "team", "unavailable"],
    })),
  );

  app.post("/api/v1/providers", { preHandler: requireAuth }, async (request, reply) => {
    return store.runAsUser(request.principal!.userId, async () => {
      const input = providerSchema.parse(request.body);
      if (input.scope === "team" && request.principal!.organizationRole !== "org_admin") {
        return reply.code(403).send({ error: { code: "ORG_ADMIN_REQUIRED", message: "只有组织管理员可以配置团队密钥。", requestId: request.id } });
      }
      if (input.workspaceId) {
        await store.requireWorkspaceRole(request.principal!.userId, input.workspaceId, ["org_admin", "workspace_owner", "editor", "viewer"]);
      }
      const profile = await store.upsertProviderProfile({
        id: input.id,
        organizationId: request.principal!.organizationId,
        workspaceId: input.workspaceId,
        ownerUserId: input.scope === "personal" ? request.principal!.userId : undefined,
        name: input.name,
        baseUrl: input.baseUrl.replace(/\/$/, ""),
        scope: input.scope,
        encryptedSecret: input.apiKey ? encryptSecret(input.apiKey, config.encryptionKey) : undefined,
        modelPreset: input.modelPreset,
        enabled: input.enabled,
      });
      await store.appendAudit({ workspaceId: input.workspaceId, actorUserId: request.principal!.userId, action: `provider.${input.scope}.upsert`, targetType: "provider_profile", targetId: profile.id, redactedInput: { name: input.name, baseUrl: input.baseUrl, apiKey: input.apiKey ? "[REDACTED]" : undefined }, resultSummary: "saved" });
      return reply.code(input.id ? 200 : 201).send(profile);
    });
  });

  app.get("/api/v1/mcp-servers", { preHandler: requireAuth }, async (request) => store.runAsUser(request.principal!.userId, async () => {
    const query = z.object({ workspaceId: z.string().uuid() }).parse(request.query);
    await store.requireWorkspaceRole(request.principal!.userId, query.workspaceId, ["org_admin", "workspace_owner", "editor", "viewer"]);
    return { items: await store.listMcpServers(query.workspaceId) };
  }));

  app.post("/api/v1/mcp-servers", { preHandler: requireAuth }, async (request, reply) => store.runAsUser(request.principal!.userId, async () => {
    const input = mcpServerSchema.parse(request.body);
    await store.requireWorkspaceRole(request.principal!.userId, input.workspaceId, ["org_admin", "workspace_owner"]);
    const server = await store.upsertMcpServer(input);
    await store.appendAudit({ workspaceId: input.workspaceId, actorUserId: request.principal!.userId, action: "mcp.server.upsert", targetType: "mcp_server", targetId: server.id, redactedInput: { name: input.name, transport: input.transport, defaultRisk: input.defaultRisk, allowedDomains: input.allowedDomains }, resultSummary: "saved" });
    return reply.code(201).send(server);
  }));

  app.get("/api/v1/documents", { preHandler: requireAuth }, async (request) => {
    return store.runAsUser(request.principal!.userId, async () => {
      const query = z.object({ workspaceId: z.string().uuid(), cursor: z.string().optional(), limit: z.coerce.number().int().min(1).max(100).default(50) }).parse(request.query);
      await store.requireWorkspaceRole(request.principal!.userId, query.workspaceId, ["org_admin", "workspace_owner", "editor", "viewer"]);
      return store.listDocuments(query.workspaceId, query.cursor, query.limit);
    });
  });

  app.post("/api/v1/documents/upload", { preHandler: requireAuth }, async (request, reply) => {
    const upload = await request.file();
    if (!upload) return reply.code(400).send({ error: { code: "FILE_REQUIRED", message: "请选择一个文件。", requestId: request.id } });
    const field = upload.fields.workspaceId;
    const workspaceField = Array.isArray(field) ? field[0] : field;
    const workspaceId = z.string().uuid().parse(workspaceField?.type === "field" ? workspaceField.value : undefined);
    if (!allowedDocumentTypes.has(upload.mimetype)) return reply.code(415).send({ error: { code: "UNSUPPORTED_DOCUMENT", message: "暂不支持此文档格式。", requestId: request.id } });
    const extension = upload.filename.split(".").at(-1)?.toLowerCase() ?? "";
    if (!allowedDocumentExtensions[upload.mimetype]?.includes(extension)) return reply.code(415).send({ error: { code: "DOCUMENT_TYPE_MISMATCH", message: "文件扩展名与声明类型不一致。", requestId: request.id } });
    await store.runAsUser(request.principal!.userId, async () => store.requireWorkspaceRole(request.principal!.userId, workspaceId, ["org_admin", "workspace_owner", "editor"]));
    const safeName = upload.filename.replace(/[^\p{L}\p{N}._-]+/gu, "-").slice(-180) || "document";
    const objectKey = `${request.principal!.organizationId}/${workspaceId}/${uuidv7()}-${safeName}`;
    let size = 0;
    upload.file.on("data", (chunk: Buffer) => { size += chunk.length; });
    try {
      await objects.send(new PutObjectCommand({ Bucket: config.s3Bucket, Key: objectKey, Body: upload.file, ContentType: upload.mimetype }));
      if (upload.file.truncated) throw Object.assign(new Error("DOCUMENT_TOO_LARGE"), { code: "FST_REQ_FILE_TOO_LARGE" });
      const document = await store.runAsUser(request.principal!.userId, async () => {
        const created = await store.createDocument({ workspaceId, name: upload.filename, mimeType: upload.mimetype, size, sourceType: "upload", objectKey });
        await store.appendAudit({ workspaceId, actorUserId: request.principal!.userId, action: "knowledge.document.upload", targetType: "knowledge_document", targetId: created.id, redactedInput: { name: upload.filename, mimeType: upload.mimetype, size }, resultSummary: "queued" });
        return created;
      });
      await dispatcher.enqueueDocument(document.id);
      return reply.code(202).send(document);
    } catch (error) {
      await objects.send(new DeleteObjectCommand({ Bucket: config.s3Bucket, Key: objectKey })).catch(() => undefined);
      throw error;
    }
  });

  app.post("/api/v1/documents", { preHandler: requireAuth }, async (request, reply) => {
    return store.runAsUser(request.principal!.userId, async () => {
      const input = documentSchema.parse(request.body);
      await store.requireWorkspaceRole(request.principal!.userId, input.workspaceId, ["org_admin", "workspace_owner", "editor"]);
      if (!allowedDocumentTypes.has(input.mimeType)) return reply.code(415).send({ error: { code: "UNSUPPORTED_DOCUMENT", message: "暂不支持此文档格式。", requestId: request.id } });
      if (input.sourceType === "url" && !input.sourceUrl) return reply.code(400).send({ error: { code: "SOURCE_URL_REQUIRED", message: "网页来源必须提供 URL。", requestId: request.id } });
      const document = await store.createDocument(input);
      await dispatcher.enqueueDocument(document.id);
      await store.appendAudit({ workspaceId: input.workspaceId, actorUserId: request.principal!.userId, action: "knowledge.document.create", targetType: "knowledge_document", targetId: document.id, redactedInput: { name: input.name, sourceType: input.sourceType }, resultSummary: "queued" });
      return reply.code(202).send(document);
    });
  });

  app.post("/api/v1/runs", { preHandler: requireAuth }, async (request, reply) => {
    return store.runAsUser(request.principal!.userId, async () => {
      const input = createRunInputSchema.parse(request.body);
      await store.requireWorkspaceRole(request.principal!.userId, input.workspaceId, ["org_admin", "workspace_owner", "editor"]);
      const toolDeclarations = await Promise.all(input.tools.map(async (name) => {
        const match = /^mcp:([0-9a-f-]{36}):(.+)$/i.exec(name);
        if (!match) return { name, risk: toolRisk(name) };
        const server = await store.getMcpServer(match[1]!);
        if (!server || server.workspaceId !== input.workspaceId || !server.enabled) throw new Error("MCP_SERVER_UNAVAILABLE");
        return { name, risk: server.defaultRisk };
      }));
      const guardedTools = toolDeclarations.filter((tool) => tool.risk !== "read");
      if (guardedTools.length > 1) return reply.code(400).send({ error: { code: "ONE_GUARDED_ACTION_PER_RUN", message: "每个运行最多包含一个需授权动作，请拆分后逐次确认。", requestId: request.id } });
      const run = await store.createRun({ workspaceId: input.workspaceId, requestedBy: request.principal!.userId, title: input.title, prompt: input.prompt, model: input.model, tools: input.tools, idempotencyKey: input.idempotencyKey });
      if (run.duplicate) return reply.code(200).send(run);
      await store.appendRunEvent(run.id, "run.queued", { title: run.title });
      const guardedTool = guardedTools[0];
      if (guardedTool) {
        await store.updateRunStatus(run.id, "waiting_approval");
        const approval = await store.createApproval({ runId: run.id, toolName: guardedTool.name, risk: guardedTool.risk as Exclude<ToolRisk, "read">, summary: `Agent 请求执行 ${guardedTool.name}`, redactedArguments: {} });
        await store.appendRunEvent(run.id, "approval.required", { approval });
        return reply.code(202).send({ ...run, status: "waiting_approval", approval });
      }
      await store.updateRunStatus(run.id, "running");
      await store.appendRunEvent(run.id, "run.started", { model: input.model ?? "router:auto" });
      await dispatcher.enqueueRun(run.id);
      return reply.code(202).send({ ...run, status: "running" });
    });
  });

  app.post("/api/v1/model-comparisons", { preHandler: requireAuth }, async (request, reply) => {
    return store.runAsUser(request.principal!.userId, async () => {
      const input = comparisonSchema.parse(request.body);
      await store.requireWorkspaceRole(request.principal!.userId, input.workspaceId, ["org_admin", "workspace_owner", "editor"]);
      const comparisonId = await store.createModelComparison({ workspaceId: input.workspaceId, requestedBy: request.principal!.userId, prompt: input.prompt, models: input.models });
      const runs = await Promise.all(input.models.map(async (model) => {
        const run = await store.createRun({ workspaceId: input.workspaceId, requestedBy: request.principal!.userId, title: `模型对比 · ${model}`, prompt: input.prompt, model, comparisonId });
        await store.updateRunStatus(run.id, "running");
        await store.appendRunEvent(run.id, "run.started", { model, comparison: true });
        await dispatcher.enqueueRun(run.id);
        return { ...run, status: "running" as const };
      }));
      return reply.code(202).send({ id: comparisonId, workspaceId: input.workspaceId, prompt: input.prompt, runs, createdAt: new Date().toISOString() });
    });
  });

  app.post("/api/v1/runs/:runId/cancel", { preHandler: requireAuth }, async (request, reply) => {
    return store.runAsUser(request.principal!.userId, async () => {
      const { runId } = z.object({ runId: z.string().uuid() }).parse(request.params);
      const run = await store.getRun(runId);
      if (!run) return reply.code(404).send({ error: { code: "RUN_NOT_FOUND", message: "运行记录不存在。", requestId: request.id } });
      await store.requireWorkspaceRole(request.principal!.userId, run.workspaceId, ["org_admin", "workspace_owner", "editor"]);
      await store.updateRunStatus(runId, "cancelled");
      await store.appendRunEvent(runId, "run.cancelled", { cancelledBy: request.principal!.userId });
      return reply.code(202).send({ ...run, status: "cancelled" });
    });
  });

  app.get("/api/v1/runs/:runId/events", { preHandler: requireAuth }, async (request, reply) => {
    const { runId } = z.object({ runId: z.string().uuid() }).parse(request.params);
    const run = await store.runAsUser(request.principal!.userId, async () => store.getRun(runId));
    if (!run) return reply.code(404).send({ error: { code: "RUN_NOT_FOUND", message: "运行记录不存在。", requestId: request.id } });
    await store.runAsUser(request.principal!.userId, async () => store.requireWorkspaceRole(request.principal!.userId, run.workspaceId, ["org_admin", "workspace_owner", "editor", "viewer"]));
    const headerSequence = Number(request.headers["last-event-id"] ?? 0);
    reply.hijack();
    reply.raw.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" });
    let cursor = Number.isFinite(headerSequence) ? headerSequence : 0;
    let closed = false;
    request.raw.on("close", () => { closed = true; });
    while (!closed) {
      const events = await store.runAsUser(request.principal!.userId, async () => store.listRunEvents(runId, cursor));
      for (const event of events) {
        cursor = event.sequence;
        reply.raw.write(`id: ${event.sequence}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      }
      const current = await store.runAsUser(request.principal!.userId, async () => store.getRun(runId));
      if (current && ["completed", "failed", "cancelled"].includes(current.status) && events.length === 0) break;
      reply.raw.write(": heartbeat\n\n");
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
    reply.raw.end();
  });

  app.post("/api/v1/approvals/:approvalId/decision", { preHandler: requireAuth }, async (request, reply) => {
    return store.runAsUser(request.principal!.userId, async () => {
      const { approvalId } = z.object({ approvalId: z.string().uuid() }).parse(request.params);
      const decision = approvalDecisionSchema.parse(request.body);
      const approval = await store.resolveApproval({ approvalId, userId: request.principal!.userId, decision: decision.decision });
      if (!approval) return reply.code(409).send({ error: { code: "APPROVAL_ALREADY_RESOLVED", message: "此授权请求已经处理。", requestId: request.id } });
      await store.appendRunEvent(approval.runId, "approval.resolved", { approvalId, decision: decision.decision, resolvedBy: request.principal!.userId });
      await store.updateRunStatus(approval.runId, decision.decision === "approved" ? "running" : "cancelled");
      if (decision.decision === "approved") await dispatcher.enqueueRun(approval.runId);
      const run = await store.getRun(approval.runId);
      await store.appendAudit({ workspaceId: run?.workspaceId, actorUserId: request.principal!.userId, action: `agent.approval.${decision.decision}`, targetType: "approval_request", targetId: approval.id, redactedInput: { toolName: approval.toolName, risk: approval.risk }, resultSummary: decision.decision });
      return approval;
    });
  });

  app.get("/api/v1/audit", { preHandler: requireAuth }, async (request) => {
    return store.runAsUser(request.principal!.userId, async () => {
      const query = z.object({ workspaceId: z.string().uuid(), cursor: z.string().optional(), limit: z.coerce.number().int().min(1).max(100).default(50) }).parse(request.query);
      await store.requireWorkspaceRole(request.principal!.userId, query.workspaceId, ["org_admin", "workspace_owner"]);
      return store.listAudit(query.workspaceId, query.cursor, query.limit);
    });
  });

  app.get("/api/v1/usage", { preHandler: requireAuth }, async (request) => store.runAsUser(request.principal!.userId, async () => {
    const query = z.object({ workspaceId: z.string().uuid() }).parse(request.query);
    await store.requireWorkspaceRole(request.principal!.userId, query.workspaceId, ["org_admin", "workspace_owner", "editor", "viewer"]);
    return store.usageSummary(query.workspaceId);
  }));

  app.get("/api/v1/scheduled-tasks", { preHandler: requireAuth }, async (request) => {
    return store.runAsUser(request.principal!.userId, async () => {
      const query = z.object({ workspaceId: z.string().uuid() }).parse(request.query);
      await store.requireWorkspaceRole(request.principal!.userId, query.workspaceId, ["org_admin", "workspace_owner", "editor", "viewer"]);
      return { items: await store.listScheduledTasks(query.workspaceId) };
    });
  });

  app.post("/api/v1/scheduled-tasks", { preHandler: requireAuth }, async (request, reply) => {
    return store.runAsUser(request.principal!.userId, async () => {
      const input = scheduleSchema.parse(request.body);
      await store.requireWorkspaceRole(request.principal!.userId, input.workspaceId, ["org_admin", "workspace_owner", "editor"]);
      const task = await store.createScheduledTask({ ...input, createdBy: request.principal!.userId });
      await store.appendAudit({ workspaceId: input.workspaceId, actorUserId: request.principal!.userId, action: "scheduled_task.create", targetType: "scheduled_task", targetId: task.id, redactedInput: { name: input.name, cronExpression: input.cronExpression, timezone: input.timezone }, resultSummary: "created" });
      return reply.code(201).send(task);
    });
  });

  app.post("/api/v1/migration/import", { preHandler: requireAuth }, async (request) => {
    return store.runAsUser(request.principal!.userId, async () => {
      const input = migrationImportSchema.parse(request.body);
      await store.requireWorkspaceRole(request.principal!.userId, input.workspaceId, ["org_admin", "workspace_owner", "editor"]);
      const result = await store.importLegacy(input, request.principal!.userId);
      await store.appendAudit({ workspaceId: input.workspaceId, actorUserId: request.principal!.userId, action: "migration.legacy.import", targetType: "migration_import", targetId: input.importId, redactedInput: { conversationCount: input.conversations.length }, resultSummary: result.duplicate ? "duplicate" : `imported:${result.imported}` });
      return result;
    });
  });

  app.get("/v1/models", { preHandler: requireAuth }, async (request) => store.runAsUser(request.principal!.userId, async () => {
    const { provider } = await resolveGateway(request);
    return {
      object: "list",
      data: provider.models.map((id) => ({ id, object: "model", owned_by: provider.scope === "personal" ? "user" : "organization" })),
    };
  }));

  const proxyGateway = async (path: "/v1/chat/completions" | "/v1/images/generations", request: FastifyRequest, reply: FastifyReply) => {
    return store.runAsUser(request.principal!.userId, async () => {
      const body = gatewayBodySchema.parse(request.body);
      const { workspaceId, provider, apiKey } = await resolveGateway(request);
      if (provider.models.length && !provider.models.includes(body.model)) {
        return reply.code(400).send({ error: { code: "MODEL_NOT_ALLOWED", message: "该模型不在当前 Provider 的允许列表中。", requestId: request.id } });
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), path.includes("images") ? 300_000 : 180_000);
      try {
        const upstream = await fetch(`${provider.baseUrl.replace(/\/$/, "")}${path}`, {
          method: "POST",
          signal: controller.signal,
          headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json", accept: "*/*" },
          body: JSON.stringify(body),
        });
        await store.appendAudit({
          workspaceId,
          actorUserId: request.principal!.userId,
          action: `gateway.${path.includes("images") ? "image" : "chat"}`,
          targetType: "provider_profile",
          targetId: provider.id,
          redactedInput: { model: body.model, stream: body.stream === true },
          resultSummary: `status:${upstream.status}`,
        });
        reply.code(upstream.status);
        reply.header("content-type", upstream.headers.get("content-type") ?? "application/json");
        reply.header("cache-control", "no-store");
        if (!upstream.body) {
          clearTimeout(timeout);
          return reply.send();
        }
        const stream = Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]);
        stream.once("close", () => clearTimeout(timeout));
        stream.once("end", () => clearTimeout(timeout));
        return reply.send(stream);
      } catch (error) {
        clearTimeout(timeout);
        throw error;
      }
    });
  };

  app.post("/v1/chat/completions", { preHandler: requireAuth }, async (request, reply) => proxyGateway("/v1/chat/completions", request, reply));
  app.post("/v1/images/generations", { preHandler: requireAuth }, async (request, reply) => proxyGateway("/v1/images/generations", request, reply));

  return app;
}
