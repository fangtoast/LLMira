"use client";

/**
 * @project LLMira
 * @file src/components/layout/SessionSidebar.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @function 会话搜索、切换、重命名与删除
 * @description 新对话保持临时状态，只有发送首条消息时才由 useChat 持久化。
 */
import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Pencil, Plus, Search, Settings, Trash2, X } from "lucide-react";
import { useConversations } from "@/hooks/useConversations";
import { useIsMdUp } from "@/hooks/useMediaQuery";
import { useChatStore } from "@/lib/store/chatStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export function SessionSidebar({ mobileOpen = false, onMobileClose }: { mobileOpen?: boolean; onMobileClose?: () => void }) {
  const isMdUp = useIsMdUp();
  const { sidebarCollapsed, setSidebarCollapsed } = useSettingsStore();
  const { conversations, activeConversationId, setActiveConversationId } = useChatStore();
  const { searchConversations, renameConversation, deleteConversation } = useConversations();
  const [keyword, setKeyword] = useState("");
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const expanded = !sidebarCollapsed || !isMdUp;

  return (
    <>
      {mobileOpen && !isMdUp ? <button type="button" className="fixed inset-0 z-40 bg-black/55 md:hidden" onClick={onMobileClose} aria-label="关闭会话列表" /> : null}
      <aside className={cn("fixed inset-y-0 left-0 z-50 flex w-[min(86vw,320px)] flex-col border-r border-border/70 bg-card transition-transform md:static md:z-auto md:translate-x-0", mobileOpen ? "translate-x-0" : "-translate-x-full", sidebarCollapsed ? "md:w-[76px]" : "md:w-[280px]") }>
        <div className="flex h-16 items-center gap-2 px-3">
          {!isMdUp ? <Button size="icon" variant="ghost" onClick={onMobileClose} aria-label="关闭会话列表"><X className="size-4" /></Button> : null}
          {expanded ? <span className="min-w-0 flex-1 text-sm font-semibold">会话</span> : null}
          <Button size={expanded ? "sm" : "icon"} onClick={() => { setActiveConversationId(null); onMobileClose?.(); }} className="rounded-full">
            <Plus className="size-4" />{expanded ? <span className="ml-1">新对话</span> : null}
          </Button>
        </div>
        {expanded ? <div className="px-3 pb-3"><label className="relative block"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input value={keyword} onChange={(event) => { setKeyword(event.target.value); void searchConversations(event.target.value); }} className="rounded-full pl-9" placeholder="搜索会话" aria-label="搜索会话" /></label></div> : null}
        <ScrollArea className="min-h-0 flex-1 px-2">
          {conversations.length === 0 && expanded ? <p className="px-3 py-6 text-sm leading-6 text-muted-foreground">发送第一条消息后，会话会出现在这里。</p> : null}
          {conversations.map((conversation) => (
            <div key={conversation.id} className={cn("group mb-1 flex items-center gap-1 rounded-2xl px-2 py-1", activeConversationId === conversation.id ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-accent") }>
              <button type="button" className="min-w-0 flex-1 truncate px-2 py-2 text-left text-sm" onClick={() => { setActiveConversationId(conversation.id); onMobileClose?.(); }} title={conversation.title}>{expanded ? conversation.title : conversation.title.slice(0, 1)}</button>
              {expanded ? <>
                <Button size="icon" variant="ghost" className="size-7 opacity-100 md:opacity-0 md:group-hover:opacity-100" onClick={() => { setRenameId(conversation.id); setRenameValue(conversation.title); }} aria-label={`重命名 ${conversation.title}`}><Pencil className="size-3.5" /></Button>
                <Button size="icon" variant="ghost" className="size-7 opacity-100 hover:text-destructive md:opacity-0 md:group-hover:opacity-100" onClick={() => void deleteConversation(conversation.id)} aria-label={`删除 ${conversation.title}`}><Trash2 className="size-3.5" /></Button>
              </> : null}
            </div>
          ))}
        </ScrollArea>
        <div className="border-t border-border/70 p-2">
          <Link href="/settings" className="flex items-center gap-3 rounded-2xl px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"><Settings className="size-4 shrink-0" />{expanded ? "设置" : null}</Link>
          <Button variant="ghost" size="icon" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="mt-1 hidden md:inline-flex" aria-label={sidebarCollapsed ? "展开会话列表" : "折叠会话列表"}>{sidebarCollapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}</Button>
        </div>
      </aside>
      <Dialog open={Boolean(renameId)} onOpenChange={(open) => { if (!open) setRenameId(null); }}>
        <DialogContent className="max-w-sm">
          <h2 className="text-lg font-semibold">重命名对话</h2>
          <p className="mt-1 text-sm text-muted-foreground">新标题会立即保存在当前设备。</p>
          <Input className="mt-5" autoFocus value={renameValue} onChange={(event) => setRenameValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && renameId) { void renameConversation(renameId, renameValue.trim() || "新对话"); setRenameId(null); } }} />
          <div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={() => setRenameId(null)}>取消</Button><Button onClick={() => { if (renameId) void renameConversation(renameId, renameValue.trim() || "新对话"); setRenameId(null); }}>保存</Button></div>
        </DialogContent>
      </Dialog>
    </>
  );
}
