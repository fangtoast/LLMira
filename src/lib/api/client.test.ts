/**
 * @project LLMira
 * @file src/lib/api/client.test.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-15
 * @description Provider API Host 显式配置与规范化回归测试。
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeBaseUrl } from "./client";
import { MissingApiBaseUrlError } from "./types";

describe("normalizeBaseUrl", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("移除末尾斜杠与 OpenAI v1 后缀", () => {
    expect(normalizeBaseUrl("https://api.example.com/v1///")).toBe("https://api.example.com");
  });

  it("未配置地址时明确拒绝请求", () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");
    expect(() => normalizeBaseUrl(" ")).toThrow(MissingApiBaseUrlError);
  });
});
