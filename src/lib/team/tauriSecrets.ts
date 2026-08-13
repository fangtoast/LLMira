/**
 * @project LLMira
 * @file src/lib/team/tauriSecrets.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-13
 * @function
 *   - 在 Tauri Stronghold 中保存刷新令牌
 *   - 避免把长期凭据写入浏览器存储
 * @description Web 运行时安全跳过；Tauri 外壳提供设备派生密码。
 */

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** 将刷新令牌写入 Stronghold；非 Tauri 环境安全跳过。 */
export async function saveTauriRefreshToken(
  token: string,
  devicePassword: string,
): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  const [{ Stronghold }, { appDataDir, join }] = await Promise.all([
    import("@tauri-apps/plugin-stronghold"),
    import("@tauri-apps/api/path"),
  ]);
  const snapshotPath = await join(await appDataDir(), "llmira-vault.hold");
  const stronghold = await Stronghold.load(snapshotPath, devicePassword);
  const client = await stronghold
    .loadClient("llmira")
    .catch(() => stronghold.createClient("llmira"));
  await client.getStore().insert("refresh-token", Array.from(new TextEncoder().encode(token)));
  await stronghold.save();
  await stronghold.unload();
  return true;
}

/** 从 Stronghold 读取刷新令牌；非 Tauri 环境返回空。 */
export async function readTauriRefreshToken(
  devicePassword: string,
): Promise<string | undefined> {
  if (!isTauriRuntime()) return undefined;
  const [{ Stronghold }, { appDataDir, join }] = await Promise.all([
    import("@tauri-apps/plugin-stronghold"),
    import("@tauri-apps/api/path"),
  ]);
  const snapshotPath = await join(await appDataDir(), "llmira-vault.hold");
  const stronghold = await Stronghold.load(snapshotPath, devicePassword);
  const client = await stronghold.loadClient("llmira");
  const value = await client.getStore().get("refresh-token");
  await stronghold.unload();
  return value ? new TextDecoder().decode(value) : undefined;
}
