/**
 * @project LLMira
 * @file src/lib/search/webSearch.test.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @description 联网抓取 SSRF URL 边界测试。
 */
import { describe, expect, it } from "vitest";
import { assertPublicHttpUrl } from "./webSearch";

describe("search URL safety", () => {
  it.each(["http://127.0.0.1/a", "http://192.168.1.2", "http://169.254.169.254/latest", "https://user:pass@example.com", "file:///etc/passwd"])("blocks %s", (url) => expect(() => assertPublicHttpUrl(url)).toThrow());
  it("accepts a public https URL", () => expect(assertPublicHttpUrl("https://example.com/news").hostname).toBe("example.com"));
});
