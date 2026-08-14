/**
 * @project LLMira
 * @file src/lib/usage/analytics.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @function Pure usage aggregation for summaries, streaks, heatmaps and rankings
 */
import type { UsageEvent, UsageSummary } from "./types";

export function localDayKey(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function aggregateDaily(events: UsageEvent[]) {
  const days = new Map<string, { tokens: number; calls: number; costUsd: number }>();
  for (const event of events) {
    const key = localDayKey(event.occurredAt);
    const current = days.get(key) ?? { tokens: 0, calls: 0, costUsd: 0 };
    current.tokens += event.tokens?.total ?? 0;
    current.calls += 1;
    current.costUsd += event.costUsd ?? 0;
    days.set(key, current);
  }
  return days;
}

function dayNumber(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return Math.floor(new Date(year!, month! - 1, day!).getTime() / 86_400_000);
}

export function calculateStreaks(events: UsageEvent[], now = Date.now()) {
  const active = [...new Set(events.map((event) => localDayKey(event.occurredAt)))].sort();
  let longest = 0;
  let run = 0;
  let previous: number | undefined;
  for (const key of active) {
    const value = dayNumber(key);
    run = previous !== undefined && value === previous + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = value;
  }
  const today = dayNumber(localDayKey(now));
  const last = active.length ? dayNumber(active.at(-1)!) : Number.NaN;
  let current = 0;
  if (last === today || last === today - 1) {
    current = 1;
    for (let index = active.length - 2; index >= 0; index -= 1) {
      if (dayNumber(active[index]!) !== last - current) break;
      current += 1;
    }
  }
  return { current, longest };
}

export function summarizeUsage(events: UsageEvent[], now = Date.now()): UsageSummary {
  const daily = aggregateDaily(events);
  const streaks = calculateStreaks(events, now);
  return {
    totalTokens: events.reduce((sum, event) => sum + (event.tokens?.total ?? 0), 0),
    peakDailyTokens: Math.max(0, ...[...daily.values()].map((day) => day.tokens)),
    totalCalls: events.length,
    currentStreakDays: streaks.current,
    longestStreakDays: streaks.longest,
    costUsd: events.reduce((sum, event) => sum + (event.costUsd ?? 0), 0),
    pricedCalls: events.filter((event) => event.costUsd !== undefined).length,
    unpricedCalls: events.filter((event) => event.costUsd === undefined).length,
  };
}

export function heatLevel(tokens: number, nonZeroValues: number[]) {
  if (tokens <= 0) return 0;
  const sorted = nonZeroValues.filter((value) => value > 0).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const rank = sorted.findIndex((value) => value >= tokens);
  const percentile = (rank < 0 ? sorted.length - 1 : rank) / Math.max(1, sorted.length - 1);
  return Math.min(4, Math.max(1, Math.ceil(percentile * 4)));
}
