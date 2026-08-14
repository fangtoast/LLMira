/**
 * @project LLMira
 * @file src/lib/usage/pricing.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @function Versioned public price catalog and immutable event cost calculation
 * @description Manual provider/model overrides win; otherwise only exact official model IDs or aliases match.
 */
import type { PricingCatalogEntry, PricingOverride, UsageTokenBreakdown } from "./types";
import { pricingOverrideKey } from "./keys";
export { pricingOverrideKey } from "./keys";

export const PRICING_CATALOG_VERSION = "2026-08-14";

export const PRICING_CATALOG: PricingCatalogEntry[] = [
  { provider: "OpenAI", modelId: "gpt-5.4", aliases: ["gpt-5.4-2026-03-05"], inputUsdPerMillion: 2.5, cachedInputUsdPerMillion: 0.25, outputUsdPerMillion: 15, sourceUrl: "https://developers.openai.com/api/docs/models/gpt-5.4" },
  { provider: "OpenAI", modelId: "gpt-5.2", inputUsdPerMillion: 1.75, cachedInputUsdPerMillion: 0.175, outputUsdPerMillion: 14, sourceUrl: "https://openai.com/index/introducing-gpt-5-4/" },
  { provider: "Anthropic", modelId: "claude-sonnet-4-20250514", aliases: ["claude-sonnet-4"], inputUsdPerMillion: 3, cachedInputUsdPerMillion: 0.3, outputUsdPerMillion: 15, sourceUrl: "https://docs.anthropic.com/en/docs/about-claude/pricing" },
  { provider: "Anthropic", modelId: "claude-haiku-3-5", aliases: ["claude-3-5-haiku-latest"], inputUsdPerMillion: 0.8, cachedInputUsdPerMillion: 0.08, outputUsdPerMillion: 4, sourceUrl: "https://docs.anthropic.com/en/docs/about-claude/pricing" },
  { provider: "Google", modelId: "gemini-3.5-flash", inputUsdPerMillion: 1.5, cachedInputUsdPerMillion: 0.15, outputUsdPerMillion: 9, sourceUrl: "https://ai.google.dev/gemini-api/docs/pricing" },
  { provider: "DeepSeek", modelId: "deepseek-v4-flash", aliases: ["deepseek-chat", "deepseek-reasoner"], inputUsdPerMillion: 0.14, cachedInputUsdPerMillion: 0.0028, outputUsdPerMillion: 0.28, sourceUrl: "https://api-docs.deepseek.com/quick_start/pricing/" },
  { provider: "DeepSeek", modelId: "deepseek-v4-pro", inputUsdPerMillion: 0.435, cachedInputUsdPerMillion: 0.003625, outputUsdPerMillion: 0.87, sourceUrl: "https://api-docs.deepseek.com/quick_start/pricing/" },
];

export function convertUsdToCny(costUsd: number, cnyPerUsd?: number) {
  if (!Number.isFinite(costUsd) || !Number.isFinite(cnyPerUsd) || !cnyPerUsd || cnyPerUsd <= 0) return undefined;
  return costUsd * cnyPerUsd;
}

function exactCatalogEntry(modelId: string) {
  return PRICING_CATALOG.find((entry) => entry.modelId === modelId || entry.aliases?.includes(modelId));
}

export function calculateUsageCost(input: {
  providerId?: string;
  modelId?: string;
  tokens?: UsageTokenBreakdown;
  units?: number;
  overrides?: Record<string, PricingOverride>;
}) {
  if (!input.modelId) return { source: "unknown" as const };
  const override = input.providerId ? input.overrides?.[pricingOverrideKey(input.providerId, input.modelId)] : undefined;
  const catalog = exactCatalogEntry(input.modelId);
  const price = override ?? catalog;
  if (!price) return { source: "unknown" as const };

  let costUsd: number | undefined;
  if (input.tokens && price.inputUsdPerMillion !== undefined && price.outputUsdPerMillion !== undefined) {
    const cached = Math.min(input.tokens.input, input.tokens.cachedInput);
    const uncached = Math.max(0, input.tokens.input - cached);
    const cachedRate = price.cachedInputUsdPerMillion ?? price.inputUsdPerMillion;
    costUsd = (uncached * price.inputUsdPerMillion + cached * cachedRate + input.tokens.output * price.outputUsdPerMillion) / 1_000_000;
  } else if (input.units !== undefined && price.unitUsd !== undefined) {
    costUsd = input.units * price.unitUsd;
  }
  if (costUsd === undefined) return { source: "unknown" as const };
  return {
    costUsd: Number(costUsd.toFixed(8)),
    source: override ? "override" as const : "catalog" as const,
    catalogVersion: override ? undefined : PRICING_CATALOG_VERSION,
  };
}
