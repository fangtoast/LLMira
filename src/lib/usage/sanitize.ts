/**
 * @project LLMira
 * @file src/lib/usage/sanitize.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @function Secret-safe usage event import allow-list
 */
import type { UsageEvent } from "./types";

function safeNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : fallback;
}

/** Rebuild imported events from an explicit allow-list and discard all unknown fields. */
export function sanitizeUsageEvent(value: unknown): UsageEvent | undefined {
  if (!value || typeof value !== "object") return undefined;
  const input = value as Partial<UsageEvent>;
  if (!input.id || !input.operationId || !["chat", "translation", "image", "web_search", "mcp"].includes(input.kind ?? "") || !["completed", "failed", "cancelled", "timeout"].includes(input.status ?? "")) return undefined;
  const tokens = input.tokens ? {
    input: safeNumber(input.tokens.input),
    cachedInput: safeNumber(input.tokens.cachedInput),
    output: safeNumber(input.tokens.output),
    reasoning: safeNumber(input.tokens.reasoning),
    total: safeNumber(input.tokens.total),
  } : undefined;
  return {
    id: String(input.id), operationId: String(input.operationId), occurredAt: safeNumber(input.occurredAt),
    kind: input.kind!, status: input.status!, durationMs: safeNumber(input.durationMs),
    providerId: input.providerId ? String(input.providerId) : undefined,
    providerName: input.providerName ? String(input.providerName) : undefined,
    modelId: input.modelId ? String(input.modelId) : undefined,
    conversationId: input.conversationId ? String(input.conversationId) : undefined,
    messageId: input.messageId ? String(input.messageId) : undefined,
    tokens, tokenDataAvailable: Boolean(tokens),
    costUsd: typeof input.costUsd === "number" && input.costUsd >= 0 ? input.costUsd : undefined,
    pricingSource: input.pricingSource === "override" || input.pricingSource === "catalog" ? input.pricingSource : "unknown",
    pricingCatalogVersion: input.pricingCatalogVersion ? String(input.pricingCatalogVersion) : undefined,
    image: input.image ? { count: safeNumber(input.image.count), size: input.image.size ? String(input.image.size) : undefined, quality: input.image.quality ? String(input.image.quality) : undefined } : undefined,
    search: input.search ? { provider: String(input.search.provider ?? "unknown"), requestCount: safeNumber(input.search.requestCount, 1), native: Boolean(input.search.native) } : undefined,
    mcp: input.mcp ? { serverId: String(input.mcp.serverId ?? ""), serverName: String(input.mcp.serverName ?? ""), toolName: String(input.mcp.toolName ?? "") } : undefined,
  };
}
