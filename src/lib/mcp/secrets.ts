/**
 * @project LLMira
 * @file src/lib/mcp/secrets.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @function MCP 秘密字段的 Stronghold 与 Web 会话内存适配
 * @description 复用设备安全仓库；序列化值永不进入设置持久化、日志或备份。
 */
import { deleteProviderSecret, readProviderSecret, saveProviderSecret } from "@/lib/providers/runtime";

export interface McpSecretBundle {
  bearerToken?: string;
  environment?: Record<string, string>;
  sensitiveHeaders?: Record<string, string>;
}

function secretId(serverId: string) {
  return `mcp:${serverId}`;
}

export async function saveMcpSecrets(serverId: string, secrets: McpSecretBundle): Promise<void> {
  const normalized: McpSecretBundle = {
    bearerToken: secrets.bearerToken?.trim() || undefined,
    environment: Object.fromEntries(Object.entries(secrets.environment ?? {}).filter(([name, value]) => name.trim() && value)),
    sensitiveHeaders: Object.fromEntries(Object.entries(secrets.sensitiveHeaders ?? {}).filter(([name, value]) => name.trim() && value)),
  };
  await saveProviderSecret(secretId(serverId), JSON.stringify(normalized));
}

export async function readMcpSecrets(serverId: string): Promise<McpSecretBundle> {
  const raw = await readProviderSecret(secretId(serverId));
  if (!raw) return {};
  try {
    return JSON.parse(raw) as McpSecretBundle;
  } catch {
    return {};
  }
}

export async function deleteMcpSecrets(serverId: string): Promise<void> {
  await deleteProviderSecret(secretId(serverId));
}
