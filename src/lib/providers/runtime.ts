/**
 * @project LLMira
 * @file src/lib/providers/runtime.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @function
 *   - 为 Tauri 与 Web 选择 HTTP transport
 *   - 将设备 Provider 密钥保存到 Stronghold
 * @description Web 仅保留会话内存密钥；Tauri 使用插件 HTTP 与 Stronghold，不写 localStorage。
 */

const memorySecrets = new Map<string, string>();
const STRONGHOLD_CLIENT = "llmira-providers";
const STRONGHOLD_PASSWORD = "llmira-device-provider-v1";

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

async function openProviderVault() {
  const [{ Stronghold }, { appDataDir, join }] = await Promise.all([
    import("@tauri-apps/plugin-stronghold"),
    import("@tauri-apps/api/path"),
  ]);
  const snapshotPath = await join(await appDataDir(), "llmira-providers.hold");
  const stronghold = await Stronghold.load(snapshotPath, STRONGHOLD_PASSWORD);
  const client = await stronghold
    .loadClient(STRONGHOLD_CLIENT)
    .catch(() => stronghold.createClient(STRONGHOLD_CLIENT));
  return { stronghold, store: client.getStore() };
}

/** 保存 Provider 密钥；Web 只保存到当前页面会话内存。 */
export async function saveProviderSecret(providerId: string, apiKey: string): Promise<void> {
  memorySecrets.set(providerId, apiKey);
  if (!isTauriRuntime()) return;
  const { stronghold, store } = await openProviderVault();
  try {
    await store.insert(`provider:${providerId}`, Array.from(new TextEncoder().encode(apiKey)));
    await stronghold.save();
  } finally {
    await stronghold.unload();
  }
}

/** 读取 Provider 密钥；不会返回 Stronghold 路径或引用。 */
export async function readProviderSecret(providerId: string): Promise<string | undefined> {
  const cached = memorySecrets.get(providerId);
  if (cached !== undefined) return cached;
  if (!isTauriRuntime()) return undefined;
  try {
    const { stronghold, store } = await openProviderVault();
    try {
      const value = await store.get(`provider:${providerId}`);
      const decoded = value ? new TextDecoder().decode(value) : undefined;
      if (decoded) memorySecrets.set(providerId, decoded);
      return decoded;
    } finally {
      await stronghold.unload();
    }
  } catch {
    return undefined;
  }
}

/** 删除 Provider 密钥；用于移除 Provider。 */
export async function deleteProviderSecret(providerId: string): Promise<void> {
  memorySecrets.delete(providerId);
  if (!isTauriRuntime()) return;
  try {
    const { stronghold, store } = await openProviderVault();
    try {
      await store.remove(`provider:${providerId}`);
      await stronghold.save();
    } finally {
      await stronghold.unload();
    }
  } catch {
    // 删除不存在的记录视为幂等成功。
  }
}
