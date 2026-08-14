"use client";

/**
 * @project LLMira
 * @file src/components/settings/UsageSettings.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @function Personal usage profile, yearly heatmap, insights, rankings, pricing and call ledger
 * @description Reads only the local Dexie ledger and never renders or exports prompts, search terms or MCP payloads.
 */
import { useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, ChevronLeft, ChevronRight, Download, Gauge, Settings2, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { aggregateDaily, heatLevel, localDayKey, summarizeUsage } from "@/lib/usage/analytics";
import { clearUsageEvents, queryUsageEvents } from "@/lib/usage/ledger";
import { convertUsdToCny, PRICING_CATALOG } from "@/lib/usage/pricing";
import type { UsageEvent, UsageEventKind } from "@/lib/usage/types";
import { useSettingsStore, type UsageHeatmapView, type UsageRangePreference } from "@/lib/store/settingsStore";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<UsageEventKind, string> = { chat: "聊天", translation: "翻译", image: "生图", web_search: "联网搜索", mcp: "MCP" };
const RANGE_DAYS: Record<Exclude<UsageRangePreference, "all">, number> = { "7d": 7, "30d": 30, "90d": 90, "1y": 365 };
const PAGE_SIZE = 50;

function formatTokens(value: number) {
  if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(1)}亿`;
  if (value >= 10_000) return `${(value / 10_000).toFixed(1)}万`;
  return value.toLocaleString("zh-CN");
}

function formatDuration(value: number) {
  if (value >= 60_000) return `${(value / 60_000).toFixed(1)} 分钟`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)} 秒`;
  return `${Math.round(value)} ms`;
}

function download(name: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function safeCsv(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function dayStart(value: string) {
  return value ? new Date(`${value}T00:00:00`).getTime() : undefined;
}

function getDateCells(days: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - 1 - index));
    return date;
  });
}

function resolveHeatValues(cells: Date[], events: UsageEvent[], view: UsageHeatmapView) {
  const daily = aggregateDaily(events);
  let cumulative = 0;
  const raw = cells.map((date) => daily.get(localDayKey(date.getTime())) ?? { tokens: 0, calls: 0, costUsd: 0 });
  return raw.map((value, index) => {
    if (view === "weekly") {
      const start = Math.max(0, index - dateWeekday(cells[index]!));
      const end = Math.min(raw.length, start + 7);
      return raw.slice(start, end).reduce((sum, item) => ({ tokens: sum.tokens + item.tokens, calls: sum.calls + item.calls, costUsd: sum.costUsd + item.costUsd }), { tokens: 0, calls: 0, costUsd: 0 });
    }
    if (view === "cumulative") {
      cumulative += value.tokens;
      return { ...value, tokens: cumulative };
    }
    return value;
  });
}

function dateWeekday(date: Date) {
  return (date.getDay() + 6) % 7;
}

