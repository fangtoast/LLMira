import { MarkdownRenderer } from "@/components/markdown/MarkdownRenderer";
import { ChevronDown, Sparkles } from "lucide-react";
import type { ChatMessage } from "@/types";
import { cn } from "@/lib/utils";

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex w-full justify-end">
        <div className="flex max-w-[min(100%,32rem)] flex-col items-end gap-1.5">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="font-medium tracking-tight">{message.senderName ?? "Xiao"}</span>
            <span
              className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border/60 bg-muted/50 text-[11px] font-semibold text-foreground"
              aria-hidden
            >
              {message.senderAvatar ?? "潇"}
            </span>
          </div>
          <div
            className={cn(
              "w-full rounded-2xl border border-border/50 bg-card/90 px-4 py-2.5 text-foreground",
              "shadow-sm dark:border-white/10 dark:bg-zinc-800/70",
            )}
          >
            <MarkdownRenderer
              content={message.content}
              className="prose-p:my-1.5 prose-p:leading-relaxed text-sm text-foreground"
            />
            {message.imageUrls?.length ? (
              <div className="mt-2 grid grid-cols-2 gap-2">
                {message.imageUrls.map((url, idx) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={`${url.slice(0, 16)}-${idx}`}
                    src={url}
                    alt="upload"
                    className="max-h-48 rounded-md border border-border/40 object-cover"
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full justify-start gap-3">
      <div
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary ring-1 ring-primary/20"
        aria-hidden
      >
        <Sparkles className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground/90">{message.senderName ?? "Assistant"}</span>
          {message.modelName ? (
            <span className="rounded-md border border-border/50 bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {message.modelName}
            </span>
          ) : null}
        </div>
        {message.thinkingContent ? (
          <details className="mb-3 border-l-2 border-primary/40 pl-3 text-xs text-muted-foreground open:[&_summary_svg]:rotate-180">
            <summary className="cursor-pointer list-none font-medium text-foreground/80 marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="inline-flex items-center gap-1">
                显示思路
                <ChevronDown className="h-3.5 w-3.5 shrink-0 transition" />
              </span>
            </summary>
            <div className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap leading-relaxed">
              {message.thinkingContent}
            </div>
          </details>
        ) : null}
        <div className="text-foreground">
          <MarkdownRenderer
            content={message.content}
            className="prose-headings:mb-2 prose-headings:mt-4 prose-p:my-2 prose-p:leading-7 first:prose-p:mt-0 prose-li:my-0.5 text-[0.9375rem] leading-7 text-foreground/95"
          />
        </div>
        {message.imageUrls?.length ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {message.imageUrls.map((url, idx) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={`${url.slice(0, 16)}-${idx}`}
                src={url}
                alt="upload"
                className="max-h-48 rounded-lg border border-border/40 object-cover"
              />
            ))}
          </div>
        ) : null}
        {message.generatedImageUrls?.length ? (
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {message.generatedImageUrls.map((url, idx) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={`${url.slice(0, 16)}-${idx}`}
                src={url}
                alt="generated"
                className="max-h-64 rounded-lg border border-border/40 object-contain"
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
