/**
 * @project LLMira
 * @file src/lib/usage/tokens.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @function Small token normalization helpers shared by streaming callers
 */
import type { TokenUsage } from "@/types";
import type { UsageTokenBreakdown } from "./types";

export function tokenBreakdownFromUsage(usage?: TokenUsage): UsageTokenBreakdown | undefined {
  if (!usage) return undefined;
  return {
    input: Math.max(0, usage.promptTokens),
    cachedInput: Math.max(0, usage.cachedPromptTokens ?? 0),
    output: Math.max(0, usage.completionTokens),
    reasoning: Math.max(0, usage.reasoningTokens ?? 0),
    total: Math.max(0, usage.totalTokens),
  };
}

export function sumTokenUsage(current: TokenUsage | undefined, next: TokenUsage | undefined): TokenUsage | undefined {
  if (!next) return current;
  if (!current) return { ...next, requestCount: next.requestCount ?? 1 };
  return {
    promptTokens: current.promptTokens + next.promptTokens,
    cachedPromptTokens: (current.cachedPromptTokens ?? 0) + (next.cachedPromptTokens ?? 0),
    completionTokens: current.completionTokens + next.completionTokens,
    reasoningTokens: (current.reasoningTokens ?? 0) + (next.reasoningTokens ?? 0),
    totalTokens: current.totalTokens + next.totalTokens,
    requestCount: (current.requestCount ?? 1) + (next.requestCount ?? 1),
    estimatedCostUSD: (current.estimatedCostUSD ?? 0) + (next.estimatedCostUSD ?? 0) || undefined,
  };
}
