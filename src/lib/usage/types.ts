/**
 * @project LLMira
 * @file src/lib/usage/types.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @function Personal usage ledger and pricing domain types
 * @description Contains only metering metadata; prompts, queries, tool arguments, results and secrets are forbidden.
 */

export type UsageEventKind = "chat" | "translation" | "image" | "web_search" | "mcp";
export type UsageEventStatus = "completed" | "failed" | "cancelled" | "timeout";
export type UsagePricingSource = "override" | "catalog" | "unknown";

export interface UsageTokenBreakdown {
  input: number;
  cachedInput: number;
  output: number;
  reasoning: number;
  total: number;
}

export interface UsageEvent {
  id: string;
  operationId: string;
  occurredAt: number;
  kind: UsageEventKind;
  status: UsageEventStatus;
  durationMs: number;
  providerId?: string;
  providerName?: string;
  modelId?: string;
  conversationId?: string;
  messageId?: string;
  tokens?: UsageTokenBreakdown;
  tokenDataAvailable: boolean;
  costUsd?: number;
  pricingSource: UsagePricingSource;
  pricingCatalogVersion?: string;
  image?: { count: number; size?: string; quality?: string };
  search?: { provider: string; requestCount: number; native: boolean };
  mcp?: { serverId: string; serverName: string; toolName: string };
}

export interface PricingCatalogEntry {
  provider: string;
  modelId: string;
  aliases?: string[];
  inputUsdPerMillion?: number;
  cachedInputUsdPerMillion?: number;
  outputUsdPerMillion?: number;
  unitUsd?: number;
  sourceUrl: string;
}

export interface PricingOverride {
  providerId: string;
  modelId: string;
  inputUsdPerMillion?: number;
  cachedInputUsdPerMillion?: number;
  outputUsdPerMillion?: number;
  unitUsd?: number;
  updatedAt: number;
}

export interface UsageQuery {
  from?: number;
  to?: number;
  kinds?: UsageEventKind[];
  providerIds?: string[];
  modelIds?: string[];
  statuses?: UsageEventStatus[];
  offset?: number;
  limit?: number;
}

export interface UsageSummary {
  totalTokens: number;
  peakDailyTokens: number;
  totalCalls: number;
  currentStreakDays: number;
  longestStreakDays: number;
  costUsd: number;
  pricedCalls: number;
  unpricedCalls: number;
}
