"use client";

/**
 * @project LLMira
 * @file src/components/layout/TopBar.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @function Provider/模型选择、联网模式、思考模式和会话操作
 * @description 当前 Provider 与模型共同构成唯一选择，切换只影响下一轮请求。
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { Globe2, Menu, Moon, Settings, Sparkles, Sun, Trash2 } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { ModelMenu } from "@/components/chat/ModelMenu";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { useModels } from "@/hooks/useModels";

type TopBarProps = { mode?: "chat" | "image"; onOpenMobileMenu?: () => void; activeConversationId?: string | null; hydrated?: boolean; onDeleteCurrentConversation?: () => void };

export function TopBar({ mode = "chat", onOpenMobileMenu, activeConversationId, hydrated, onDeleteCurrentConversation }: TopBarProps) {
  const { setTheme, resolvedTheme } = useTheme();
  const settings = useSettingsStore();
  const models = useModels();
  const profile = settings.apiProfiles.find((item) => item.id === settings.activeApiProfileId) ?? settings.apiProfiles[0];
  const catalog = profile?.modelCatalog ?? [];
  const allowedIds = new Set(catalog.filter((model) => mode === "image" ? model.capabilities.imageGeneration : model.capabilities.chat).map((model) => model.id));
  const modelOptions = models.filter((model) => allowedIds.size === 0 || allowedIds.has(model));
  const selected = mode === "image" ? settings.activeImageModel : settings.activeModel;
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return <header className="flex h-16 min-w-0 items-center gap-2 border-b border-border/60 bg-background/85 px-3 backdrop-blur-xl sm:px-5">
    <Button type="button" variant="ghost" size="icon" className="shrink-0 md:hidden" onClick={onOpenMobileMenu} aria-label="打开会话列表"><Menu className="size-5" /></Button>
    <DropdownMenu><DropdownMenuTrigger className="inline-flex h-9 max-w-[8rem] items-center gap-2 rounded-full border border-border/70 bg-card px-3 text-xs font-medium outline-none hover:bg-accent sm:max-w-[11rem]" aria-label="选择 Provider"><span className={`size-2 shrink-0 rounded-full ${profile?.scanStatus === "ready" ? "bg-emerald-500" : "bg-amber-500"}`} /><span className="truncate">{profile?.name ?? "未配置"}</span></DropdownMenuTrigger><DropdownMenuContent align="start" className="w-56"><DropdownMenuLabel>Provider</DropdownMenuLabel><DropdownMenuSeparator />{settings.apiProfiles.map((item) => <DropdownMenuItem key={item.id} onSelect={() => settings.setActiveApiProfileId(item.id)}>{item.name}{item.id === profile?.id ? <span className="ml-auto text-primary">✓</span> : null}</DropdownMenuItem>)}<DropdownMenuSeparator /><DropdownMenuItem asChild><Link href="/settings"><Settings className="mr-2 size-4" />管理 Provider</Link></DropdownMenuItem></DropdownMenuContent></DropdownMenu>
    <ModelMenu value={selected} models={modelOptions} onChange={(model) => mode === "image" ? settings.setActiveImageModel(model) : settings.setActiveModel(model)} triggerClassName="min-w-0 max-w-[9rem] sm:max-w-[15rem]" />
    <div className="ml-auto flex items-center gap-1">
      {mode === "chat" ? <DropdownMenu><DropdownMenuTrigger asChild><Button variant={settings.webSearchMode === "off" ? "ghost" : "outline"} size="sm" className="rounded-full" aria-label={`联网模式：${settings.webSearchMode}`}><Globe2 className="size-4 sm:mr-1" /><span className="hidden sm:inline">{settings.webSearchMode === "off" ? "联网关" : settings.webSearchMode === "auto" ? "联网自动" : "联网开"}</span></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuLabel>联网搜索</DropdownMenuLabel>{([['off','关闭'],['auto','自动'],['on','开启']] as const).map(([value,label]) => <DropdownMenuItem key={value} onSelect={() => settings.setWebSearchMode(value)}>{label}{settings.webSearchMode === value ? <span className="ml-auto text-primary">✓</span> : null}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu> : null}
      {mode === "chat" ? <Button variant={settings.enableThinking ? "outline" : "ghost"} size="icon" className="rounded-full" onClick={() => settings.setEnableThinking(!settings.enableThinking)} aria-label={settings.enableThinking ? "关闭思考模式" : "开启思考模式"}><Sparkles className="size-4" /></Button> : null}
      {hydrated && activeConversationId && onDeleteCurrentConversation ? <Button variant="ghost" size="icon" className="hidden rounded-full text-muted-foreground hover:text-destructive sm:inline-flex" onClick={onDeleteCurrentConversation} aria-label="删除当前会话"><Trash2 className="size-4" /></Button> : null}
      <Link href="/settings" className="hidden size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground sm:inline-flex" aria-label="设置"><Settings className="size-4" /></Link>
      <Button variant="ghost" size="icon" className="hidden rounded-full sm:inline-flex" disabled={!mounted} onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} aria-label="切换主题">{mounted && resolvedTheme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}</Button>
    </div>
  </header>;
}
