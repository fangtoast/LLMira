/**
 * @project LLMira
 * @file apps/worker/src/network.test.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-13
 * @description 验证网页摄取拒绝本机、内网、凭据 URL 与危险协议。
 */
import { describe, expect, it } from "vitest";
import { assertSafePublicUrl } from "./network.js";

describe("knowledge crawler SSRF guard", () => {
  it.each([
    "http://127.0.0.1/admin",
    "http://10.0.0.8/secret",
    "http://192.168.1.20/",
    "http://[::1]/",
    "file:///etc/passwd",
    "http://user:password@example.com/",
  ])("rejects private or credentialed URL %s", async (url) => {
    await expect(assertSafePublicUrl(url)).rejects.toThrow();
  });

  it("accepts a public literal address", async () => {
    await expect(assertSafePublicUrl("https://1.1.1.1/docs")).resolves.toMatchObject({ protocol: "https:" });
  });
});
