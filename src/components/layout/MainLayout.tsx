"use client";

/**
 * @project LLMira
 * @file src/components/layout/MainLayout.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-04-30
 * @function
 *   - 三栏骨架：侧栏、对话区、右侧导览或 Artifacts
 * @description 连接 `useChat`、加载 Dexie 消息、装配 TopBar/ChatWindow/InputBar。
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { GuideRail, type GuideItem } from "@/components/chat/GuideRail";
import { InputBar } from "@/components/chat/InputBar";
import { TokenStats } from "@/components/chat/TokenStats";
import { ArtifactsPanel } from "@/components/artifacts/ArtifactsPanel";
import { ApiKeyModal } from "@/components/modals/ApiKeyModal";
import { Button } from "@/components/ui/button";
import { useChat } from "@/hooks/useChat";
import { useConversations } from "@/hooks/useConversations";
import { useChatStore } from "@/lib/store/chatStore";
import type { ChatMessage } from "@/types";
import { useIsMdUp } from "@/hooks/useMediaQuery";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

/** 聊天应用主壳层。 */
export function MainLayout() {
  const {
    sendMessage,
    loading,
    stopGeneration,
    regenerateFromLastUser,
    editUserMessageAndResend,
    removeMessage,
    retryLast,
    clearClientNotice,
  } = useChat();
  const { loadMessages } = useConversations();
  const { activeConversationId, messagesByConversation, lastTokenUsage, clientNotice } = useChatStore();
  const messages = useMemo(
    () => (activeConversationId ? (messagesByConversation[activeConversationId] ?? []) : []),
    [activeConversationId, messagesByConversation],
  );
  const artifactContent = useMemo(() => {
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    if (!lastAssistant) return "";
    if (lastAssistant.content.includes("```") || lastAssistant.content.includes("<html")) return lastAssistant.content;
    return "";
  }, [messages]);

  useEffect(() => {
    if (activeConversationId) {
      void loadMessages(activeConversationId);
    }
  }, [activeConversationId, loadMessages]);

  const isMdUp = useIsMdUp();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [rightPanelView, setRightPanelView] = useState<"guide" | "artifacts">("guide");
  const [activeGuideId, setActiveGuideId] = useState<string | null>(null);

  const guideItems = useMemo<GuideItem[]>(() => {
    const truncate = (raw: string) => {
      const normalized = raw.replace(/\s+/g, " ").trim();
      if (!normalized) return "（空提问）";
      const maxLen = 22;
      return normalized.length > maxLen ? `${normalized.slice(0, maxLen)}...` : normalized;
    };
    return messages
      .filter((item) => item.role === "user")
      .map((item) => ({
        id: item.id,
        title: truncate(item.content),
      }));
  }, [messages]);

  useEffect(() => {
    if (isMdUp) setMobileSidebarOpen(false);
  }, [isMdUp]);

  useEffect(() => {
    if (guideItems.length === 0) {
      setActiveGuideId(null);
      return;
    }
    if (!activeGuideId || !guideItems.some((item) => item.id === activeGuideId)) {
      setActiveGuideId(guideItems[guideItems.length - 1]!.id);
    }
  }, [activeGuideId, guideItems]);

  useEffect(() => {
    if (rightPanelView === "artifacts" && !artifactContent) {
      setRightPanelView("guide");
    }
  }, [artifactContent, rightPanelView]);

  const isStreamingMessage = useCallback(
    (m: ChatMessage) => {
      if (!loading || !activeConversationId) return false;
      const list = messagesByConversation[activeConversationId] ?? [];
      const last = list[list.length - 1];
      return m.role === "assistant" && last?.id === m.id;
    },
    [activeConversationId, loading, messagesByConversation],
  );

  const jumpToMessage = useCallback((messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (!el) return;
    setActiveGuideId(messageId);
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div className="flex h-[100dvh] min-h-0 w-full min-w-0 overflow-x-hidden bg-background text-foreground dark:bg-zinc-900">
      {mobileSidebarOpen && !isMdUp ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          aria-label="关闭侧栏"
          onClick={() => setMobileSidebarOpen(false)}
        />
      ) : null}
      <Sidebar
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />
      <section className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden bg-card/65 shadow-[inset_24px_0_36px_-28px_rgba(0,0,0,0.15)] dark:bg-zinc-900/96 dark:shadow-[inset_24px_0_36px_-28px_rgba(0,0,0,0.42)] md:min-w-0">
        <TopBar onOpenMobileMenu={() => setMobileSidebarOpen(true)} />
        {clientNotice ? (
          <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
            <span className="min-w-0 flex-1">{clientNotice}</span>
            <Button size="sm" variant="outline" className="shrink-0" onClick={() => void retryLast()}>
              重试
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => clearClientNotice()} aria-label="关闭">
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
        <div className="min-h-0 flex-1">
          <ChatWindow
            messages={messages}
            conversationId={activeConversationId}
            loading={loading}
            isStreamingMessage={isStreamingMessage}
            onCopy={() => {}}
            onEditUserMessage={editUserMessageAndResend}
            onDelete={(m) => void removeMessage(m.id)}
            onRegenerate={regenerateFromLastUser}
            onActiveUserMessageChange={setActiveGuideId}
          />
        </div>
        <div className="mx-auto w-full max-w-3xl px-3">
          <TokenStats usage={lastTokenUsage} />
        </div>
        <InputBar onSend={sendMessage} onStop={stopGeneration} loading={loading} />
      </section>
      {rightPanelView === "guide" ? (
        <GuideRail
          items={guideItems}
          activeId={activeGuideId}
          onJump={jumpToMessage}
          onSwitchToArtifacts={() => setRightPanelView("artifacts")}
        />
      ) : (
        <ArtifactsPanel
          open={Boolean(artifactContent)}
          content={artifactContent}
          onSwitchToGuide={() => setRightPanelView("guide")}
        />
      )}
      <ApiKeyModal />
    </div>
  );
}
