/**
 * @project LLMira
 * @file src/lib/usage/ledger.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @function IndexedDB usage event write, query, export and clear operations
 * @description Enforces a safe allow-list so request content and secrets cannot enter the ledger.
 */
import { logger } from "@/lib/logger";
import { calculateUsageCost } from "./pricing";
import type { PricingOverride, UsageEvent, UsageQuery } from "./types";

export async function recordUsageEvent(input: Omit<UsageEvent, "id" | "pricingSource" | "pricingCatalogVersion" | "costUsd" | "tokenDataAvailable"> & {
  overrides?: Record<string, PricingOverride>;
}) {
  const { overrides, ...safe } = input;
  const pricing = calculateUsageCost({ providerId: safe.providerId, modelId: safe.modelId, tokens: safe.tokens, units: safe.image?.count ?? safe.search?.requestCount, overrides });
  const event: UsageEvent = {
    ...safe,
    id: crypto.randomUUID(),
    tokenDataAvailable: Boolean(safe.tokens),
    costUsd: pricing.costUsd,
    pricingSource: pricing.source,
    pricingCatalogVersion: pricing.catalogVersion,
  };
  const { db } = await import("@/lib/db/dexie");
  try {
    await db.usageEvents.add(event);
  } catch (error) {
    logger.exception(error, "usage ledger write failed");
  }
  return event;
}

export async function queryUsageEvents(query: UsageQuery = {}) {
  const { db } = await import("@/lib/db/dexie");
  let events = await db.usageEvents.orderBy("occurredAt").reverse().toArray();
  events = events.filter((event) =>
    (query.from === undefined || event.occurredAt >= query.from) &&
    (query.to === undefined || event.occurredAt <= query.to) &&
    (!query.kinds?.length || query.kinds.includes(event.kind)) &&
    (!query.providerIds?.length || (event.providerId && query.providerIds.includes(event.providerId))) &&
    (!query.modelIds?.length || (event.modelId && query.modelIds.includes(event.modelId))) &&
    (!query.statuses?.length || query.statuses.includes(event.status))
  );
  const offset = Math.max(0, query.offset ?? 0);
  return events.slice(offset, query.limit === undefined ? undefined : offset + query.limit);
}

export async function replaceUsageEvents(events: UsageEvent[]) {
  const { db } = await import("@/lib/db/dexie");
  await db.transaction("rw", db.usageEvents, async () => {
    await db.usageEvents.clear();
    if (events.length) await db.usageEvents.bulkPut(events);
  });
}

export async function mergeUsageEvents(events: UsageEvent[]) {
  const { db } = await import("@/lib/db/dexie");
  if (events.length) await db.usageEvents.bulkPut(events);
}

export async function clearUsageEvents() {
  const { db } = await import("@/lib/db/dexie");
  await db.usageEvents.clear();
}