function Heatmap({ events, days, className }: { events: UsageEvent[]; days: number; className?: string }) {
  const view = useSettingsStore((state) => state.usageHeatmapView);
  const cells = useMemo(() => getDateCells(days), [days]);
  const values = useMemo(() => resolveHeatValues(cells, events, view), [cells, events, view]);
  const nonZero = values.map((value) => value.tokens).filter(Boolean);
  const leading = dateWeekday(cells[0]!);
  const monthLabels = cells.map((date, index) => index === 0 || date.getMonth() !== cells[index - 1]?.getMonth() ? `${date.getMonth() + 1}月` : "");
  return (
    <div className={cn("w-full min-w-0 max-w-full overflow-x-auto pb-2", className)}>
      <div className="w-max min-w-max">
        <div className="mb-2 grid grid-flow-col grid-rows-1 gap-[3px] pl-7 text-[10px] text-muted-foreground" style={{ gridTemplateColumns: `repeat(${Math.ceil((cells.length + leading) / 7)}, 12px)` }}>
          {cells.map((date, index) => monthLabels[index] ? <span className="whitespace-nowrap" key={date.toISOString()} style={{ gridColumn: Math.floor((index + leading) / 7) + 1 }}>{monthLabels[index]}</span> : null)}
        </div>
        <div className="flex gap-2">
          <div className="grid h-[102px] grid-rows-7 gap-[3px] text-[9px] text-muted-foreground"><span>一</span><span /><span>三</span><span /><span>五</span><span /><span>日</span></div>
          <div role="grid" aria-label={`最近 ${days} 天 Token 活跃热力图`} className="grid grid-flow-col grid-rows-7 gap-[3px]" style={{ gridTemplateColumns: `repeat(${Math.ceil((cells.length + leading) / 7)}, 12px)` }}>
            {Array.from({ length: leading }, (_, index) => <span aria-hidden key={`pad-${index}`} />)}
            {cells.map((date, index) => {
              const value = values[index]!;
              const level = heatLevel(value.tokens, nonZero);
              const label = `${date.toLocaleDateString("zh-CN")}：${formatTokens(value.tokens)} Token，${value.calls} 次请求，$${value.costUsd.toFixed(4)}`;
              return <span role="gridcell" aria-label={label} title={label} key={date.toISOString()} className={cn("size-3 rounded-[3px] border border-border/20", level === 0 && "bg-muted/35", level === 1 && "bg-primary/20", level === 2 && "bg-primary/40", level === 3 && "bg-primary/65", level === 4 && "bg-primary")} />;
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function ranking(events: UsageEvent[], select: (event: UsageEvent) => string | undefined) {
  const counts = new Map<string, number>();
  for (const event of events) {
    const key = select(event);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
}

function RankingList({ title, values }: { title: string; values: Array<[string, number]> }) {
  return <div><p className="mb-2 text-xs font-medium text-muted-foreground">{title}</p><div className="grid gap-2">{values.length ? values.map(([label, count], index) => <div key={label} className="flex items-center gap-3 text-sm"><span className="grid size-6 place-items-center rounded-md bg-muted text-xs text-muted-foreground">{index + 1}</span><span className="min-w-0 flex-1 truncate">{label}</span><span className="tabular-nums text-muted-foreground">{count} 次</span></div>) : <p className="text-sm text-muted-foreground">暂无记录</p>}</div></div>;
}

function MiniTrend({ events, metric }: { events: UsageEvent[]; metric: "tokens" | "cost" }) {
  const values = [...aggregateDaily(events).entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-30).map(([, value]) => metric === "tokens" ? value.tokens : value.costUsd);
  const max = Math.max(1, ...values);
  const points = values.map((value, index) => `${values.length <= 1 ? 0 : (index / (values.length - 1)) * 600},${110 - (value / max) * 90}`).join(" ");
  return <div className="h-36 rounded-xl border border-border/60 bg-muted/10 p-3"><svg viewBox="0 0 600 120" role="img" aria-label={`最近${metric === "tokens" ? " Token" : "费用"}趋势`} className="h-full w-full"><defs><linearGradient id="usage-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="hsl(var(--primary))" stopOpacity=".28" /><stop offset="1" stopColor="hsl(var(--primary))" stopOpacity="0" /></linearGradient></defs>{values.length ? <><polygon points={`0,120 ${points} 600,120`} fill="url(#usage-fill)" /><polyline points={points} fill="none" stroke="hsl(var(--primary))" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></> : <text x="300" y="65" textAnchor="middle" fill="currentColor" className="text-muted-foreground">暂无趋势数据</text>}</svg></div>;
}

function PricingDialog() {
  const store = useSettingsStore();
  const [open, setOpen] = useState(false);
  const [providerId, setProviderId] = useState(store.activeApiProfileId);
  const [modelId, setModelId] = useState(store.activeModel);
  const [inputPrice, setInputPrice] = useState("");
  const [cachedPrice, setCachedPrice] = useState("");
  const [outputPrice, setOutputPrice] = useState("");
  const [rate, setRate] = useState(store.cnyPerUsd?.toString() ?? "");

  function saveOverride() {
    if (!providerId || !modelId.trim()) return;
    store.setPricingOverride({ providerId, modelId: modelId.trim(), inputUsdPerMillion: Number(inputPrice) || 0, cachedInputUsdPerMillion: Number(cachedPrice) || undefined, outputUsdPerMillion: Number(outputPrice) || 0, updatedAt: Date.now() });
  }

  return <><Button variant="outline" className="rounded-full" onClick={() => setOpen(true)}><Settings2 data-icon="inline-start" />价格设置</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl"><div><h2 className="text-lg font-semibold">价格与人民币显示</h2><p className="mt-1 text-sm text-muted-foreground">美元是计费基准。手动覆盖优先于内置目录，且只影响之后产生的事件。</p></div><div className="mt-5 grid gap-5"><section className="grid gap-2"><label className="text-sm font-medium" htmlFor="cny-rate">人民币 / 美元</label><div className="flex gap-2"><Input id="cny-rate" inputMode="decimal" value={rate} onChange={(event) => setRate(event.target.value)} placeholder="例如 7.20" /><Button variant="outline" onClick={() => store.setCnyPerUsd(Number(rate) || undefined)}>保存汇率</Button></div><p className="text-xs text-muted-foreground">未填写时不显示人民币估算。</p></section><section className="grid gap-3 border-t pt-4"><div><h3 className="font-medium">模型价格覆盖</h3><p className="text-xs text-muted-foreground">价格单位为美元 / 100万 Token。</p></div><div className="grid gap-2 sm:grid-cols-2"><Select value={providerId} onValueChange={setProviderId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{store.apiProfiles.map((profile) => <SelectItem key={profile.id} value={profile.id}>{profile.name}</SelectItem>)}</SelectContent></Select><Input value={modelId} onChange={(event) => setModelId(event.target.value)} placeholder="精确模型 ID" /><Input value={inputPrice} onChange={(event) => setInputPrice(event.target.value)} inputMode="decimal" placeholder="输入价格" /><Input value={cachedPrice} onChange={(event) => setCachedPrice(event.target.value)} inputMode="decimal" placeholder="缓存输入价格（可选）" /><Input value={outputPrice} onChange={(event) => setOutputPrice(event.target.value)} inputMode="decimal" placeholder="输出价格" /></div><Button className="w-fit" onClick={saveOverride}>保存覆盖</Button>{Object.values(store.pricingOverrides).length ? <div className="grid gap-2 rounded-lg border p-2">{Object.values(store.pricingOverrides).map((override) => <div key={`${override.providerId}-${override.modelId}`} className="flex items-center gap-2 text-xs"><span className="min-w-0 flex-1 truncate">{store.apiProfiles.find((profile) => profile.id === override.providerId)?.name ?? override.providerId} / {override.modelId}</span><span className="text-muted-foreground">${override.inputUsdPerMillion ?? "—"} · ${override.outputUsdPerMillion ?? "—"}</span><Button size="xs" variant="ghost" className="text-destructive" onClick={() => store.deletePricingOverride(override.providerId, override.modelId)}>删除</Button></div>)}</div> : null}</section><section className="border-t pt-4"><h3 className="mb-2 font-medium">内置价格目录</h3><div className="max-h-44 overflow-y-auto rounded-lg border"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-muted"><tr><th className="p-2">模型</th><th className="p-2">输入</th><th className="p-2">缓存</th><th className="p-2">输出</th></tr></thead><tbody>{PRICING_CATALOG.map((entry) => <tr key={`${entry.provider}-${entry.modelId}`} className="border-t"><td className="p-2"><span className="block font-medium">{entry.modelId}</span><span className="text-muted-foreground">{entry.provider}</span></td><td className="p-2">${entry.inputUsdPerMillion}</td><td className="p-2">${entry.cachedInputUsdPerMillion ?? "—"}</td><td className="p-2">${entry.outputUsdPerMillion}</td></tr>)}</tbody></table></div></section></div><div className="mt-5 flex items-center justify-between"><p className="text-xs text-muted-foreground">未知模型不会猜测价格。</p><Button variant="outline" onClick={() => setOpen(false)}>完成</Button></div></DialogContent></Dialog></>;
}

/** Settings detail page for local personal usage and billing. */
export default function UsageSettings() {
  const store = useSettingsStore();
  const [events, setEvents] = useState<UsageEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<UsageEventKind | "all">("all");
  const [providerFilter, setProviderFilter] = useState("all");
  const [modelFilter, setModelFilter] = useState("all");
  const [trendMetric, setTrendMetric] = useState<"tokens" | "cost">("tokens");
  const [page, setPage] = useState(0);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [custom, setCustom] = useState(false);
  const [rangeAnchor] = useState(Date.now);

  async function refresh() {
    setLoading(true);
    setEvents(await queryUsageEvents());
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    void queryUsageEvents().then((nextEvents) => {
      if (!active) return;
      setEvents(nextEvents);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);
  const summary = useMemo(() => summarizeUsage(events), [events]);
  const filtered = useMemo(() => {
    const from = custom ? dayStart(customFrom) : store.usageRangePreference === "all" ? undefined : rangeAnchor - RANGE_DAYS[store.usageRangePreference] * 86_400_000;
    const to = custom && customTo ? dayStart(customTo)! + 86_399_999 : undefined;
    return events.filter((event) => (from === undefined || event.occurredAt >= from) && (to === undefined || event.occurredAt <= to) && (kind === "all" || event.kind === kind) && (providerFilter === "all" || event.providerId === providerFilter) && (modelFilter === "all" || event.modelId === modelFilter));
  }, [custom, customFrom, customTo, events, kind, modelFilter, providerFilter, rangeAnchor, store.usageRangePreference]);
  const pageEvents = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const completed = events.filter((event) => event.status === "completed");
  const avgTokens = completed.length ? completed.reduce((sum, event) => sum + (event.tokens?.total ?? 0), 0) / completed.length : 0;
  const avgDuration = completed.length ? completed.reduce((sum, event) => sum + event.durationMs, 0) / completed.length : 0;
  const mostActiveHour = events.length ? [...Array(24)].map((_, hour) => [hour, events.filter((event) => new Date(event.occurredAt).getHours() === hour).length] as const).sort((a, b) => b[1] - a[1])[0]![0] : undefined;
  const cny = convertUsdToCny(summary.costUsd, store.cnyPerUsd);
  const providerOptions = useMemo(() => [...new Map(events.filter((event) => event.providerId).map((event) => [event.providerId!, event.providerName ?? event.providerId!])).entries()], [events]);
  const modelOptions = useMemo(() => [...new Set(events.map((event) => event.modelId).filter((value): value is string => Boolean(value)))], [events]);
  const longestSessionMs = useMemo(() => Math.max(0, ...[...events.reduce((map, event) => map.set(event.operationId, (map.get(event.operationId) ?? 0) + event.durationMs), new Map<string, number>()).values()]), [events]);

  function exportJson() {
    download(`llmira-usage-${Date.now()}.json`, JSON.stringify({ version: 1, exportedAt: Date.now(), events: filtered }, null, 2), "application/json;charset=utf-8");
  }

  function exportCsv() {
    const rows = [["时间", "功能", "Provider", "模型", "状态", "耗时(ms)", "输入Token", "缓存Token", "输出Token", "推理Token", "总Token", "费用USD"], ...filtered.map((event) => [new Date(event.occurredAt).toISOString(), event.kind, event.providerName ?? event.providerId ?? "", event.modelId ?? "", event.status, event.durationMs, event.tokens?.input ?? "", event.tokens?.cachedInput ?? "", event.tokens?.output ?? "", event.tokens?.reasoning ?? "", event.tokens?.total ?? "", event.costUsd ?? ""])];
    download(`llmira-usage-${Date.now()}.csv`, rows.map((row) => row.map(safeCsv).join(",")).join("\n"), "text/csv;charset=utf-8");
  }

  return <div className="mx-auto grid w-full min-w-0 max-w-[1180px] grid-cols-[minmax(0,1fr)] gap-8 pb-12">
    <section className="pt-2 text-center">
      <div className="mx-auto grid size-24 place-items-center rounded-full bg-primary text-3xl font-medium text-primary-foreground shadow-[0_18px_60px_-24px_hsl(var(--primary))]">{store.userAvatarText || store.userName.slice(0, 2).toUpperCase()}</div>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight sm:text-3xl">{store.userName || "LLMira 用户"}</h1>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground"><span className="rounded-full border px-3 py-1">个人工作台</span><span className="inline-flex items-center gap-1 rounded-full border px-3 py-1"><ShieldCheck className="size-3.5 text-emerald-500" />数据仅保存在当前设备</span></div>
      <div className="mt-5 flex justify-center gap-2"><Button variant="outline" className="rounded-full" onClick={exportJson}><Download data-icon="inline-start" />导出报告</Button><PricingDialog /></div>
    </section>

    <section className="grid min-w-0 grid-cols-2 overflow-hidden rounded-2xl border bg-card/30 sm:grid-cols-5">
      {[
        ["累计 Token", loading ? "—" : formatTokens(summary.totalTokens)], ["峰值单日 Token", loading ? "—" : formatTokens(summary.peakDailyTokens)], ["总调用次数", loading ? "—" : summary.totalCalls.toLocaleString("zh-CN")], ["当前连续天数", `${summary.currentStreakDays} 天`], ["最长连续天数", `${summary.longestStreakDays} 天`],
      ].map(([label, value]) => <div key={label} className="border-b border-r p-4 text-center even:border-r-0 last:col-span-2 last:border-b-0 last:border-r-0 sm:col-span-1 sm:border-b-0 sm:border-r sm:p-5 sm:even:border-r sm:last:col-span-1 sm:last:border-r-0"><p className="text-xl font-semibold tabular-nums">{value}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></div>)}
    </section>

    <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-semibold">Token 活动</h2><p className="mt-1 text-sm text-muted-foreground">最近一年调用强度；悬停方格查看每日明细。</p></div><div className="flex rounded-full bg-muted p-1">{(["daily", "weekly", "cumulative"] as const).map((view) => <button type="button" key={view} onClick={() => store.setUsageHeatmapView(view)} className={cn("rounded-full px-3 py-1.5 text-xs transition", store.usageHeatmapView === view ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}>{view === "daily" ? "每日" : view === "weekly" ? "每周" : "累计"}</button>)}</div></div>
      <div className="rounded-2xl border bg-card/20 p-4 sm:p-6"><Heatmap events={events} days={365} className="hidden md:block" /><Heatmap events={events} days={182} className="md:hidden" /><div className="mt-3 flex items-center justify-end gap-1 text-[10px] text-muted-foreground"><span>少</span>{[0,1,2,3,4].map((level) => <span key={level} className={cn("size-3 rounded-[3px]", level === 0 && "bg-muted/35", level === 1 && "bg-primary/20", level === 2 && "bg-primary/40", level === 3 && "bg-primary/65", level === 4 && "bg-primary")} />)}<span>多</span></div></div>
    </section>

    <section className="grid min-w-0 gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border bg-card/20 p-5"><div className="mb-5 flex items-center gap-2"><Gauge className="size-5 text-primary" /><h2 className="font-semibold">活动洞察</h2></div><div className="grid grid-cols-2 gap-x-6 gap-y-5 text-sm"><div><p className="text-muted-foreground">最活跃时段</p><p className="mt-1 font-medium">{mostActiveHour === undefined ? "暂无数据" : `${mostActiveHour}:00–${(mostActiveHour + 1) % 24}:00`}</p></div><div><p className="text-muted-foreground">平均 Token / 请求</p><p className="mt-1 font-medium">{formatTokens(Math.round(avgTokens))}</p></div><div><p className="text-muted-foreground">最长会话</p><p className="mt-1 font-medium">{formatDuration(longestSessionMs)}</p></div><div><p className="text-muted-foreground">成功率</p><p className="mt-1 font-medium">{events.length ? `${((completed.length / events.length) * 100).toFixed(1)}%` : "—"}</p></div><div><p className="text-muted-foreground">平均响应时间</p><p className="mt-1 font-medium">{events.length ? formatDuration(avgDuration) : "—"}</p></div><div><p className="text-muted-foreground">累计费用</p><p className="mt-1 font-medium">${summary.costUsd.toFixed(4)}{cny !== undefined ? <span className="ml-1 text-xs text-muted-foreground">≈ ¥{cny.toFixed(2)}</span> : null}</p></div></div></div>
      <div className="rounded-2xl border bg-card/20 p-5"><div className="mb-5 flex items-center gap-2"><Sparkles className="size-5 text-primary" /><h2 className="font-semibold">最常使用</h2></div><div className="grid gap-5 sm:grid-cols-2"><RankingList title="Provider" values={ranking(events, (event) => event.providerName ?? event.providerId)} /><RankingList title="模型" values={ranking(events, (event) => event.modelId)} /><RankingList title="功能类型" values={ranking(events, (event) => KIND_LABEL[event.kind])} /><RankingList title="MCP 工具" values={ranking(events, (event) => event.mcp ? `${event.mcp.serverName} / ${event.mcp.toolName}` : undefined)} /></div></div>
    </section>

    <section className="grid gap-5 rounded-2xl border bg-card/20 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><BarChart3 className="size-5 text-primary" /><h2 className="text-lg font-semibold">深度分析</h2></div><p className="mt-1 text-sm text-muted-foreground">筛选、趋势和逐次调用记录。</p></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={exportCsv}>CSV</Button><Button size="sm" variant="outline" onClick={exportJson}>JSON</Button><AlertDialog><AlertDialogTrigger asChild><Button size="sm" variant="outline" className="text-destructive hover:text-destructive"><Trash2 data-icon="inline-start" />清除用量</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>清除全部用量记录？</AlertDialogTitle><AlertDialogDescription>聊天和设置会保留，用量账本及历史费用会永久删除。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={async () => { await clearUsageEvents(); await refresh(); }}>永久清除</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div></div>
      <div className="flex flex-wrap gap-2"><div className="flex flex-wrap rounded-xl bg-muted p-1">{(["7d", "30d", "90d", "1y", "all"] as const).map((range) => <button type="button" key={range} onClick={() => { store.setUsageRangePreference(range); setCustom(false); setPage(0); }} className={cn("rounded-lg px-3 py-1.5 text-xs", !custom && store.usageRangePreference === range ? "bg-background shadow-sm" : "text-muted-foreground")}>{range === "all" ? "全部" : range === "1y" ? "最近一年" : range.replace("d", "天")}</button>)}<button type="button" onClick={() => setCustom(true)} className={cn("rounded-lg px-3 py-1.5 text-xs", custom ? "bg-background shadow-sm" : "text-muted-foreground")}>自定义</button></div><Select value={kind} onValueChange={(value) => { setKind(value as UsageEventKind | "all"); setPage(0); }}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">全部功能</SelectItem>{Object.entries(KIND_LABEL).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select><Select value={providerFilter} onValueChange={(value) => { setProviderFilter(value); setPage(0); }}><SelectTrigger className="w-40"><SelectValue placeholder="Provider" /></SelectTrigger><SelectContent><SelectItem value="all">全部 Provider</SelectItem>{providerOptions.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select><Select value={modelFilter} onValueChange={(value) => { setModelFilter(value); setPage(0); }}><SelectTrigger className="w-44"><SelectValue placeholder="模型" /></SelectTrigger><SelectContent><SelectItem value="all">全部模型</SelectItem>{modelOptions.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>{custom ? <div className="flex items-center gap-2"><Input type="date" value={customFrom} onChange={(event) => { setCustomFrom(event.target.value); setPage(0); }} aria-label="开始日期" /><span className="text-muted-foreground">至</span><Input type="date" value={customTo} onChange={(event) => { setCustomTo(event.target.value); setPage(0); }} aria-label="结束日期" /></div> : null}</div>
      <div><div className="mb-2 flex justify-end"><div className="flex rounded-full bg-muted p-1"><button type="button" className={cn("rounded-full px-3 py-1 text-xs", trendMetric === "tokens" ? "bg-background shadow-sm" : "text-muted-foreground")} onClick={() => setTrendMetric("tokens")}>Token</button><button type="button" className={cn("rounded-full px-3 py-1 text-xs", trendMetric === "cost" ? "bg-background shadow-sm" : "text-muted-foreground")} onClick={() => setTrendMetric("cost")}>费用</button></div></div><MiniTrend events={filtered} metric={trendMetric} /></div>
      <div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-muted/60 text-xs text-muted-foreground"><tr><th className="p-3">时间</th><th className="p-3">功能</th><th className="p-3">Provider / 模型</th><th className="p-3">Token</th><th className="p-3">耗时</th><th className="p-3">费用</th><th className="p-3">状态</th></tr></thead><tbody>{pageEvents.length ? pageEvents.map((event) => <tr key={event.id} className="border-t"><td className="p-3 whitespace-nowrap text-xs text-muted-foreground">{new Date(event.occurredAt).toLocaleString("zh-CN")}</td><td className="p-3">{KIND_LABEL[event.kind]}{event.mcp ? <span className="mt-0.5 block max-w-40 truncate text-xs text-muted-foreground">{event.mcp.serverName} / {event.mcp.toolName}</span> : null}</td><td className="p-3"><span className="block">{event.providerName ?? event.providerId ?? "本地"}</span><span className="block max-w-56 truncate text-xs text-muted-foreground">{event.modelId ?? event.search?.provider ?? "—"}</span></td><td className="p-3 tabular-nums">{event.tokenDataAvailable ? formatTokens(event.tokens?.total ?? 0) : <span className="text-xs text-muted-foreground">不可用</span>}</td><td className="p-3 tabular-nums">{formatDuration(event.durationMs)}</td><td className="p-3 tabular-nums">{event.costUsd === undefined ? <span className="text-xs text-muted-foreground">未知价格</span> : `$${event.costUsd.toFixed(6)}`}</td><td className="p-3"><span className={cn("rounded-full px-2 py-1 text-xs", event.status === "completed" ? "bg-emerald-500/10 text-emerald-600" : event.status === "cancelled" ? "bg-amber-500/10 text-amber-600" : "bg-destructive/10 text-destructive")}>{event.status === "completed" ? "成功" : event.status === "cancelled" ? "已取消" : event.status === "timeout" ? "超时" : "失败"}</span></td></tr>) : <tr><td colSpan={7} className="p-12 text-center text-muted-foreground"><Activity className="mx-auto mb-3 size-7 opacity-40" />新调用产生后，这里会显示真实用量；不会回填旧记录。</td></tr>}</tbody></table></div>
      <div className="flex items-center justify-between text-sm text-muted-foreground"><span>共 {filtered.length} 条，每页 {PAGE_SIZE} 条</span><div className="flex items-center gap-2"><Button size="icon" variant="outline" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} aria-label="上一页"><ChevronLeft /></Button><span>{page + 1} / {pageCount}</span><Button size="icon" variant="outline" disabled={page + 1 >= pageCount} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} aria-label="下一页"><ChevronRight /></Button></div></div>
    </section>
  </div>;
}
