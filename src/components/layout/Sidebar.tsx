"use client";

import { useEffect, useState } from "react";
import { Plus, ChevronLeft, ChevronRight, Settings2, Trash2 } from "lucide-react";
import { useConversations } from "@/hooks/useConversations";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const [keyword, setKeyword] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const {
    sidebarCollapsed,
    setSidebarCollapsed,
    activeModel,
    userName,
    userAvatarText,
    temperature,
    topP,
    maxTokens,
    presencePenalty,
    frequencyPenalty,
    setTemperature,
    setTopP,
    setMaxTokens,
    setPresencePenalty,
    setFrequencyPenalty,
    setUserName,
    setUserAvatarText,
  } = useSettingsStore();
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
        "bg-card text-card-foreground shadow-[inset_-1px_0_0_rgba(255,255,255,0.04),16px_0_30px_-22px_rgba(0,0,0,0.35)] transition-all dark:bg-zinc-950 dark:text-zinc-100",
        sidebarCollapsed ? "w-16" : "w-72",
      )}
    >
      <div className="flex h-12 items-center justify-between px-2">
        <Button variant="ghost" size="icon" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
          {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
        {!sidebarCollapsed && (
          <Button size="sm" className="rounded-xl bg-secondary text-secondary-foreground hover:bg-accent dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800" onClick={() => void createConversation(activeModel)}>
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
            className="rounded-xl border-none bg-secondary text-foreground ring-1 ring-border dark:bg-zinc-900 dark:text-zinc-200 dark:ring-zinc-800"
          />
        </div>
      )}
      <div className="flex h-[calc(100vh-5rem)] flex-col">
      <ScrollArea className="flex-1 px-2 pb-3">
        {conversations.map((item) => (
          <div
            key={item.id}
            className={cn(
              "group mb-1 flex items-center gap-1 rounded-full px-3 py-1.5 transition-colors",
              activeConversationId === item.id
                ? "bg-secondary text-foreground shadow-[inset_0_0_0_1px_hsl(var(--border))] dark:bg-zinc-800/95 dark:text-zinc-100 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                : "hover:bg-accent/70 text-muted-foreground dark:hover:bg-white/10 dark:text-zinc-400",
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
                className="h-7 w-7 shrink-0 rounded-full text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-accent hover:text-foreground dark:text-zinc-500 dark:hover:bg-zinc-700/70 dark:hover:text-zinc-100"
                onClick={() => void deleteConversation(item.id)}
                aria-label="删除对话"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </ScrollArea>
      <div className="border-t border-border/60 px-2 py-2 dark:border-zinc-800">
        <button
          type="button"
          className={cn(
            "group flex w-full items-center gap-2 rounded-full px-3 py-2 text-left text-sm transition-colors",
            settingsOpen
              ? "bg-secondary text-foreground dark:bg-zinc-800/95 dark:text-zinc-100"
              : "hover:bg-accent/70 text-muted-foreground dark:hover:bg-white/10 dark:text-zinc-400",
          )}
          onClick={() => setSettingsOpen((prev) => !prev)}
        >
          <Settings2 className="h-4 w-4 shrink-0" />
          {!sidebarCollapsed && <span>设置</span>}
        </button>

        {settingsOpen && !sidebarCollapsed && (
          <div className="mt-2 rounded-xl bg-secondary/70 p-2 ring-1 ring-border dark:bg-zinc-900/80 dark:ring-zinc-800">
            <div className="space-y-2 text-xs">
              <label className="flex items-center justify-between gap-2">
                <span>昵称</span>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-24 rounded-md bg-background px-2 py-1 ring-1 ring-border dark:bg-zinc-800"
                />
              </label>
              <label className="flex items-center justify-between gap-2">
                <span>头像文字</span>
                <input
                  type="text"
                  value={userAvatarText}
                  maxLength={2}
                  onChange={(e) => setUserAvatarText(e.target.value)}
                  className="w-16 rounded-md bg-background px-2 py-1 ring-1 ring-border dark:bg-zinc-800"
                />
              </label>
              <label className="flex items-center justify-between gap-2">
                <span>Temperature</span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={temperature}
                  onChange={(e) => setTemperature(Number(e.target.value))}
                  className="w-20 rounded-md bg-background px-2 py-1 ring-1 ring-border dark:bg-zinc-800"
                />
              </label>
              <label className="flex items-center justify-between gap-2">
                <span>Top P</span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={topP}
                  onChange={(e) => setTopP(Number(e.target.value))}
                  className="w-20 rounded-md bg-background px-2 py-1 ring-1 ring-border dark:bg-zinc-800"
                />
              </label>
              <label className="flex items-center justify-between gap-2">
                <span>Max Tokens</span>
                <input
                  type="number"
                  step="1"
                  min="1"
                  max="32768"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(Number(e.target.value))}
                  className="w-20 rounded-md bg-background px-2 py-1 ring-1 ring-border dark:bg-zinc-800"
                />
              </label>
              <label className="flex items-center justify-between gap-2">
                <span>Presence</span>
                <input
                  type="number"
                  step="0.1"
                  min="-2"
                  max="2"
                  value={presencePenalty}
                  onChange={(e) => setPresencePenalty(Number(e.target.value))}
                  className="w-20 rounded-md bg-background px-2 py-1 ring-1 ring-border dark:bg-zinc-800"
                />
              </label>
              <label className="flex items-center justify-between gap-2">
                <span>Frequency</span>
                <input
                  type="number"
                  step="0.1"
                  min="-2"
                  max="2"
                  value={frequencyPenalty}
                  onChange={(e) => setFrequencyPenalty(Number(e.target.value))}
                  className="w-20 rounded-md bg-background px-2 py-1 ring-1 ring-border dark:bg-zinc-800"
                />
              </label>
            </div>
          </div>
        )}
      </div>
      </div>
    </aside>
  );
}
