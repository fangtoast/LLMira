"use client";

/**
 * @project LLMira
 * @file src/components/chat/ChatWindow.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-04-30
 * @function
 *   - 消息列表滚动区、回到底部、可见用户消息上报（导览高亮）
 * @description 每条消息挂载 `msg-${id}` 锚点供右侧导览跳转。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MessageBubble } from "./MessageBubble";
import { WelcomePanel } from "./WelcomePanel";
import type { ChatMessage } from "@/types";
import { cn } from "@/lib/utils";

const SCROLL_BOTTOM_THRESHOLD = 72;

/** 中部可滚动消息列表容器。 */
export function ChatWindow({
  messages,
  conversationId,
  loading,
  isStreamingMessage,
  onCopy,
  onEditUserMessage,
  onDelete,
  onRegenerate,
  onActiveUserMessageChange,
}: {
  messages: ChatMessage[];
  conversationId?: string | null;
  loading: boolean;
  isStreamingMessage: (m: ChatMessage) => boolean;
  onCopy: (m: ChatMessage) => void;
  onEditUserMessage: (id: string, text: string) => void;
  onDelete: (m: ChatMessage) => void;
  onRegenerate?: () => void;
  onActiveUserMessageChange?: (messageId: string | null) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const rafRef = useRef<number | null>(null);
  const [showBackBottom, setShowBackBottom] = useState(false);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const el = rootRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const onScroll = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const d = el.scrollHeight - el.scrollTop - el.clientHeight;
    const at = d < SCROLL_BOTTOM_THRESHOLD;
    atBottomRef.current = at;
    setShowBackBottom(!at && messages.length > 0);
  }, [messages.length]);

  useEffect(() => {
    onScroll();
  }, [onScroll, messages.length]);

  useEffect(() => {
    if (atBottomRef.current && messages.length > 0) {
      rafRef.current = requestAnimationFrame(() => {
        scrollToBottom("auto");
        rafRef.current = null;
      });
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [messages, scrollToBottom, loading]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !onActiveUserMessageChange) return;
    const userMessages = messages.filter((item) => item.role === "user");
    if (userMessages.length === 0) {
      onActiveUserMessageChange(null);
      return;
    }
    const visibleMap = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.getAttribute("data-message-id");
          if (!id) continue;
          if (entry.isIntersecting) visibleMap.set(id, entry.intersectionRatio);
          else visibleMap.delete(id);
        }
        if (visibleMap.size > 0) {
          const activeId = [...visibleMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
          onActiveUserMessageChange(activeId);
          return;
        }
        onActiveUserMessageChange(userMessages[userMessages.length - 1]?.id ?? null);
      },
      {
        root,
        threshold: [0.25, 0.5, 0.75],
      },
    );

    for (const message of userMessages) {
      const el = root.querySelector<HTMLElement>(`[data-message-id="${message.id}"]`);
      if (el) observer.observe(el);
    }

    onActiveUserMessageChange(userMessages[userMessages.length - 1]?.id ?? null);

    return () => {
      observer.disconnect();
    };
  }, [messages, onActiveUserMessageChange]);

  return (
    <div
      ref={rootRef}
      onScroll={onScroll}
      className="relative h-full overflow-auto px-3 sm:px-6"
    >
      <div className="mx-auto w-full max-w-3xl py-6 sm:py-8">
        {messages.length === 0 ? (
          <WelcomePanel conversationId={conversationId} />
        ) : (
          <div className="space-y-6">
            {[...messages.entries()].map(([idx, item]) => {
              return (
                <div key={item.id} id={`msg-${item.id}`} data-message-id={item.id}>
                  <MessageBubble
                    message={item}
                    isLastAssistant={item.role === "assistant" && idx === messages.length - 1}
                    isStreaming={isStreamingMessage(item)}
                    onCopy={() => onCopy(item)}
                    onEditSave={(t) => onEditUserMessage(item.id, t)}
                    onDelete={() => onDelete(item)}
                    onRegenerate={item.role === "assistant" && idx === messages.length - 1 ? onRegenerate : undefined}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
      {showBackBottom ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn(
            "absolute bottom-4 right-4 z-10 h-9 rounded-full shadow-md",
            "bg-background/90 backdrop-blur",
          )}
          onClick={() => scrollToBottom("smooth")}
        >
          <ChevronDown className="mr-1 h-4 w-4" />
          回到底部
        </Button>
      ) : null}
    </div>
  );
}
