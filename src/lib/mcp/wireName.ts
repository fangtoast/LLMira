/**
 * @project LLMira
 * @file src/lib/mcp/wireName.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @function 为 OpenAI-compatible tools 生成稳定、ASCII 且不冲突的线名
 * @description 界面保留原名；协议层线名限制为 63 个字符并包含 serverId 与 toolName 哈希。
 */

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(7, "0").slice(-7);
}

function asciiSlug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 42) || "tool";
}

export function createMcpToolWireName(serverId: string, toolName: string): string {
  const hash = fnv1a(`${serverId}\0${toolName}`);
  return `mcp_${asciiSlug(toolName)}_${hash}`.slice(0, 63);
}
