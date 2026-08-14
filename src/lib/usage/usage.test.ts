/**
 * @project LLMira
 * @file src/lib/usage/usage.test.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @description Usage aggregation, pricing precedence, heat levels and multi-request token accumulation tests.
 */
import { describe, expect, it } from "vitest";
import { aggregateDaily, calculateStreaks, heatLevel, summarizeUsage } from "./analytics";
import { calculateUsageCost, convertUsdToCny, pricingOverrideKey } from "./pricing";
import { sumTokenUsage, tokenBreakdownFromUsage } from "./tokens";
import type { UsageEvent } from "./types";

function event(day: string, tokens = 100, overrides: Partial<UsageEvent> = {}): UsageEvent {
  return {
    id: day,
    operationId: day,
    occurredAt: new Date(`${day}T12:00:00`).getTime(),
    kind: "chat",
    status: "completed",
    durationMs: 100,
    tokens: { input: tokens / 2, cachedInput: 0, output: tokens / 2, reasoning: 0, total: tokens },
    tokenDataAvailable: true,
    pricingSource: "unknown",
    ...overrides,
  };
}

describe("usage analytics", () => {
  it("聚合每日 Token、费用和调用数", () => {
    const values = aggregateDaily([event("2026-08-10", 100, { costUsd: 0.1 }), event("2026-08-10", 50, { costUsd: 0.2 })]);
    expect(values.get("2026-08-10")).toEqual({ tokens: 150, calls: 2, costUsd: 0.30000000000000004 });
  });

  it("计算当前与最长连续活跃天数", () => {
    const events = [event("2026-08-10"), event("2026-08-11"), event("2026-08-13"), event("2026-08-14")];
    expect(calculateStreaks(events, new Date("2026-08-14T12:00:00").getTime())).toEqual({ current: 2, longest: 2 });
    expect(summarizeUsage(events, new Date("2026-08-14T12:00:00").getTime()).peakDailyTokens).toBe(100);
  });

  it("根据非零分布生成稳定热力档位", () => {
    expect(heatLevel(0, [1, 10, 100])).toBe(0);
    expect(heatLevel(1, [1, 10, 100, 1000])).toBe(1);
    expect(heatLevel(1000, [1, 10, 100, 1000])).toBe(4);
  });
});

describe("usage pricing and accumulation", () => {
  const tokens = { input: 1_000_000, cachedInput: 200_000, output: 100_000, reasoning: 25_000, total: 1_100_000 };

  it("手动覆盖优先于内置精确价格", () => {
    const override = { providerId: "p1", modelId: "gpt-5.4", inputUsdPerMillion: 1, cachedInputUsdPerMillion: 0.1, outputUsdPerMillion: 2, updatedAt: 1 };
    const result = calculateUsageCost({ providerId: "p1", modelId: "gpt-5.4", tokens, overrides: { [pricingOverrideKey("p1", "gpt-5.4")]: override } });
    expect(result).toMatchObject({ source: "override", costUsd: 1.02 });
  });

  it("未知模型不猜测价格", () => {
    expect(calculateUsageCost({ providerId: "p1", modelId: "private-model", tokens })).toEqual({ source: "unknown" });
  });

  it("使用内置精确价格并只在有效汇率下换算人民币", () => {
    expect(calculateUsageCost({ providerId: "p1", modelId: "gpt-5.4", tokens })).toMatchObject({ source: "catalog", costUsd: 3.55 });
    expect(convertUsdToCny(3.55, 7.2)).toBeCloseTo(25.56);
    expect(convertUsdToCny(3.55)).toBeUndefined();
  });

  it("累加工具续跑的缓存、推理与请求次数", () => {
    const usage = sumTokenUsage(
      { promptTokens: 10, cachedPromptTokens: 2, completionTokens: 4, reasoningTokens: 1, totalTokens: 14, requestCount: 1 },
      { promptTokens: 20, cachedPromptTokens: 3, completionTokens: 6, reasoningTokens: 2, totalTokens: 26, requestCount: 1 },
    );
    expect(usage).toMatchObject({ promptTokens: 30, cachedPromptTokens: 5, completionTokens: 10, reasoningTokens: 3, totalTokens: 40, requestCount: 2 });
    expect(tokenBreakdownFromUsage(usage)).toEqual({ input: 30, cachedInput: 5, output: 10, reasoning: 3, total: 40 });
  });
});
