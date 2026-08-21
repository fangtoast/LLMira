/**
 * @project LLMira
 * @file scripts/sync-android-icons.mjs
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-21
 * @description 将仓库中的统一 M 品牌图标同步到 Tauri Android 生成工程。
 */
import { cp, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const sourceRoot = join(projectRoot, "src-tauri", "icons", "android");
const targetRoot = join(projectRoot, "src-tauri", "gen", "android", "app", "src", "main", "res");
const iconFiles = [
  "mipmap-anydpi-v26/ic_launcher.xml",
  "mipmap-hdpi/ic_launcher.png",
  "mipmap-hdpi/ic_launcher_foreground.png",
  "mipmap-hdpi/ic_launcher_round.png",
  "mipmap-mdpi/ic_launcher.png",
  "mipmap-mdpi/ic_launcher_foreground.png",
  "mipmap-mdpi/ic_launcher_round.png",
  "mipmap-xhdpi/ic_launcher.png",
  "mipmap-xhdpi/ic_launcher_foreground.png",
  "mipmap-xhdpi/ic_launcher_round.png",
  "mipmap-xxhdpi/ic_launcher.png",
  "mipmap-xxhdpi/ic_launcher_foreground.png",
  "mipmap-xxhdpi/ic_launcher_round.png",
  "mipmap-xxxhdpi/ic_launcher.png",
  "mipmap-xxxhdpi/ic_launcher_foreground.png",
  "mipmap-xxxhdpi/ic_launcher_round.png",
  "values/ic_launcher_background.xml",
];

await mkdir(targetRoot, { recursive: true });
for (const relativePath of iconFiles) {
  const destination = join(targetRoot, relativePath);
  await mkdir(join(destination, ".."), { recursive: true });
  await cp(join(sourceRoot, relativePath), destination, { force: true });
}

console.log(`Synchronized ${iconFiles.length} Android brand icon resources.`);
