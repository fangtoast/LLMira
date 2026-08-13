/**
 * @project LLMira
 * @file apps/api/src/auth.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-13
 * @function
 *   - 签发短期访问令牌与旋转刷新令牌
 *   - 为浏览器 Cookie 和 Tauri Bearer 模式提供统一认证
 * @description 刷新令牌仅以 SHA-256 摘要持久化，原文只发送一次。
 */
import { randomBytes } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { v7 as uuidv7 } from "uuid";
import { hashToken } from "@llmira/security";
import type { ApiConfig } from "./config.js";
import type { Principal, TeamStore } from "./store/types.js";

declare module "fastify" {
  interface FastifyRequest {
    principal?: Principal;
  }
}

const ACCESS_COOKIE = "llmira_access";
const REFRESH_COOKIE = "llmira_refresh";

export function hashRefreshToken(token: string): string {
  return hashToken(token);
}

/** 签发并写入浏览器 Cookie；Tauri 可同时读取响应中的令牌。 */
export async function issueSession(
  app: FastifyInstance,
  reply: FastifyReply,
  store: TeamStore,
  config: ApiConfig,
  principal: Principal,
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const accessToken = app.jwt.sign(
    { organizationId: principal.organizationId, role: principal.organizationRole, email: principal.email },
    { sub: principal.userId, expiresIn: "15m" },
  );
  const refreshToken = randomBytes(32).toString("base64url");
  await store.storeRefreshSession({
    id: uuidv7(),
    userId: principal.userId,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });
  const cookieBase = { httpOnly: true, secure: config.cookieSecure, sameSite: "lax" as const, path: "/" };
  reply.setCookie(ACCESS_COOKIE, accessToken, { ...cookieBase, maxAge: 15 * 60 });
  reply.setCookie(REFRESH_COOKIE, refreshToken, { ...cookieBase, maxAge: 30 * 24 * 60 * 60 });
  return { accessToken, refreshToken, expiresIn: 15 * 60 };
}

/** Fastify 保护路由前置钩子。 */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const token = request.cookies[ACCESS_COOKIE];
    const payload = await request.jwtVerify<{ sub: string; organizationId: string; role: "org_admin" | "member"; email: string }>({
      onlyCookie: Boolean(token),
    });
    const displayName = typeof request.headers["x-llmira-display-name"] === "string"
      ? request.headers["x-llmira-display-name"]
      : payload.email.split("@")[0] ?? "成员";
    request.principal = {
      userId: payload.sub,
      organizationId: payload.organizationId,
      organizationRole: payload.role,
      email: payload.email,
      displayName,
    };
  } catch {
    await reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "登录状态已失效，请重新登录。", requestId: request.id } });
  }
}

export const authCookies = { access: ACCESS_COOKIE, refresh: REFRESH_COOKIE };
