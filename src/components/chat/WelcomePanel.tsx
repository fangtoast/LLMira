"use client";

import { useMemo } from "react";
import { Bot } from "lucide-react";
import { pickQuoteByConversationId } from "@/lib/quotes";

function getGreetingByHour(hour: number) {
  if (hour < 11) return "上午好，潇~";
  if (hour < 14) return "中午好，潇~";
  if (hour < 18) return "下午好，潇~";
  return "晚上好，潇~";
}

export function WelcomePanel({ conversationId }: { conversationId?: string | null }) {
  const { greeting, quote } = useMemo(() => {
    const hour = new Date().getHours();
    return {
      greeting: getGreetingByHour(hour),
      quote: pickQuoteByConversationId(conversationId),
    };
  }, [conversationId]);

  return (
    <div className="mx-auto mt-12 w-full max-w-3xl px-2">
      <div className="flex items-start gap-3 rounded-2xl bg-zinc-900/72 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_28px_rgba(0,0,0,0.3)]">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Bot className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-zinc-100">{greeting}</h2>
          <p className="mt-1 text-sm leading-relaxed text-zinc-400">{quote.length > 30 ? `${quote.slice(0, 30)}...` : quote}</p>
        </div>
      </div>
    </div>
  );
}
