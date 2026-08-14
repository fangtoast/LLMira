/**
 * @project LLMira
 * @file src/lib/team/tauriSecrets.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-13
 * @function
 *   - 在 Tauri Stronghold 中保存刷新令牌
 *   - Android 使用系统凭据库，避免桌面 libsodium 交叉编译依赖
 *   - 避免把长期凭据写入浏览器存储
 * @description Web 运行时安全跳过；桌面保留 Stronghold，Android 使用系统 KeyStore 后端。
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
  if (navigator.userAgent.includes("Android")) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("save_device_secret", { account: "llmira.team:refresh-token", secret: token });
    return true;
  }
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
  if (navigator.userAgent.includes("Android")) {
    const { invoke } = await import("@tauri-apps/api/core");
    return (await invoke<string | null>("read_device_secret", {
      account: "llmira.team:refresh-token",
    })) ?? undefined;
  }
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
