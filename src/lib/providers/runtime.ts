/**
 * @project LLMira
 * @file src/lib/providers/runtime.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @function
 *   - 为 Tauri 与 Web 选择 HTTP transport
 *   - 将设备秘密保存到操作系统凭据库
 * @description Web 仅保留会话内存密钥；Tauri 使用插件 HTTP 与系统凭据库，不写 localStorage。
 */

const memorySecrets = new Map<string, string>();
const LEGACY_STRONGHOLD_CLIENT = "llmira-providers";
const LEGACY_STRONGHOLD_PASSWORD = "llmira-device-provider-v1";

/** 当前是否运行在 Tauri 2 WebView。 */
export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** 使用 Tauri HTTP 插件直连 Provider；普通 Web 使用标准 fetch。 */
export async function runtimeFetch(input: URL | RequestInfo, init?: RequestInit): Promise<Response> {
  if (!isTauriRuntime()) return fetch(input, init);
  const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
  return tauriFetch(input, init);
}

function secretAccount(secretId: string): string {
  return `llmira.provider:${encodeURIComponent(secretId)}`;
}

async function readNativeSecret(secretId: string): Promise<string | undefined> {
  const { invoke } = await import("@tauri-apps/api/core");
  return (await invoke<string | null>("read_device_secret", { account: secretAccount(secretId) })) ?? undefined;
}

async function saveNativeSecret(secretId: string, secret: string): Promise<void> {
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("save_device_secret", { account: secretAccount(secretId), secret });
}

async function deleteNativeSecret(secretId: string): Promise<void> {
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("delete_device_secret", { account: secretAccount(secretId) });
}

/** 打开旧版固定口令 Stronghold，仅用于将已有秘密迁入系统凭据库。 */
async function openLegacyProviderVault() {
  const [{ Stronghold }, { appDataDir, join }] = await Promise.all([
    import("@tauri-apps/plugin-stronghold"),
    import("@tauri-apps/api/path"),
  ]);
  const snapshotPath = await join(await appDataDir(), "llmira-providers.hold");
  const stronghold = await Stronghold.load(snapshotPath, LEGACY_STRONGHOLD_PASSWORD);
  const client = await stronghold
    .loadClient(LEGACY_STRONGHOLD_CLIENT)
    .catch(() => stronghold.createClient(LEGACY_STRONGHOLD_CLIENT));
  return { stronghold, store: client.getStore() };
}

async function migrateLegacySecret(secretId: string): Promise<string | undefined> {
  try {
    const { stronghold, store } = await openLegacyProviderVault();
    try {
      const key = `provider:${secretId}`;
      const value = await store.get(key);
      const decoded = value ? new TextDecoder().decode(value) : undefined;
      if (!decoded) return undefined;
      await saveNativeSecret(secretId, decoded);
      await store.remove(key);
      await stronghold.save();
      return decoded;
    } finally {
      await stronghold.unload();
    }
  } catch {
    return undefined;
  }
}

/** 保存设备秘密；Web 只保存到当前页面会话内存。 */
export async function saveProviderSecret(providerId: string, apiKey: string): Promise<void> {
  if (isTauriRuntime()) await saveNativeSecret(providerId, apiKey);
  memorySecrets.set(providerId, apiKey);
}

/** 读取设备秘密；首次读取时自动迁移旧版 Stronghold 记录。 */
export async function readProviderSecret(providerId: string): Promise<string | undefined> {
  const cached = memorySecrets.get(providerId);
  if (cached !== undefined) return cached;
  if (!isTauriRuntime()) return undefined;
  const secret = (await readNativeSecret(providerId)) ?? (await migrateLegacySecret(providerId));
  if (secret) memorySecrets.set(providerId, secret);
  return secret;
}

/** 删除设备秘密；用于移除 Provider、搜索凭据或 MCP 配置。 */
export async function deleteProviderSecret(providerId: string): Promise<void> {
  memorySecrets.delete(providerId);
  if (!isTauriRuntime()) return;
  await deleteNativeSecret(providerId);
  try {
    const { stronghold, store } = await openLegacyProviderVault();
    try {
      await store.remove(`provider:${providerId}`);
      await stronghold.save();
    } finally {
      await stronghold.unload();
    }
  } catch {
    // 删除不存在的旧版记录视为幂等成功。
  }
}
