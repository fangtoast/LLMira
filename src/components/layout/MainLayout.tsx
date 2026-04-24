"use client";
import { useEffect, useMemo } from "react";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { InputBar } from "@/components/chat/InputBar";
import { TokenStats } from "@/components/chat/TokenStats";
import { ArtifactsPanel } from "@/components/artifacts/ArtifactsPanel";
import { ApiKeyModal } from "@/components/modals/ApiKeyModal";
import { useChat } from "@/hooks/useChat";
import { useConversations } from "@/hooks/useConversations";
import { useChatStore } from "@/lib/store/chatStore";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function MainLayout() {
  const { sendMessage, loading } = useChat();
  const { loadMessages } = useConversations();
  const { activeConversationId, messagesByConversation, lastTokenUsage } = useChatStore();
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

  return (
    <div className="flex h-screen w-full bg-background text-foreground dark:bg-zinc-900">
      <Sidebar />
      <section className="relative flex min-w-0 flex-1 flex-col bg-card/65 shadow-[inset_24px_0_36px_-28px_rgba(0,0,0,0.15)] dark:bg-zinc-900/96 dark:shadow-[inset_24px_0_36px_-28px_rgba(0,0,0,0.42)]">
        <TopBar />
        <div className="min-h-0 flex-1">
          <ChatWindow messages={messages} conversationId={activeConversationId} />
        </div>
        <div className="mx-auto w-full max-w-3xl px-3">
          <TokenStats usage={lastTokenUsage} />
        </div>
        <InputBar onSend={sendMessage} loading={loading} />
      </section>
      <ArtifactsPanel open={Boolean(artifactContent)} content={artifactContent} />
      <ApiKeyModal />
    </div>
  );
}
