"use client";

/**
 * @project LLMira
 * @file src/components/settings/PersonalSettingsShell.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @function LLMira 三栏个人设置中心与移动端单列壳层
 * @description 桌面保留产品导航、设置分类、对象列表和详情区；移动端使用顶部分类选择器。
 */
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Activity, ArrowLeft, Bot, ChevronRight, Database, Globe2, Info, Palette, Plus, Server, Settings2, Sparkles, Trash2, Wrench, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { PersonalRail } from "@/components/layout/PersonalRail";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { cn } from "@/lib/utils";
import { AboutSettings } from "./AboutSettings";
import { AppearanceSettings } from "./AppearanceSettings";
import { DataSettings } from "./DataSettings";
import { DefaultModelsSettings } from "./DefaultModelsSettings";
import { McpServerList, McpSettings } from "./McpSettings";
import { ProviderSetupForm } from "./ProviderSetupForm";
import { SearchSettings } from "./SearchSettings";
import { SettingsPageHeader } from "./SettingsPrimitives";

type SettingsSection = "providers" | "defaults" | "mcp" | "search" | "appearance" | "data" | "usage" | "about";
const UsageSettings = dynamic(() => import("./UsageSettings"), { loading: () => <div className="grid min-h-96 place-items-center text-sm text-muted-foreground">正在读取本地用量…</div> });

const groups: Array<{ label: string; items: Array<{ id: SettingsSection; label: string; Icon: LucideIcon }> }> = [
  { label: "模型", items: [{ id: "providers" as const, label: "模型服务", Icon: Server }, { id: "defaults" as const, label: "默认模型", Icon: Bot }] },
  { label: "工具", items: [{ id: "mcp" as const, label: "MCP", Icon: Wrench }, { id: "search" as const, label: "联网搜索", Icon: Globe2 }] },
  { label: "偏好", items: [{ id: "appearance" as const, label: "外观", Icon: Palette }] },
  { label: "系统", items: [{ id: "data" as const, label: "数据", Icon: Database }, { id: "usage" as const, label: "用量统计", Icon: Activity }, { id: "about" as const, label: "关于", Icon: Info }] },
];

function ProviderList() {
  const store = useSettingsStore();
  return (
    <div className="grid content-start gap-3 p-4">
      <div className="flex items-center justify-between px-1"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">模型服务</p><Button size="icon" variant="ghost" onClick={store.addApiProfile} aria-label="添加 Provider"><Plus className="size-4" /></Button></div>
      {store.apiProfiles.map((profile) => <button key={profile.id} type="button" onClick={() => store.setActiveApiProfileId(profile.id)} className={cn("flex items-center gap-3 rounded-lg border px-3 py-3 text-left transition", profile.id === store.activeApiProfileId ? "border-primary/40 bg-primary/10" : "border-transparent hover:border-border hover:bg-muted/40")}><span className={cn("size-2 rounded-full", profile.scanStatus === "ready" ? "bg-emerald-500" : profile.scanStatus === "failed" ? "bg-destructive" : "bg-muted-foreground/35")} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{profile.name}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{profile.modelCatalog.length ? `${profile.modelCatalog.length} 个模型` : "尚未扫描"}</span></span>{profile.id === store.activeApiProfileId ? <ChevronRight className="size-4 text-primary" /> : null}</button>)}
      <Button variant="ghost" className="justify-start text-muted-foreground hover:text-destructive" disabled={store.apiProfiles.length <= 1} onClick={() => store.deleteApiProfile(store.activeApiProfileId)}><Trash2 className="mr-2 size-4" />删除当前服务</Button>
    </div>
  );
}

function MobileObjectPicker({ section }: { section: SettingsSection }) {
  const store = useSettingsStore();
  if (section === "providers") return <div className="flex gap-2"><Select value={store.activeApiProfileId} onValueChange={store.setActiveApiProfileId}><SelectTrigger className="flex-1"><SelectValue /></SelectTrigger><SelectContent>{store.apiProfiles.map((profile) => <SelectItem key={profile.id} value={profile.id}>{profile.name}</SelectItem>)}</SelectContent></Select><Button size="icon" variant="outline" onClick={store.addApiProfile}><Plus className="size-4" /></Button></div>;
  if (section === "mcp") return <div className="flex gap-2"><Select value={store.activeMcpServerId || undefined} onValueChange={store.setActiveMcpServerId}><SelectTrigger className="flex-1"><SelectValue placeholder="选择 MCP 服务器" /></SelectTrigger><SelectContent>{store.mcpServers.map((server) => <SelectItem key={server.id} value={server.id}>{server.name}</SelectItem>)}</SelectContent></Select><Button size="icon" variant="outline" onClick={store.addMcpServer}><Plus className="size-4" /></Button></div>;
  return null;
}

