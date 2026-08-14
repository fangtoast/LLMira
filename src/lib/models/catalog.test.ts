/**
 * @project LLMira
 * @file src/lib/models/catalog.test.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @description 模型家族、排序、收藏和推理参数规则单元测试。
 */
import { describe, expect, it } from "vitest";
import type { ProviderModel } from "@llmira/contracts";
import { buildModelPresentations, groupModelPresentations, inferModelFamily, resolveReasoningEffort } from "./catalog";

const capabilities = { chat: true, vision: false, imageGeneration: false, reasoning: false, tools: true, nativeWebSearch: false };
const model = (id: string, ownedBy?: string): ProviderModel => ({ providerId: "p", id, name: id, ownedBy, capabilities, source: "rule" });

describe("model catalog", () => {
  it("识别常见家族并将未知模型回退到其他", () => {
    const cases = [
      ["gpt5.6", "openai"],
      ["gpt-demo", "openai"],
      ["claude-4.1-sonnet", "anthropic"],
      ["deepseek-r1", "deepseek"],
      ["gemini-3-pro", "google"],
      ["qwq-32b", "qwen"],
      ["glm-5", "glm"],
      ["kimi-k2", "kimi"],
      ["MiniMax-M2.5", "minimax"],
      ["llama-4", "meta"],
      ["codestral-25.01", "mistral"],
      ["grok-4", "xai"],
      ["doubao-seed-1.6", "doubao"],
      ["hunyuan-t1", "hunyuan"],
      ["command-r-plus", "cohere"],
      ["baichuan4", "baichuan"],
      ["yi-large", "yi"],
      ["step-2-16k", "stepfun"],
      ["sonar-pro", "perplexity"],
      ["mimo-v2", "xiaomi"],
    ] as const;
    cases.forEach(([id, family]) => expect(inferModelFamily(model(id))).toBe(family));
    expect(inferModelFamily(model("private-model"))).toBe("other");
    expect(inferModelFamily(model("gateway-id", "moonshot"))).toBe("kimi");
  });

  it("模型名称优先于网关统一返回的 ownedBy", () => {
    expect(inferModelFamily(model("Qwen3.8-Max", "openai"))).toBe("qwen");
    expect(inferModelFamily(model("MiniMax-M2.7", "openai"))).toBe("minimax");
    expect(inferModelFamily(model("DeepSeek-V4-Pro", "openai"))).toBe("deepseek");
    expect(inferModelFamily(model("Claude-Sonnet-4.6", "openai"))).toBe("anthropic");
    expect(inferModelFamily(model("gateway-private-model", "openai"))).toBe("other");
    expect(inferModelFamily(model("gateway-private-model", "moonshot"))).toBe("kimi");
  });

  it("保留图片专用模型，交由选择器按能力筛选", () => {
    const imageOnly = { ...model("gpt-image-1"), capabilities: { ...capabilities, chat: false, imageGeneration: true } };
    expect(buildModelPresentations([imageOnly], []).map((item) => item.id)).toEqual(["gpt-image-1"]);
  });

  it("收藏置顶且家族内自然数字降序", () => {
    const items = buildModelPresentations([model("gpt-4"), model("gpt-10"), model("claude-4")], ["claude-4"]);
    const sections = groupModelPresentations(items, "all");
    expect(sections[0]?.id).toBe("favorites");
    expect(sections.find((section) => section.id === "openai")?.models.map((item) => item.id)).toEqual(["gpt-10", "gpt-4"]);
  });

  it("按名称、ID 或家族搜索，并支持只看收藏", () => {
    const items = buildModelPresentations([model("gpt-5"), model("claude-sonnet")], ["gpt-5"]);
    expect(groupModelPresentations(items, "favorites").flatMap((section) => section.models).map((item) => item.id)).toEqual(["gpt-5"]);
    expect(groupModelPresentations(items, "all", "Anthropic").flatMap((section) => section.models).map((item) => item.id)).toEqual(["claude-sonnet"]);
  });

  it("仅为支持推理的模型映射三级参数", () => {
    expect(resolveReasoningEffort("auto", true)).toBeUndefined();
    expect(resolveReasoningEffort("low", true)).toBe("low");
    expect(resolveReasoningEffort("medium", true)).toBe("medium");
    expect(resolveReasoningEffort("high", true)).toBe("high");
    expect(resolveReasoningEffort("high", false)).toBeUndefined();
  });
});
