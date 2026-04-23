import { MarkdownRenderer } from "@/components/markdown/MarkdownRenderer";
import { Bot } from "lucide-react";
import type { ChatMessage } from "@/types";
import { cn } from "@/lib/utils";

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex w-full py-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser ? (
        <div className="mr-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Bot className="h-3.5 w-3.5" />
        </div>
      ) : null}
      <div
        className={cn(
          "max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed md:max-w-[75%]",
          isUser
            ? "bg-primary/85 text-primary-foreground shadow-[0_6px_18px_rgba(0,0,0,0.28)]"
            : "bg-zinc-800/75 text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
        )}
      >
        {!isUser && message.thinkingContent ? (
          <details className="mb-3 rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none font-medium">思考过程（可折叠）</summary>
            <div className="mt-2 whitespace-pre-wrap leading-relaxed">{message.thinkingContent}</div>
          </details>
        ) : null}
        <MarkdownRenderer content={message.content} />
        {message.imageUrls?.length ? (
          <div className="mt-2 grid grid-cols-2 gap-2">
            {message.imageUrls.map((url, idx) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={`${url.slice(0, 16)}-${idx}`} src={url} alt="upload" className="max-h-48 rounded-md border object-cover" />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
