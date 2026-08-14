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
    expect(inferModelFamily(model("gpt-5.5"))).toBe("openai");
    expect(inferModelFamily(model("claude-4.1-sonnet"))).toBe("anthropic");
    expect(inferModelFamily(model("deepseek-r1"))).toBe("deepseek");
    expect(inferModelFamily(model("private-model"))).toBe("other");
    expect(inferModelFamily(model("gateway-id", "moonshot"))).toBe("kimi");
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
