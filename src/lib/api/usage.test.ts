/**
 * @project LLMira
 * @file src/lib/api/usage.test.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @description OpenAI-compatible usage field normalization tests.
 */
import { describe, expect, it } from "vitest";
import { normalizeTokenUsage } from "./client";

describe("normalizeTokenUsage", () => {
  it("读取标准、缓存和推理字段", () => {
    expect(normalizeTokenUsage({ prompt_tokens: 100, completion_tokens: 40, total_tokens: 140, prompt_tokens_details: { cached_tokens: 20 }, completion_tokens_details: { reasoning_tokens: 12 } })).toEqual({ promptTokens: 100, cachedPromptTokens: 20, completionTokens: 40, reasoningTokens: 12, totalTokens: 140, requestCount: 1 });
  });

  it("兼容 input/output 命名且缺失时不猜测", () => {
    expect(normalizeTokenUsage({ input_tokens: 10, output_tokens: 5 })).toMatchObject({ promptTokens: 10, completionTokens: 5, totalTokens: 15 });
    expect(normalizeTokenUsage({ prompt_tokens: 10 })).toBeUndefined();
  });
});
