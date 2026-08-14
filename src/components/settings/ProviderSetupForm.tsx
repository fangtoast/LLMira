"use client";

/**
 * @project LLMira
 * @file src/components/settings/ProviderSetupForm.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @function Provider 临时凭据扫描、结果预览与显式保存
 * @description 扫描失败保留输入；只有点击保存才将密钥交给 Stronghold 或会话内存。
 */
import { useMemo, useState } from "react";
import { Check, KeyRound, Loader2, Plus, RefreshCw, Server, Trash2 } from "lucide-react";
import { ProviderInspectError, type InspectProviderResult } from "@llmira/provider-core";
import { inspectProvider } from "@/lib/providers/inspect";
import { isTauriRuntime } from "@/lib/providers/runtime";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function formatInspectError(error: unknown): string {
  if (error instanceof ProviderInspectError) return error.message;
  if (error instanceof Error) return error.message;
  return "连接失败，请检查地址、密钥和网络。";
}

export function ProviderSetupForm({ compact = false, onComplete }: { compact?: boolean; onComplete?: () => void }) {
  const store = useSettingsStore();
  const active = store.apiProfiles.find((item) => item.id === store.activeApiProfileId) ?? store.apiProfiles[0]!;
  const [name, setName] = useState(active.name);
  const [baseUrl, setBaseUrl] = useState(active.baseUrl);
  const [apiKey, setApiKey] = useState(active.apiKey);
  const [result, setResult] = useState<InspectProviderResult | null>(active.modelCatalog.length ? { normalizedBaseUrl: active.baseUrl, models: active.modelCatalog, scannedAt: active.lastScannedAt ?? new Date(0).toISOString() } : null);
  const [chatModel, setChatModel] = useState(store.activeModel);
  const [imageModel, setImageModel] = useState(store.activeImageModel);
  const [error, setError] = useState<string>();
  const [scanning, setScanning] = useState(false);
  const [saved, setSaved] = useState(false);

  function selectProfile(profileId: string) {
    store.setActiveApiProfileId(profileId);
    const next = useSettingsStore.getState().apiProfiles.find((profile) => profile.id === profileId);
    if (!next) return;
    setName(next.name); setBaseUrl(next.baseUrl); setApiKey(next.apiKey); setError(undefined); setSaved(false);
    setResult(next.modelCatalog.length ? { normalizedBaseUrl: next.baseUrl, models: next.modelCatalog, scannedAt: next.lastScannedAt ?? new Date(0).toISOString() } : null);
    const nextChat = next.modelCatalog.find((model) => model.id === store.activeModel && model.capabilities.chat)?.id
      ?? next.modelCatalog.find((model) => model.capabilities.chat)?.id
      ?? next.modelCatalog[0]?.id
      ?? "";
    const nextImage = next.modelCatalog.find((model) => model.id === store.activeImageModel && model.capabilities.imageGeneration)?.id
      ?? next.modelCatalog.find((model) => model.capabilities.imageGeneration)?.id
      ?? "";
    setChatModel(nextChat);
    setImageModel(nextImage);
  }

  function addProfile() {
    const id = store.addApiProfile();
    selectProfile(id);
  }

  const chatModels = useMemo(() => result?.models.filter((model) => model.capabilities.chat) ?? [], [result]);
  const imageModels = useMemo(() => result?.models.filter((model) => model.capabilities.imageGeneration) ?? [], [result]);

  async function scan() {
    setScanning(true); setError(undefined); setSaved(false);
    try {
      const next = await inspectProvider({ providerId: active.id, baseUrl, apiKey });
      setResult(next); setBaseUrl(next.normalizedBaseUrl);
      const nextChat = next.models.find((model) => model.capabilities.chat)?.id ?? next.models[0]?.id ?? "";
      const nextImage = next.models.find((model) => model.capabilities.imageGeneration)?.id ?? "";
      if (!next.models.some((model) => model.id === chatModel)) setChatModel(nextChat);
      if (!next.models.some((model) => model.id === imageModel)) setImageModel(nextImage);
    } catch (caught) {
      setResult(null); setError(formatInspectError(caught));
    } finally { setScanning(false); }
  }

  async function save() {
    if (!result) { setError("请先连接并扫描模型，再保存 Provider。"); return; }
    store.updateApiProfile(active.id, { name: name.trim() || "我的 Provider", baseUrl: result.normalizedBaseUrl, protocol: "openai_compatible", executionMode: isTauriRuntime() ? "device" : "server", scanStatus: "ready", lastScannedAt: result.scannedAt, scanError: undefined, modelCatalog: result.models, modelPreset: result.models.map((model) => model.id).join(",") });
    await store.saveActiveApiKey(apiKey.trim());
    if (chatModel) store.setActiveModel(chatModel);
    if (imageModel) store.setActiveImageModel(imageModel);
    store.setHasCompletedOnboarding(true); setSaved(true); onComplete?.();
  }

  return (
    <div className={compact ? "space-y-5" : "grid gap-7 lg:grid-cols-[240px_minmax(0,1fr)]"}>
      {!compact ? <aside className="space-y-2">
        <div className="flex items-center justify-between px-2"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Providers</p><Button size="icon" variant="ghost" className="size-8" onClick={addProfile} aria-label="新增 Provider"><Plus className="size-4" /></Button></div>
        {store.apiProfiles.map((profile) => <button key={profile.id} type="button" onClick={() => selectProfile(profile.id)} className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm transition ${profile.id === active.id ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-accent"}`}><span className={`size-2 rounded-full ${profile.scanStatus === "ready" ? "bg-emerald-500" : profile.scanStatus === "failed" ? "bg-destructive" : "bg-muted-foreground/40"}`} /><span className="min-w-0 flex-1 truncate">{profile.name}</span></button>)}
        <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive" disabled={store.apiProfiles.length <= 1} onClick={() => store.deleteApiProfile(active.id)}><Trash2 className="mr-2 size-4" />删除当前 Provider</Button>
      </aside> : null}
      <div className="min-w-0 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor={`provider-name-${active.id}`}>名称</Label><Input id={`provider-name-${active.id}`} value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：OpenAI 中转站" /></div>
          <div className="space-y-2"><Label htmlFor={`provider-host-${active.id}`}>API Host</Label><Input id={`provider-host-${active.id}`} type="url" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://api.example.com" /></div>
          <div className="space-y-2 sm:col-span-2"><div className="flex items-center justify-between"><Label htmlFor={`provider-key-${active.id}`}>API Key</Label><span className="text-xs text-muted-foreground">{isTauriRuntime() ? "保存在 Stronghold" : "Web 仅保留在当前会话"}</span></div><Input id={`provider-key-${active.id}`} type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="sk-..." autoComplete="off" /></div>
        </div>
        <Button type="button" variant="outline" onClick={() => void scan()} disabled={scanning || !baseUrl.trim() || !apiKey.trim()} className="w-full sm:w-auto">{scanning ? <Loader2 className="mr-2 size-4 animate-spin" /> : result ? <RefreshCw className="mr-2 size-4" /> : <Server className="mr-2 size-4" />}连接并扫描</Button>
        {error ? <Alert variant="destructive"><KeyRound className="size-4" /><AlertTitle>Provider 连接失败</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
        {result ? <section className="rounded-3xl border border-border/70 bg-muted/25 p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-semibold">扫描到 {result.models.length} 个模型</h2><p className="mt-1 text-xs text-muted-foreground">结果来自 {result.normalizedBaseUrl}/v1/models</p></div><Badge variant="outline" className="border-emerald-500/30 text-emerald-600"><Check className="mr-1 size-3" />连接正常</Badge></div>
          <div className="grid max-h-48 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">{result.models.map((model) => <div key={model.id} className="rounded-2xl border border-border/60 bg-background px-3 py-2"><p className="truncate text-sm font-medium">{model.name}</p><div className="mt-2 flex flex-wrap gap-1">{model.capabilities.chat ? <Badge variant="secondary">对话</Badge> : null}{model.capabilities.imageGeneration ? <Badge variant="secondary">生图</Badge> : null}{model.capabilities.vision ? <Badge variant="secondary">视觉</Badge> : null}{model.capabilities.reasoning ? <Badge variant="secondary">推理</Badge> : null}{model.capabilities.nativeWebSearch ? <Badge variant="secondary">原生搜索</Badge> : null}</div></div>)}</div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>默认对话模型</Label><Select value={chatModel} onValueChange={setChatModel}><SelectTrigger><SelectValue placeholder="选择对话模型" /></SelectTrigger><SelectContent>{chatModels.map((model) => <SelectItem key={model.id} value={model.id}>{model.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>默认生图模型</Label><Select value={imageModel} onValueChange={setImageModel}><SelectTrigger><SelectValue placeholder={imageModels.length ? "选择生图模型" : "未扫描到生图模型"} /></SelectTrigger><SelectContent>{imageModels.map((model) => <SelectItem key={model.id} value={model.id}>{model.name}</SelectItem>)}</SelectContent></Select></div></div>
        </section> : null}
        <div className="flex flex-wrap items-center gap-3"><Button type="button" onClick={() => void save()} disabled={!result}><Check className="mr-2 size-4" />明确保存 Provider</Button>{saved ? <span className="text-sm text-emerald-600">已安全保存，可以开始对话。</span> : null}</div>
      </div>
    </div>
  );
}
