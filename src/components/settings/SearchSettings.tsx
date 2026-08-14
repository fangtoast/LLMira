"use client";

/**
 * @project LLMira
 * @file src/components/settings/SearchSettings.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @description 普通聊天的受限只读搜索回退配置。
 */
import { useState } from "react";
import { Check, Globe2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSettingsStore } from "@/lib/store/settingsStore";

export function SearchSettings() {
  const store = useSettingsStore();
  const [key, setKey] = useState(store.searchApiKey);
  const [saved, setSaved] = useState(false);

  return (
    <section className="mt-12 border-t border-border/70 pt-9">
      <div className="mb-5 flex items-start gap-3">
        <span className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary"><Globe2 className="size-5" /></span>
        <div><h2 className="text-xl font-semibold">联网搜索回退</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">模型没有原生搜索时，LLMira 才使用这里的只读搜索。最多返回 5 条、抓取前 3 条。</p></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label>搜索服务</Label><Select value={store.searchProvider} onValueChange={(value) => { store.setSearchProfile({ searchProvider: value as "searxng" | "tavily" | "brave", searchApiKey: "" }); setKey(""); setSaved(false); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="searxng">SearXNG</SelectItem><SelectItem value="tavily">Tavily</SelectItem><SelectItem value="brave">Brave Search</SelectItem></SelectContent></Select></div>
        <div className="space-y-2"><Label htmlFor="search-base">服务地址</Label><Input id="search-base" value={store.searchBaseUrl} onChange={(event) => store.setSearchProfile({ searchBaseUrl: event.target.value })} placeholder={store.searchProvider === "searxng" ? "https://search.example.com" : "留空使用官方 API"} /></div>
        {store.searchProvider !== "searxng" ? <div className="space-y-2 sm:col-span-2"><Label htmlFor="search-key">搜索 API Key</Label><Input id="search-key" type="password" autoComplete="off" value={key} onChange={(event) => { setKey(event.target.value); setSaved(false); }} placeholder="仅保存到 Stronghold 或当前 Web 会话" /></div> : null}
      </div>
      <div className="mt-4 flex items-center gap-3"><Button variant="outline" onClick={() => void store.saveSearchApiKey(key.trim()).then(() => setSaved(true))} disabled={store.searchProvider !== "searxng" && !key.trim()}><Check className="mr-2 size-4" />保存搜索配置</Button>{saved ? <span className="text-sm text-emerald-600">已保存</span> : null}</div>
    </section>
  );
}
