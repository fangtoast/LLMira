/**
 * @project LLMira
 * @file apps/api/src/security/secrets.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-13
 * @function
 *   - 使用 AES-256-GCM 加密团队与个人 Provider 密钥
 *   - 生成可轮换的版本化密文封装
 * @description 原始密钥仅在调用边界短暂解密，不允许进入日志或 API 响应。
 */
export { decryptSecret, encryptSecret, redactSecret } from "@llmira/security";
