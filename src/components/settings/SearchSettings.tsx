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
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { SettingsCard, SettingsPageHeader } from "./SettingsPrimitives";

export function SearchSettings() {
  const store = useSettingsStore();
  const [key, setKey] = useState(store.searchApiKey);
  const [saved, setSaved] = useState(false);

  return (
    <div className="grid gap-6">
      <SettingsPageHeader title="联网搜索" description="模型没有原生搜索时，LLMira 才使用这里的只读搜索。最多返回 5 条、抓取前 3 条。" actions={<span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary"><Globe2 className="size-5" /></span>} />
      <SettingsCard title="搜索服务配置">
        <FieldGroup className="gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field><FieldLabel>搜索服务</FieldLabel><Select value={store.searchProvider} onValueChange={(value) => { store.setSearchProfile({ searchProvider: value as "searxng" | "tavily" | "brave", searchApiKey: "" }); setKey(""); setSaved(false); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="searxng">SearXNG</SelectItem><SelectItem value="tavily">Tavily</SelectItem><SelectItem value="brave">Brave Search</SelectItem></SelectContent></Select></Field>
            <Field><FieldLabel htmlFor="search-base">服务地址</FieldLabel><Input id="search-base" value={store.searchBaseUrl} onChange={(event) => store.setSearchProfile({ searchBaseUrl: event.target.value })} placeholder={store.searchProvider === "searxng" ? "https://search.example.com" : "留空使用官方 API"} /></Field>
          </div>
          {store.searchProvider !== "searxng" ? <Field><FieldLabel htmlFor="search-key">搜索 API Key</FieldLabel><Input id="search-key" type="password" autoComplete="off" value={key} onChange={(event) => { setKey(event.target.value); setSaved(false); }} placeholder="请输入 API Key" /><FieldDescription>原生端保存在系统凭据库，Web 仅保留当前会话。</FieldDescription></Field> : null}
        </FieldGroup>
        <div className="flex items-center gap-3"><Button variant="outline" onClick={() => void store.saveSearchApiKey(key.trim()).then(() => setSaved(true))} disabled={store.searchProvider !== "searxng" && !key.trim()}><Check className="mr-2 size-4" />保存搜索配置</Button>{saved ? <span className="text-sm text-emerald-600">已保存</span> : null}</div>
      </SettingsCard>
    </div>
  );
}
