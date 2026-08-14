"use client";

/**
 * @project LLMira
 * @file src/components/layout/TopBar.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @function Provider、连接状态、主题、设置和会话操作
 * @description 模型、联网与思考控件统一位于输入框，本顶栏保持安静。
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, Moon, Settings, Sun, Trash2 } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useSettingsStore } from "@/lib/store/settingsStore";

type TopBarProps = { mode?: "chat" | "image"; onOpenMobileMenu?: () => void; activeConversationId?: string | null; hydrated?: boolean; onDeleteCurrentConversation?: () => void };

export function TopBar({ onOpenMobileMenu, activeConversationId, hydrated, onDeleteCurrentConversation }: TopBarProps) {
  const { setTheme, resolvedTheme } = useTheme();
  const settings = useSettingsStore();
  const profile = settings.apiProfiles.find((item) => item.id === settings.activeApiProfileId) ?? settings.apiProfiles[0];
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return <header className="flex h-16 min-w-0 items-center gap-2 border-b border-border/60 bg-background/85 px-3 backdrop-blur-xl sm:px-5">
    <Button type="button" variant="ghost" size="icon" className="shrink-0 md:hidden" onClick={onOpenMobileMenu} aria-label="打开会话列表"><Menu className="size-5" /></Button>
    <DropdownMenu><DropdownMenuTrigger className="inline-flex h-9 max-w-[8rem] items-center gap-2 rounded-full border border-border/70 bg-card px-3 text-xs font-medium outline-none hover:bg-accent sm:max-w-[11rem]" aria-label="选择 Provider"><span className={`size-2 shrink-0 rounded-full ${profile?.scanStatus === "ready" ? "bg-emerald-500" : "bg-amber-500"}`} /><span className="truncate">{profile?.name ?? "未配置"}</span></DropdownMenuTrigger><DropdownMenuContent align="start" className="w-56"><DropdownMenuLabel>Provider</DropdownMenuLabel><DropdownMenuSeparator />{settings.apiProfiles.map((item) => <DropdownMenuItem key={item.id} onSelect={() => settings.setActiveApiProfileId(item.id)}>{item.name}{item.id === profile?.id ? <span className="ml-auto text-primary">✓</span> : null}</DropdownMenuItem>)}<DropdownMenuSeparator /><DropdownMenuItem asChild><Link href="/settings"><Settings className="mr-2 size-4" />管理 Provider</Link></DropdownMenuItem></DropdownMenuContent></DropdownMenu>
    <span className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex"><span className={`size-2 rounded-full ${profile?.scanStatus === "ready" ? "bg-emerald-500" : "bg-amber-500"}`} />{profile?.scanStatus === "ready" ? "已连接" : profile?.scanStatus === "scanning" ? "正在连接" : "待检查"}</span>
    <div className="ml-auto flex items-center gap-1">
      {hydrated && activeConversationId && onDeleteCurrentConversation ? <Button variant="ghost" size="icon" className="hidden rounded-full text-muted-foreground hover:text-destructive sm:inline-flex" onClick={onDeleteCurrentConversation} aria-label="删除当前会话"><Trash2 className="size-4" /></Button> : null}
      <Link href="/settings" className="hidden size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground sm:inline-flex" aria-label="设置"><Settings className="size-4" /></Link>
      <Button variant="ghost" size="icon" className="hidden rounded-full sm:inline-flex" disabled={!mounted} onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} aria-label="切换主题">{mounted && resolvedTheme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}</Button>
    </div>
  </header>;
}
