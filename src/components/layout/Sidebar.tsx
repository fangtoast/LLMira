"use client";

import { useEffect, useState } from "react";
import { Plus, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { useConversations } from "@/hooks/useConversations";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const [keyword, setKeyword] = useState("");
  const { sidebarCollapsed, setSidebarCollapsed, activeModel } = useSettingsStore();
  const {
    conversations,
    loadAll,
    createConversation,
    deleteConversation,
    searchConversations,
    setActiveConversationId,
    activeConversationId,
  } = useConversations();

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  return (
    <aside
      className={cn(
        "bg-zinc-950 text-zinc-100 shadow-[inset_-1px_0_0_rgba(255,255,255,0.04),16px_0_30px_-22px_rgba(0,0,0,0.75)] transition-all",
        sidebarCollapsed ? "w-16" : "w-72",
      )}
    >
      <div className="flex h-12 items-center justify-between px-2">
        <Button variant="ghost" size="icon" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
          {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
        {!sidebarCollapsed && (
          <Button size="sm" className="rounded-xl bg-zinc-900 text-zinc-100 hover:bg-zinc-800" onClick={() => void createConversation(activeModel)}>
            <Plus className="mr-1 h-4 w-4" />
            新建
          </Button>
        )}
      </div>
      {!sidebarCollapsed && (
        <div className="p-2 pt-0">
          <Input
            value={keyword}
            onChange={(e) => {
              const v = e.target.value;
              setKeyword(v);
              void searchConversations(v);
            }}
            placeholder="搜索对话"
            className="rounded-xl border-none bg-zinc-900 text-zinc-200 ring-1 ring-zinc-800"
          />
        </div>
      )}
      <ScrollArea className="h-[calc(100vh-5rem)] px-2 pb-3">
        {conversations.map((item) => (
          <div
            key={item.id}
            className={cn(
              "group mb-1 flex items-center gap-1 rounded-full px-3 py-1.5 transition-colors",
              activeConversationId === item.id
                ? "bg-zinc-800/95 text-zinc-100 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                : "hover:bg-white/10 text-zinc-400",
            )}
          >
            {activeConversationId === item.id ? <div className="h-5 w-[2px] rounded-full bg-sky-400" /> : <div className="w-[2px]" />}
            <button className="min-w-0 flex-1 truncate px-1 py-1 text-left text-sm" onClick={() => setActiveConversationId(item.id)}>
              {sidebarCollapsed ? item.title.slice(0, 1) : item.title}
            </button>
            {!sidebarCollapsed && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0 rounded-full text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-zinc-700/70 hover:text-zinc-100"
                onClick={() => void deleteConversation(item.id)}
                aria-label="删除对话"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </ScrollArea>
    </aside>
  );
}
