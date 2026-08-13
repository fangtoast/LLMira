/**
 * @project LLMira
 * @file apps/api/src/config.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-13
 * @function
 *   - 校验团队 API 的运行时配置
 *   - 为本地开发提供非生产默认值
 * @description 生产环境拒绝弱 JWT 与加密密钥，避免误部署。
 */
import { z } from "zod";
import { deriveEncryptionKey } from "@llmira/security";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  DATABASE_URL: z.string().url().default("postgres://llmira:llmira@localhost:5432/llmira"),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  JWT_SECRET: z.string().min(32).default("development-only-change-this-jwt-secret"),
  ENCRYPTION_MASTER_KEY: z.string().min(16).default("development-only-master-key"),
  PUBLIC_APP_ORIGIN: z.string().url().default("http://localhost:3000"),
  COOKIE_SECURE: z.enum(["true", "false"]).default("false"),
  TRUST_PROXY: z.enum(["true", "false"]).default("false"),
  S3_ENDPOINT: z.string().url().default("http://localhost:9000"),
  S3_REGION: z.string().min(1).default("us-east-1"),
  S3_BUCKET: z.string().min(1).default("llmira"),
  S3_ACCESS_KEY: z.string().min(1).default("llmira"),
  S3_SECRET_KEY: z.string().min(1).default("llmira-development"),
});

export interface ApiConfig {
  nodeEnv: "development" | "test" | "production";
  host: string;
  port: number;
  databaseUrl: string;
  redisUrl: string;
  jwtSecret: string;
  encryptionKey: Buffer;
  publicAppOrigin: string;
  cookieSecure: boolean;
  trustProxy: boolean;
  s3Endpoint: string;
  s3Region: string;
  s3Bucket: string;
  s3AccessKey: string;
  s3SecretKey: string;
}

/** 读取并验证 API 环境变量。 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const parsed = envSchema.parse(env);
  if (
    parsed.NODE_ENV === "production" &&
    (parsed.JWT_SECRET.startsWith("development-only") ||
      parsed.ENCRYPTION_MASTER_KEY.startsWith("development-only"))
  ) {
    throw new Error("Production requires explicit JWT_SECRET and ENCRYPTION_MASTER_KEY values.");
  }

  return {
    nodeEnv: parsed.NODE_ENV,
    host: parsed.HOST,
    port: parsed.PORT,
    databaseUrl: parsed.DATABASE_URL,
    redisUrl: parsed.REDIS_URL,
    jwtSecret: parsed.JWT_SECRET,
    encryptionKey: deriveEncryptionKey(parsed.ENCRYPTION_MASTER_KEY),
    publicAppOrigin: parsed.PUBLIC_APP_ORIGIN,
    cookieSecure: parsed.COOKIE_SECURE === "true",
    trustProxy: parsed.TRUST_PROXY === "true",
    s3Endpoint: parsed.S3_ENDPOINT,
    s3Region: parsed.S3_REGION,
    s3Bucket: parsed.S3_BUCKET,
    s3AccessKey: parsed.S3_ACCESS_KEY,
    s3SecretKey: parsed.S3_SECRET_KEY,
  };
}
