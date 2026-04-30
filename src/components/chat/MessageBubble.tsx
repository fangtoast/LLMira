"use client";

/**
 * @project LLMira
 * @file src/components/chat/MessageBubble.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-04-30
 * @function
 *   - 单条消息 UI：Markdown、思考折叠、图片网格、编辑/复制/重试
 * @description 助手侧解析遗留 `<think>` 标签展示思考内容（兼容部分网关）。
 */
import { memo, useEffect, useState } from "react";
import { Check, Copy, Download, Pencil, RefreshCw, Trash2, ChevronDown, ZoomIn } from "lucide-react";
import { MarkdownRenderer } from "@/components/markdown/MarkdownRenderer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { ChatMessage } from "@/types";
import { cn } from "@/lib/utils";
import { BRAND_ICON_PATH, BRAND_NAME } from "@/lib/brand";

type Props = {
  message: ChatMessage;
  isLastAssistant: boolean;
  isStreaming: boolean;
  onCopy: () => void;
  onEditSave: (text: string) => void;
  onDelete: () => void;
  onRegenerate?: () => void;
};

function MessageBubbleImpl({
  message,
  isLastAssistant,
  isStreaming,
  onCopy,
  onEditSave,
  onDelete,
  onRegenerate,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [copiedImageKey, setCopiedImageKey] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editText, setEditText] = useState(message.content);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [failedImageKeys, setFailedImageKeys] = useState<Record<string, boolean>>({});
  const [reloadSeed, setReloadSeed] = useState<Record<string, number>>({});
  const isUser = message.role === "user";
  const extractThinkFromContent = (raw: string) => {
    const regex = /<think>([\s\S]*?)<\/think>/gi;
    const thinks: string[] = [];
    const answer = raw.replace(regex, (_, block: string) => {
      const t = block.trim();
      if (t) thinks.push(t);
      return "";
    });
    return {
      answer: answer.trim(),
      think: thinks.join("\n\n").trim(),
    };
  };
  const parsed = isUser ? null : extractThinkFromContent(message.content);
  const thinkContent = isUser ? "" : (message.thinkingContent?.trim() || parsed?.think || "");
  const answerContent = isUser ? message.content : (parsed?.answer || "");

  useEffect(() => {
    setEditText(message.content);
  }, [message.content]);

  const doCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    onCopy();
    setTimeout(() => setCopied(false), 1500);
  };

  const doCopyImageUrl = async (url: string, key: string) => {
    await navigator.clipboard.writeText(url);
    setCopiedImageKey(key);
    setTimeout(() => setCopiedImageKey((v) => (v === key ? null : v)), 1500);
  };

  const doDownloadImage = (url: string, key: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = `generated-${Date.now()}.png`;
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setCopiedImageKey(key);
    setTimeout(() => setCopiedImageKey((v) => (v === key ? null : v)), 1500);
  };

  const renderImageCard = (url: string, key: string, className: string) => {
    const failed = Boolean(failedImageKeys[key]);
    const nonce = reloadSeed[key] ?? 0;
    const src = /^data:image\//i.test(url) ? url : nonce > 0 ? `${url}${url.includes("?") ? "&" : "?"}r=${nonce}` : url;
    return (
      <div key={key} className="group/img relative overflow-hidden rounded-lg border border-border/40">
        {!failed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt="generated"
            className={className}
            loading="lazy"
            onClick={() => setPreviewUrl(url)}
            onError={() => setFailedImageKeys((s) => ({ ...s, [key]: true }))}
          />
        ) : (
          <div className="flex h-44 items-center justify-center bg-muted/50 text-xs text-muted-foreground">
            <div className="space-y-2 text-center">
              <div>图片加载失败</div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setFailedImageKeys((s) => ({ ...s, [key]: false }));
                  setReloadSeed((s) => ({ ...s, [key]: Date.now() }));
                }}
              >
                重试加载
              </Button>
            </div>
          </div>
        )}
        {!failed ? (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-1 bg-gradient-to-t from-black/55 to-transparent p-2 opacity-0 transition group-hover/img:opacity-100">
            <Button size="icon" variant="outline" className="h-7 w-7 bg-background/90" onClick={() => setPreviewUrl(url)} title="放大预览">
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="outline" className="h-7 w-7 bg-background/90" onClick={() => doDownloadImage(url, `download:${key}`)} title="下载图片">
              <Download className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="outline" className="h-7 w-7 bg-background/90" onClick={() => void doCopyImageUrl(url, `copy:${key}`)} title="复制图片链接">
              {copiedImageKey === `copy:${key}` ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div
      className={cn(
        "group/msg relative w-full",
        isUser ? "flex justify-end" : "flex justify-start",
      )}
    >
      {isUser ? (
        <div className="flex max-w-[min(100%,32rem)] flex-col items-end gap-1.5">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="font-medium tracking-tight">{message.senderName ?? "Xiao"}</span>
            <span
              className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border/60 bg-muted/50 text-[11px] font-semibold text-foreground"
              aria-hidden
            >
              {message.senderAvatar ?? "潇"}
            </span>
            <div className="ml-1 flex items-center gap-0.5 opacity-0 transition group-hover/msg:opacity-100">
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={doCopy} title="复制">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditText(message.content); setEditOpen(true); }} title="编辑">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={onDelete} title="删除">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
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
                {message.imageUrls.map((url, idx) => renderImageCard(url, `u-${idx}-${url.slice(0, 24)}`, "max-h-48 w-full cursor-zoom-in object-cover"))}
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex w-full max-w-full flex-1 justify-start gap-3">
          <div
            className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary ring-1 ring-primary/20"
            aria-hidden
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={BRAND_ICON_PATH} alt={BRAND_NAME} className="h-4 w-4 rounded-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground/90">{message.senderName ?? "Assistant"}</span>
              {message.modelName ? (
                <span className="rounded-md border border-border/50 bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {message.modelName}
                </span>
              ) : null}
              <div className="ml-auto flex items-center gap-0.5 opacity-0 transition group-hover/msg:opacity-100">
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={doCopy} title="复制">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
                {onRegenerate && isLastAssistant ? (
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={onRegenerate} title="重新生成">
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={onDelete} title="删除">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            {isStreaming && !message.content ? (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <span className="inline-flex gap-0.5">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: "0ms" }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: "150ms" }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: "300ms" }} />
                </span>
                正在输入…
              </div>
            ) : null}
            <div className={cn("text-foreground", thinkContent ? "mt-1" : "")}>
              {answerContent ? (
                <MarkdownRenderer
                  content={answerContent}
                  className="prose-headings:mb-2 prose-headings:mt-4 prose-p:my-2 prose-p:leading-7 first:prose-p:mt-0 prose-li:my-0.5 text-[0.9375rem] leading-7 text-foreground/95"
                />
              ) : null}
            </div>
            {thinkContent ? (
              <details className="group/think mt-3 rounded-xl border border-border/60 bg-muted/35 open:[&_summary_svg]:rotate-180 dark:border-zinc-700/80 dark:bg-zinc-900/45">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 marker:content-none [&::-webkit-details-marker]:hidden">
                  <span className="inline-flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/70" />
                    思考过程
                    {isStreaming ? "（生成中）" : ""}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform" />
                </summary>
                <div className="px-3 pb-3">
                  <div className="border-l-2 border-zinc-400/40 pl-3 dark:border-zinc-500/35">
                    <div className="max-h-72 overflow-y-auto whitespace-pre-wrap text-[13px] leading-6 text-zinc-600 dark:text-zinc-400">
                      {thinkContent}
                    </div>
                  </div>
                </div>
              </details>
            ) : null}
            {message.imageUrls?.length ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {message.imageUrls.map((url, idx) => renderImageCard(url, `a-u-${idx}-${url.slice(0, 24)}`, "max-h-48 w-full cursor-zoom-in object-cover"))}
              </div>
            ) : null}
            {message.generatedImageUrls?.length ? (
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {message.generatedImageUrls.map((url, idx) => renderImageCard(url, `g-${idx}-${url.slice(0, 24)}`, "max-h-64 w-full cursor-zoom-in object-contain bg-black/5"))}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {isUser ? (
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <h3 className="mb-2 text-sm font-medium">编辑消息</h3>
            <Textarea
              className="min-h-[120px] border border-border"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>
                取消
              </Button>
              <Button
                type="button"
                onClick={() => {
                  const t = editText.trim();
                  if (t) onEditSave(t);
                  setEditOpen(false);
                }}
              >
                保存并重新回答
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
      <Dialog open={Boolean(previewUrl)} onOpenChange={(open) => !open && setPreviewUrl(null)}>
        <DialogContent className="max-w-5xl">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="preview" className="max-h-[80vh] w-full rounded-md object-contain" />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** 单条聊天气泡（memo 优化重渲染）。 */
export const MessageBubble = memo(
  MessageBubbleImpl,
  (prev, next) =>
    prev.message === next.message &&
    prev.isLastAssistant === next.isLastAssistant &&
    prev.isStreaming === next.isStreaming,
);
