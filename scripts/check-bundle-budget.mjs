/**
 * @project LLMira
 * @file scripts/check-bundle-budget.mjs
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-13
 * @description 统计首页初始脚本 gzip 体积并执行 215 kB 门禁。
 */
import { readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";

const html = await readFile(new URL("../out/index.html", import.meta.url), "utf8");
const sources = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map((match) => match[1]);
const uniqueSources = [...new Set(sources)];
let gzipBytes = 0;
for (const source of uniqueSources) {
  const bytes = await readFile(new URL(`../out${source}`, import.meta.url));
  gzipBytes += gzipSync(bytes).byteLength;
}
const gzipKilobytes = gzipBytes / 1024;
process.stdout.write(`Initial JS: ${gzipKilobytes.toFixed(1)} kB gzip (${uniqueSources.length} files)\n`);
if (gzipKilobytes > 215) {
  throw new Error(`Initial JS exceeds the 215 kB gzip budget by ${(gzipKilobytes - 215).toFixed(1)} kB.`);
}
