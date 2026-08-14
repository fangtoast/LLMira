/**
 * @project LLMira
 * @file packages/provider-core/src/index.test.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @description OpenAI-compatible 模型扫描与错误分类测试。
 */
import { describe, expect, it, vi } from "vitest";
import {
  inspectOpenAICompatibleProvider,
  normalizeProviderBaseUrl,
  parseProviderModels,
  ProviderInspectError,
} from "./index.js";

describe("provider core", () => {
  it("normalizes the base URL and keeps localhost HTTP", () => {
    expect(normalizeProviderBaseUrl("http://127.0.0.1:8080/v1/ ")).toBe("http://127.0.0.1:8080");
    expect(() => normalizeProviderBaseUrl("http://example.com/v1")).toThrowError(ProviderInspectError);
  });

  it("parses standard and nested model arrays", () => {
    expect(parseProviderModels({ data: [{ id: "gpt-5" }, { id: "claude-4" }] }).map((item) => item.id)).toEqual(["gpt-5", "claude-4"]);
    expect(parseProviderModels({ data: { models: [{ model: "deepseek-r1" }] } }).map((item) => item.id)).toEqual(["deepseek-r1"]);
  });

  it("scans GPT and Claude from one gateway", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ data: [{ id: "gpt-5" }, { id: "claude-4" }] }), { status: 200 })) as unknown as typeof fetch;
    const result = await inspectOpenAICompatibleProvider({
      providerId: "provider-1",
      baseUrl: "https://gateway.example/v1",
      apiKey: "secret-key",
      fetchImpl,
    });
    expect(result.models.map((model) => model.id)).toEqual(["gpt-5", "claude-4"]);
    expect(fetchImpl).toHaveBeenCalledWith("https://gateway.example/v1/models", expect.objectContaining({ method: "GET" }));
  });

  it("classifies invalid JSON", async () => {
    const fetchImpl = vi.fn(async () => new Response("not json", { status: 200 })) as unknown as typeof fetch;
    await expect(inspectOpenAICompatibleProvider({ providerId: "p", baseUrl: "https://gateway.example", apiKey: "key", fetchImpl })).rejects.toMatchObject({ code: "invalid_json" });
  });
});
