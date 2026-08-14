"use client";

/**
 * @project LLMira
 * @file src/components/layout/MainLayout.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @function 个人对话与生图主壳、会话加载、流式运行编排
 * @description 一级导航与团队解耦；桌面采用双侧栏，移动端使用会话抽屉和底部导航。
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { X } from "lucide-react";
import { WelcomePanel } from "@/components/chat/WelcomePanel";
import { InputBar } from "@/components/chat/InputBar";
import { TokenStats } from "@/components/chat/TokenStats";
import { Button } from "@/components/ui/button";
import { useChat } from "@/hooks/useChat";
import { useConversations } from "@/hooks/useConversations";
import { useChatStore } from "@/lib/store/chatStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import type { ChatMessage } from "@/types";
import { PersonalRail } from "./PersonalRail";

const ChatWindow = dynamic(
  () => import("@/components/chat/ChatWindow").then((module) => module.ChatWindow),
  { ssr: false, loading: () => <div className="min-h-0 flex-1" aria-label="正在载入会话" /> },
);
const OnboardingModal = dynamic(
  () => import("@/components/modals/OnboardingModal").then((module) => module.OnboardingModal),
  { ssr: false },
);
const ApiKeyModal = dynamic(
  () => import("@/components/modals/ApiKeyModal").then((module) => module.ApiKeyModal),
  { ssr: false },
);
const SessionSidebar = dynamic(
  () => import("./SessionSidebar").then((module) => module.SessionSidebar),
  {
    ssr: false,
    loading: () => <aside className="hidden w-[280px] shrink-0 border-r border-border/70 bg-card md:block" aria-label="正在载入会话列表" />,
  },
);
const TopBar = dynamic(
  () => import("./TopBar").then((module) => module.TopBar),
  {
    ssr: false,
    loading: () => <header className="h-16 shrink-0 border-b border-border/60 bg-background/85" aria-label="正在载入模型工具栏" />,
  },
);

/** 个人聊天应用主壳。 */
export function MainLayout({ mode = "chat" }: { mode?: "chat" | "image" }) {
  const chat = useChat();
  const { loadMessages, deleteConversation } = useConversations();
  const { activeConversationId, messagesByConversation, lastTokenUsage, clientNotice, hydrated } = useChatStore();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const messages = useMemo(() => activeConversationId ? (messagesByConversation[activeConversationId] ?? []) : [], [activeConversationId, messagesByConversation]);
  const showEmptyStage = hydrated && messages.length === 0;

  useEffect(() => { useSettingsStore.getState().setGenerationMode(mode); }, [mode]);
  useEffect(() => {
    void import("@/lib/chat/bootstrapSession").then(({ bootstrapSessionFromIndexedDb }) =>
      bootstrapSessionFromIndexedDb(),
    );
    void useSettingsStore.getState().hydrateProviderSecrets();
  }, []);
  useEffect(() => { if (hydrated && activeConversationId) void loadMessages(activeConversationId); }, [activeConversationId, hydrated, loadMessages]);

  const confirmDelete = useCallback(() => {
    if (!activeConversationId || !window.confirm("确定删除当前会话？此操作只影响本设备。")) return;
    void deleteConversation(activeConversationId);
  }, [activeConversationId, deleteConversation]);

  const isStreamingMessage = useCallback((message: ChatMessage) => {
    if (!chat.loading || !activeConversationId) return false;
    const list = messagesByConversation[activeConversationId] ?? [];
    return message.role === "assistant" && list[list.length - 1]?.id === message.id;
  }, [activeConversationId, chat.loading, messagesByConversation]);

  return (
    <div className="flex h-dvh min-h-0 min-w-0 overflow-hidden bg-background text-foreground">
      <PersonalRail active={mode === "image" ? "images" : "chat"} />
      <SessionSidebar mobileOpen={mobileSidebarOpen} onMobileClose={() => setMobileSidebarOpen(false)} />
      <section className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-background pb-[4.25rem] md:pb-0">
        <TopBar mode={mode} onOpenMobileMenu={() => setMobileSidebarOpen(true)} activeConversationId={activeConversationId} hydrated={hydrated} onDeleteCurrentConversation={confirmDelete} />
        {clientNotice ? <div className="mx-auto mt-2 flex w-[calc(100%-1.5rem)] max-w-4xl items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100"><span className="min-w-0 flex-1">{clientNotice}</span><Button size="sm" variant="outline" onClick={() => void chat.retryLast()}>重试</Button><Button size="icon" variant="ghost" className="size-8" onClick={chat.clearClientNotice} aria-label="关闭提示"><X className="size-4" /></Button></div> : null}
        <div className="min-h-0 flex-1">
          {showEmptyStage ? <div className="flex h-full min-h-0 flex-col items-center justify-center gap-7 px-3 pb-16"><WelcomePanel mode={mode} /><div className="w-full"><InputBar onSend={chat.sendMessage} onStop={chat.stopGeneration} loading={chat.loading} placement="center" /></div></div> : <ChatWindow hydrated={hydrated} messages={messages} loading={chat.loading} isStreamingMessage={isStreamingMessage} onCopy={() => undefined} onEditUserMessage={chat.editUserMessageAndResend} onDelete={(message) => void chat.removeMessage(message.id)} onRegenerate={chat.regenerateAssistantMessage} onVariantChange={chat.setAssistantActiveVariant} />}
        </div>
        {!showEmptyStage ? <><div className="mx-auto w-full max-w-4xl px-3"><TokenStats usage={lastTokenUsage} /></div><InputBar onSend={chat.sendMessage} onStop={chat.stopGeneration} loading={chat.loading} /></> : null}
      </section>
      <OnboardingModal />
      <ApiKeyModal />
    </div>
  );
}
