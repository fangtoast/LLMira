/**
 * @project LLMira
 * @file scripts/check-bundle-budget.mjs
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-13
 * @description 统计首页初始脚本 gzip 体积并执行 265 kB 门禁；同时阻止 Lobe React 图标整包进入客户端。
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
const budgetKilobytes = 265;
if (gzipKilobytes > budgetKilobytes) {
  throw new Error(`Initial JS exceeds the ${budgetKilobytes} kB gzip budget by ${(gzipKilobytes - budgetKilobytes).toFixed(1)} kB.`);
}

const modelIconSource = await readFile(new URL("../src/components/models/ModelIcon.tsx", import.meta.url), "utf8");
if (/from\s+["']@lobehub\/icons(?:["']|\/es\/icons)/.test(modelIconSource)) {
  throw new Error("ModelIcon must use curated static Lobe SVG assets; importing the React barrel would inflate the client bundle.");
}
