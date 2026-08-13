/**
 * @project LLMira
 * @file packages/security/src/index.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-13
 * @function
 *   - 提供 API 与 Worker 共用的密钥信封加密
 *   - 生成不可逆的刷新令牌摘要
 * @description 仅供服务端工作区使用，不允许打包进浏览器客户端。
 */
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";

/** 将任意主密钥材料归一化为 32 字节 AES 密钥。 */
export function deriveEncryptionKey(material: string): Buffer {
  return createHash("sha256").update(material).digest();
}

/** 使用 AES-256-GCM 加密敏感字符串。 */
export function encryptSecret(plainText: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

/** 解密版本化密钥信封。 */
export function decryptSecret(envelope: string, key: Buffer): string {
  const [version, ivPart, tagPart, payloadPart] = envelope.split(".");
  if (version !== VERSION || !ivPart || !tagPart || !payloadPart) throw new Error("Unsupported encrypted secret envelope.");
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(payloadPart, "base64url")), decipher.final()]).toString("utf8");
}

/** 为刷新令牌等一次性凭据生成稳定摘要。 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** 为审计界面生成不会泄漏完整密钥的标识。 */
export function redactSecret(value: string): string {
  if (value.length < 8) return "••••••••";
  return `${value.slice(0, 3)}••••${value.slice(-3)}`;
}