function Detail({ section }: { section: SettingsSection }) {
  const store = useSettingsStore();
  const profile = store.getActiveApiProfile();
  if (section === "providers") return <div className="grid gap-6"><SettingsPageHeader title={profile.name} description="OpenAI-compatible 模型服务；模型目录来自真实的 /v1/models 扫描结果。" actions={<span className="inline-flex items-center gap-2 text-xs text-muted-foreground"><Sparkles className="size-4 text-primary" />密钥安全存储</span>} /><ProviderSetupForm key={profile.id} showProfileList={false} /></div>;
  if (section === "defaults") return <DefaultModelsSettings />;
  if (section === "mcp") return <McpSettings key={store.activeMcpServerId || "empty"} />;
  if (section === "search") return <SearchSettings />;
  if (section === "appearance") return <AppearanceSettings />;
  if (section === "data") return <DataSettings />;
  if (section === "usage") return <UsageSettings />;
  return <AboutSettings />;
}

export function PersonalSettingsShell() {
  const [section, setSection] = useState<SettingsSection>("providers");
  const hasObjectList = section === "providers" || section === "mcp";

  useEffect(() => {
    const syncSectionFromHash = () => {
      const next = window.location.hash.slice(1) as SettingsSection;
      if (groups.some((group) => group.items.some((item) => item.id === next))) setSection(next);
    };
    syncSectionFromHash();
    window.addEventListener("hashchange", syncSectionFromHash);
    return () => window.removeEventListener("hashchange", syncSectionFromHash);
  }, []);

  function chooseSection(next: SettingsSection) {
    setSection(next);
    window.history.replaceState(null, "", `#${next}`);
  }

  return (
    <div className="flex min-h-dvh bg-background text-foreground md:h-dvh md:overflow-hidden">
      <PersonalRail active="settings" />
      <aside className="hidden w-[260px] shrink-0 border-r border-border/70 bg-card/25 px-4 py-5 md:flex md:flex-col">
        <Link href="/chat" className="mb-5 inline-flex items-center gap-2 px-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />返回对话</Link>
        <div className="mb-5 flex items-center gap-3 px-2"><span className="grid size-9 place-items-center rounded-lg bg-primary/15 text-primary"><Settings2 className="size-5" /></span><div><p className="font-semibold">设置</p><p className="text-xs text-muted-foreground">个人工作台</p></div></div>
        <nav aria-label="设置分类" className="grid content-start gap-5 overflow-y-auto">
          {groups.map((group) => <div key={group.label} className="grid gap-1"><p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground/65">{group.label}</p>{group.items.map(({ id, label, Icon }) => <button key={id} type="button" onClick={() => chooseSection(id)} className={cn("flex h-10 items-center gap-3 rounded-lg px-3 text-left text-sm text-muted-foreground transition hover:bg-muted/60 hover:text-foreground", section === id && "bg-muted text-foreground")}><Icon className="size-[18px]" />{label}</button>)}</div>)}
        </nav>
      </aside>
      {hasObjectList ? <aside className="hidden w-[300px] shrink-0 overflow-y-auto border-r border-border/70 bg-background md:block">{section === "providers" ? <ProviderList /> : <McpServerList />}</aside> : null}
      <main className="min-w-0 flex-1 overflow-x-hidden pb-28 md:overflow-y-auto md:pb-0">
        <div className="sticky top-0 z-20 border-b border-border/70 bg-background/95 px-4 pb-3 pt-4 backdrop-blur-xl md:hidden">
          <div className="mb-3 flex items-center gap-3"><Link href="/chat" aria-label="返回对话"><ArrowLeft className="size-5" /></Link><h1 className="text-lg font-semibold">设置</h1></div>
          <Select value={section} onValueChange={(value) => chooseSection(value as SettingsSection)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{groups.map((group) => <div key={group.label}><p className="px-2 py-1.5 text-xs text-muted-foreground">{group.label}</p>{group.items.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</div>)}</SelectContent></Select>
        </div>
        <div className={cn("mx-auto grid gap-5 px-4 py-5 md:px-8 md:py-7 lg:px-10", section === "usage" ? "max-w-[1280px]" : "max-w-[1120px]")}>
          <div className="md:hidden"><MobileObjectPicker section={section} /></div>
          <Detail section={section} />
        </div>
      </main>
    </div>
  );
}
