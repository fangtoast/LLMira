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
      <div className="mx-auto w-full max-w-3xl py-6 sm:py-8">
        {messages.length === 0 ? (
          <WelcomePanel conversationId={conversationId} />
        ) : (
          <div className="space-y-6">
            {messages.map((item) => (
              <MessageBubble key={item.id} message={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
