"use client";

import { MessageBubble } from "./MessageBubble";
import { WelcomePanel } from "./WelcomePanel";
import type { ChatMessage } from "@/types";

export function ChatWindow({
  messages,
  conversationId,
}: {
  messages: ChatMessage[];
  conversationId?: string | null;
}) {
  return (
    <div className="h-full overflow-auto px-3 sm:px-6">
      <div className="mx-auto w-full max-w-3xl py-4 sm:py-6">
        {messages.length === 0 ? <WelcomePanel conversationId={conversationId} /> : null}
        {messages.map((item) => (
          <MessageBubble key={item.id} message={item} />
        ))}
      </div>
    </div>
  );
}
