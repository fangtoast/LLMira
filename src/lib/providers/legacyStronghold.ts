/**
 * @project LLMira
 * @file src/lib/providers/legacyStronghold.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @function
 *   - 按需读取并清理旧版 Provider Stronghold 凭据
 *   - 将旧凭据迁移到当前系统凭据库
 * @description 迁移代码独立按需加载，避免进入个人工作台首屏包体。
 */

async function openLegacyProviderVault() {
  const [{ Stronghold }, { appDataDir, join }] = await Promise.all([
    import("@tauri-apps/plugin-stronghold"),
    import("@tauri-apps/api/path"),
  ]);
  const snapshotPath = await join(await appDataDir(), "llmira-providers.hold");
  const stronghold = await Stronghold.load(snapshotPath, "llmira-device-provider-v1");
  const client = await stronghold
    .loadClient("llmira-providers")
    .catch(() => stronghold.createClient("llmira-providers"));
  return { stronghold, store: client.getStore() };
}

export async function migrateLegacyProviderSecret(
  secretId: string,
  saveSecret: (secretId: string, secret: string) => Promise<void>,
): Promise<string | undefined> {
  const { stronghold, store } = await openLegacyProviderVault();
  try {
    const key = `provider:${secretId}`;
    const value = await store.get(key);
    const decoded = value ? new TextDecoder().decode(value) : undefined;
    if (!decoded) return undefined;
    await saveSecret(secretId, decoded);
    await store.remove(key);
    await stronghold.save();
    return decoded;
  } finally {
    await stronghold.unload();
  }
}

export async function deleteLegacyProviderSecret(secretId: string): Promise<void> {
  const { stronghold, store } = await openLegacyProviderVault();
  try {
    await store.remove(`provider:${secretId}`);
    await stronghold.save();
  } finally {
    await stronghold.unload();
  }
}
