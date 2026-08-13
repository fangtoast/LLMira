/**
 * @project LLMira
 * @file apps/worker/src/network.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-13
 * @function
 *   - 校验网页知识源的协议、主机和解析地址
 *   - 阻止本机、内网、链路本地与云元数据地址
 * @description 每次重定向都由调用方重新校验，避免 DNS/重定向型 SSRF。
 */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

function isPrivateIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  return octets[0] === 10 ||
    octets[0] === 127 ||
    (octets[0] === 169 && octets[1] === 254) ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168) ||
    octets[0] === 0;
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  return normalized === "::1" || normalized === "::" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb");
}

/** 确认 URL 只能访问公开 HTTP(S) 地址。 */
export async function assertSafePublicUrl(rawUrl: string): Promise<URL> {
  const url = new URL(rawUrl);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error("UNSAFE_URL_PROTOCOL");
  if (url.username || url.password) throw new Error("URL_CREDENTIALS_FORBIDDEN");
  const lowerHost = url.hostname.toLowerCase();
  if (lowerHost === "localhost" || lowerHost.endsWith(".local")) throw new Error("PRIVATE_HOST_FORBIDDEN");
  const addresses = isIP(url.hostname)
    ? [{ address: url.hostname, family: isIP(url.hostname) }]
    : await lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address, family }) => family === 4 ? isPrivateIpv4(address) : isPrivateIpv6(address))) {
    throw new Error("PRIVATE_ADDRESS_FORBIDDEN");
  }
  return url;
}

/** 最多跟随三次重定向，并在每一步重新执行 SSRF 校验。 */
export async function safeFetch(rawUrl: string, signal: AbortSignal): Promise<Response> {
  let current = await assertSafePublicUrl(rawUrl);
  for (let redirect = 0; redirect <= 3; redirect += 1) {
    const response = await fetch(current, { redirect: "manual", signal, headers: { "user-agent": "LLMiraKnowledgeBot/1.0" } });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get("location");
    if (!location) throw new Error("REDIRECT_WITHOUT_LOCATION");
    current = await assertSafePublicUrl(new URL(location, current).toString());
  }
  throw new Error("TOO_MANY_REDIRECTS");
}
