"use client";

/**
 * @project LLMira
 * @file src/components/layout/Sidebar.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-04-30
 * @function
 *   - 会话列表、搜索、导入导出、设置入口、折叠宽度
 * @description 小屏抽屉 / 桌面固定栏；与 `useConversations` 同步。
 */
import { useRef, useState } from "react";
import { Download, Pencil, Plus, ChevronLeft, ChevronRight, Settings2, Trash2, Upload, X } from "lucide-react";
import {
  exportConversationJson,
  exportConversationMarkdown,
  exportConversationPlain,
  parseImportedChatJson,
  parseImportedFullBackupJson,
} from "@/lib/chat/exportImport";
import { useConversations } from "@/hooks/useConversations";
import { useChatStore } from "@/lib/store/chatStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { BRAND_NAME } from "@/lib/brand";
import { useIsMdUp } from "@/hooks/useMediaQuery";

type SidebarProps = {
  /** 小屏下抽屉是否打开（md 以上忽略） */
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

/** 左侧会话与设置侧栏。 */
export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const isMdUp = useIsMdUp();
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
    createConversation,
    deleteConversation,
    searchConversations,
    importFromExport,
    exportFullBackupDownload,
    importFullBackupMerge,
    importFullBackupReplace,
    renameConversation,
    setActiveConversationId,
    activeConversationId,
  } = useConversations();
  const { messagesByConversation } = useChatStore();
  const importRef = useRef<HTMLInputElement>(null);
  const fullBackupImportRef = useRef<HTMLInputElement>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const activeConv = conversations.find((c) => c.id === activeConversationId);
  const activeMessages = activeConversationId ? (messagesByConversation[activeConversationId] ?? []) : [];
  const expanded = !sidebarCollapsed || !isMdUp;

  const downloadFile = (filename: string, content: string, mime: string) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type: mime }));
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <aside
      className={cn(
        "flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-card text-card-foreground dark:bg-zinc-950 dark:text-zinc-100",
        "fixed left-0 top-0 z-50 w-72 max-w-[min(18rem,calc(100vw-0.5rem))] border-r border-border/50 shadow-xl transition-transform duration-200 ease-out",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
        "md:static md:z-10 md:h-screen md:max-h-screen md:w-16 md:translate-x-0 md:border-0 md:shadow-[inset_-1px_0_0_rgba(255,255,255,0.04),16px_0_30px_-22px_rgba(0,0,0,0.35)]",
        !sidebarCollapsed && "md:w-72",
      )}
    >
      <div className="flex h-12 shrink-0 items-center justify-between gap-1 px-2">
        {onMobileClose ? (
          <Button type="button" variant="ghost" size="icon" className="h-9 w-9 md:hidden" onClick={onMobileClose} aria-label="关闭侧栏">
            <X className="h-4 w-4" />
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="hidden h-9 w-9 md:inline-flex"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        >
          {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
        {expanded ? <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground/90">{BRAND_NAME}</span> : null}
        {expanded && (
          <Button
            size="sm"
            className="shrink-0 rounded-xl bg-secondary text-secondary-foreground hover:bg-accent dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            onClick={() => {
              void createConversation(activeModel);
              onMobileClose?.();
            }}
          >
            <Plus className="mr-1 h-4 w-4" />
            新建
          </Button>
        )}
      </div>
      {expanded && (
        <div className="space-y-2 p-2 pt-0">
          <Input
            value={keyword}
            onChange={(e) => {
              const v = e.target.value;
              setKeyword(v);
              void searchConversations(v);
            }}
            placeholder="搜索标题与消息内容"
            className="rounded-xl border-none bg-secondary text-foreground ring-1 ring-border dark:bg-zinc-900 dark:text-zinc-200 dark:ring-zinc-800"
          />
          <div className="flex flex-wrap gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 flex-1 rounded-lg text-[10px]"
              disabled={!activeConv}
              onClick={() => {
                if (!activeConv) return;
                downloadFile(
                  `${activeConv.title.slice(0, 20) || "chat"}.json`,
                  exportConversationJson(activeConv, activeMessages),
                  "application/json",
                );
              }}
            >
              <Download className="mr-0.5 h-3 w-3" />
              JSON
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 flex-1 rounded-lg text-[10px]"
              disabled={!activeMessages.length}
              onClick={() => {
                downloadFile(
                  `${activeConv?.title.slice(0, 20) || "chat"}.md`,
                  exportConversationMarkdown(activeMessages),
                  "text/markdown",
                );
              }}
            >
              MD
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 flex-1 rounded-lg text-[10px]"
              disabled={!activeMessages.length}
              onClick={() => {
                downloadFile(
                  `${activeConv?.title.slice(0, 20) || "chat"}.txt`,
                  exportConversationPlain(activeMessages),
                  "text/plain",
                );
              }}
            >
              文本
            </Button>
            <Button
              type="button"
              size="sm"
              variant="default"
              className="h-7 flex-1 rounded-lg text-[10px]"
              onClick={() => importRef.current?.click()}
            >
              <Upload className="mr-0.5 h-3 w-3" />
              导入
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 flex-1 rounded-lg text-[10px]"
              onClick={() => void exportFullBackupDownload()}
              title="导出全部会话到单个 JSON 文件"
            >
              <Download className="mr-0.5 h-3 w-3" />
              全量备份
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 flex-1 rounded-lg text-[10px]"
              onClick={() => fullBackupImportRef.current?.click()}
              title="从全量备份 JSON 合并或替换恢复"
            >
              <Upload className="mr-0.5 h-3 w-3" />
              导入全量
            </Button>
            <input
              ref={importRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                try {
                  const text = await f.text();
                  const data = parseImportedChatJson(text);
                  await importFromExport(data);
                } catch (err) {
                  window.alert(err instanceof Error ? err.message : "导入失败");
                }
              }}
            />
            <input
              ref={fullBackupImportRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                try {
                  const text = await f.text();
                  const data = parseImportedFullBackupJson(text);
                  const merge = window.confirm(
                    "「确定」：合并——将备份中的会话追加为新会话（保留现有数据）。\n「取消」：进入下一步，可选择清空本地并用备份替换。",
                  );
                  if (merge) {
                    await importFullBackupMerge(data);
                    return;
                  }
                  const replace = window.confirm(
                    "即将清空本浏览器中的全部会话与消息，并用备份文件替换。\n此操作不可撤销。确定继续？",
                  );
                  if (!replace) return;
                  await importFullBackupReplace(data);
                } catch (err) {
                  window.alert(err instanceof Error ? err.message : "全量导入失败");
                }
              }}
            />
          </div>
        </div>
      )}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <ScrollArea className="min-h-0 flex-1 px-2 pb-3">
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
            <button
              className="min-w-0 flex-1 truncate px-1 py-1 text-left text-sm"
              onClick={() => {
                setActiveConversationId(item.id);
                onMobileClose?.();
              }}
            >
              {sidebarCollapsed && isMdUp ? item.title.slice(0, 1) : item.title}
            </button>
            {expanded && (
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0 rounded-full text-muted-foreground opacity-100 transition-opacity hover:bg-accent hover:text-foreground dark:text-zinc-500 dark:hover:bg-zinc-700/70 dark:hover:text-zinc-100 md:opacity-0 md:group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRenameId(item.id);
                    setRenameValue(item.title);
                    setRenameOpen(true);
                  }}
                  aria-label="重命名"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0 rounded-full text-muted-foreground opacity-100 transition-opacity hover:bg-accent hover:text-foreground dark:text-zinc-500 dark:hover:bg-zinc-700/70 dark:hover:text-zinc-100 md:opacity-0 md:group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    void deleteConversation(item.id);
                  }}
                  aria-label="删除对话"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
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
          {expanded ? <span>设置</span> : null}
        </button>

        {settingsOpen && expanded ? (
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
        ) : null}
      </div>
      </div>
      <Dialog
        open={renameOpen}
        onOpenChange={(o) => {
          setRenameOpen(o);
          if (!o) setRenameId(null);
        }}
      >
        <DialogContent>
          <h3 className="mb-2 text-sm font-medium">重命名对话</h3>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            className="w-full"
            placeholder="标题"
            onKeyDown={(e) => {
              if (e.key === "Enter" && renameId) {
                void renameConversation(renameId, renameValue.trim() || "新对话");
                setRenameOpen(false);
              }
            }}
          />
          <div className="mt-3 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setRenameOpen(false)}>
              取消
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (renameId) void renameConversation(renameId, renameValue.trim() || "新对话");
                setRenameOpen(false);
              }}
            >
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
