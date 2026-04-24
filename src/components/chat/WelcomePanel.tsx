"use client";

import { useMemo } from "react";
import { Bot } from "lucide-react";
import { pickQuoteByConversationId } from "@/lib/quotes";
import { useSettingsStore } from "@/lib/store/settingsStore";

function getGreetingByHour(hour: number, displayName: string) {
  if (hour < 11) return `上午好，${displayName}~`;
  if (hour < 14) return `中午好，${displayName}~`;
  if (hour < 18) return `下午好，${displayName}~`;
  return `晚上好，${displayName}~`;
}

export function WelcomePanel({ conversationId }: { conversationId?: string | null }) {
  const { userAvatarText, userName } = useSettingsStore();
  const { greeting, quote } = useMemo(() => {
    const hour = new Date().getHours();
    const displayName = (userAvatarText || userName || "潇").slice(0, 2);
    return {
      greeting: getGreetingByHour(hour, displayName),
      quote: pickQuoteByConversationId(conversationId),
    };
  }, [conversationId, userAvatarText, userName]);

  return (
    <div className="mx-auto mt-14 w-full max-w-3xl px-2">
      <div className="flex flex-col items-center text-center">
        <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Bot className="h-4.5 w-4.5" />
        </div>
        <h2 className="text-3xl font-semibold tracking-[0.01em] text-foreground sm:text-5xl dark:text-zinc-100">{greeting}</h2>
        <p className="mt-2 text-base font-medium leading-relaxed text-foreground sm:text-[2.5rem] sm:leading-tight dark:text-zinc-200">
          需要我为你做些什么？
        </p>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed tracking-[0.01em] text-muted-foreground dark:text-zinc-400">
          {quote}
        </p>
      </div>
    </div>
  );
}
