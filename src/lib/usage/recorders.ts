/**
 * @project LLMira
 * @file src/lib/usage/recorders.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @function Lazily loaded feature-specific usage recorders
 * @description Keeps billing and ledger construction outside the initial workbench bundle.
 */
import type { TokenUsage } from "@/types";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { recordUsageEvent } from "./ledger";
import { tokenBreakdownFromUsage } from "./tokens";
import type { UsageEventStatus } from "./types";

type ProviderIdentity = { id?: string; name?: string };

export async function recordModelUsage(
  operationId: string,
  startedAt: number,
  status: UsageEventStatus,
  provider: ProviderIdentity,
  modelId: string,
  conversationId: string,
  messageId: string,
  usage?: TokenUsage,
  nativeSearch = false,
) {
  return recordUsageEvent({
    operationId, occurredAt: startedAt, kind: "chat", status, durationMs: Date.now() - startedAt,
    providerId: provider.id, providerName: provider.name, modelId, conversationId, messageId,
    tokens: tokenBreakdownFromUsage(usage),
    search: nativeSearch ? { provider: "model", requestCount: 1, native: true } : undefined,
    overrides: useSettingsStore.getState().pricingOverrides,
  });
}

export async function recordImageUsage(
  operationId: string,
  startedAt: number,
  status: UsageEventStatus,
  provider: ProviderIdentity,
  modelId: string,
  conversationId: string,
  messageId: string,
  image: { count: number; size?: string; quality?: string },
  usage?: TokenUsage,
) {
  return recordUsageEvent({
    operationId, occurredAt: startedAt, kind: "image", status, durationMs: Date.now() - startedAt,
    providerId: provider.id, providerName: provider.name, modelId, conversationId, messageId, image,
    tokens: tokenBreakdownFromUsage(usage), overrides: useSettingsStore.getState().pricingOverrides,
  });
}

export async function recordMcpUsage(
  operationId: string,
  startedAt: number,
  status: UsageEventStatus,
  conversationId: string,
  messageId: string,
  mcp: { serverId: string; serverName: string; toolName: string },
) {
  return recordUsageEvent({ operationId, occurredAt: startedAt, kind: "mcp", status, durationMs: Date.now() - startedAt, conversationId, messageId, mcp });
}

export async function recordSearchUsage(
  operationId: string,
  startedAt: number,
  status: UsageEventStatus,
  conversationId: string,
  messageId: string,
  provider: string,
) {
  return recordUsageEvent({ operationId, occurredAt: startedAt, kind: "web_search", status, durationMs: Date.now() - startedAt, conversationId, messageId, search: { provider, requestCount: 1, native: false } });
}

export async function recordTranslationUsage(
  operationId: string,
  startedAt: number,
  status: UsageEventStatus,
  provider: ProviderIdentity,
  modelId: string,
  usage?: TokenUsage,
) {
  return recordUsageEvent({
    operationId, occurredAt: startedAt, kind: "translation", status, durationMs: Date.now() - startedAt,
    providerId: provider.id, providerName: provider.name, modelId, tokens: tokenBreakdownFromUsage(usage),
    overrides: useSettingsStore.getState().pricingOverrides,
  });
}
