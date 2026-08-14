"use client";

/**
 * @project LLMira
 * @file src/components/chat/MessageBubble.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-05-12
 * @function
 *   - 单条消息 UI：Markdown、思考折叠、图片网格、编辑/复制/重试
 * @description 助手侧解析遗留 `<think>` 标签展示思考内容（兼容部分网关）。
 */
import { memo, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Code2, Copy, Download, ExternalLink, FileText, Pencil, RefreshCw, Trash2, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { ChatMessage } from "@/types";
import { cn } from "@/lib/utils";
import { BRAND_ICON_PATH, BRAND_NAME } from "@/lib/brand";

const MarkdownRenderer = dynamic(
  () => import("@/components/markdown/MarkdownRenderer").then((module) => module.MarkdownRenderer),
  {
    ssr: false,
    loading: () => <div className="whitespace-pre-wrap text-sm text-foreground/90">正在渲染回答…</div>,
  },
);

type Props = {
  message: ChatMessage;
  isStreaming: boolean;
  onCopy: () => void;
  onEditSave: (text: string) => void;
  onDelete: () => void;
  onRegenerate?: () => void;
  onVariantChange?: (variantIdx: number) => void;
};

function MessageBubbleImpl({
  message,
  isStreaming,
  onCopy,
  onEditSave,
  onDelete,
  onRegenerate,
  onVariantChange,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [copiedImageKey, setCopiedImageKey] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editText, setEditText] = useState(message.content);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestCopied, setRequestCopied] = useState(false);
  const [failedImageKeys, setFailedImageKeys] = useState<Record<string, boolean>>({});
  const [reloadSeed, setReloadSeed] = useState<Record<string, number>>({});
  const isUser = message.role === "user";

  // 多版本导航
  const totalVariants = message.variants?.length ?? 1;
  const defaultVariantIdx = message.activeVariantIdx ?? totalVariants - 1;
  const [variantIdx, setVariantIdx] = useState(defaultVariantIdx);

  useEffect(() => {
    const total = message.variants?.length ?? 1;
    setVariantIdx(message.activeVariantIdx ?? total - 1);
  }, [message.variants?.length, message.activeVariantIdx]);

  // streaming 时始终展示 message.content（实时流），否则按版本读取
  const activeVariant = (!isStreaming && !isUser && message.variants?.[variantIdx]) || null;
  const displayContent = activeVariant?.content ?? message.content;
  const displayThinkingRaw = activeVariant?.thinkingContent ?? message.thinkingContent;
  const displayModelName = activeVariant?.modelName ?? message.modelName;
  const displayGeneratedImageUrls = activeVariant?.generatedImageUrls ?? message.generatedImageUrls;
  const displayRequestSnapshot = activeVariant?.requestSnapshot ?? message.requestSnapshot;
  const requestBodyText = displayRequestSnapshot ? JSON.stringify(displayRequestSnapshot.body, null, 2) : "";

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
  const parsed = isUser ? null : extractThinkFromContent(displayContent);
  const thinkContent = isUser ? "" : (displayThinkingRaw?.trim() || parsed?.think || "");
  const answerContent = isUser ? displayContent : (parsed?.answer || "");
  const attachmentImageUrls =
    message.attachments
      ?.filter((item) => item.kind === "image" && item.status === "ready" && item.dataUrl)
      .map((item) => item.dataUrl!) ?? [];
  const userImageUrls = attachmentImageUrls.length ? attachmentImageUrls : (message.imageUrls ?? []);

  const getAttachmentStatusLabel = (item: NonNullable<ChatMessage["attachments"]>[number]) => {
    if (item.status === "reading") return "读取中";
    if (item.status === "error") return "读取失败";
    if (item.status === "unsupported") return "不支持";
    if (item.kind === "image") return "图片";
    if (item.textTruncated) return "已截断";
    return "内容已读取";
  };

  const renderAttachmentList = () => {
    if (!message.attachments?.length) return null;
    return (
      <div className="mt-2 flex flex-wrap gap-2">
        {message.attachments.map((item) => (
          <div
            key={item.id}
            className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border/50 bg-muted/45 px-2 py-1 text-[11px] text-muted-foreground"
            title={item.errorMessage}
          >
            <FileText className="h-3 w-3 shrink-0" />
            <span className="max-w-[160px] truncate">{item.name}</span>
            <span className="shrink-0 text-[10px] text-muted-foreground/80">{getAttachmentStatusLabel(item)}</span>
          </div>
        ))}
      </div>
    );
  };

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

  const doCopyRequestBody = async () => {
    if (!requestBodyText) return;
    await navigator.clipboard.writeText(requestBodyText);
    setRequestCopied(true);
    setTimeout(() => setRequestCopied(false), 1500);
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
        <div className="flex max-w-[min(100%,34rem)] flex-col items-end gap-1.5">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="font-medium tracking-tight">{message.senderName?.trim() || "Xiao"}</span>
            <span
              className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border/60 bg-muted/50 text-[11px] font-semibold text-foreground"
              aria-hidden
            >
              {message.senderAvatar?.trim() || "潇"}
            </span>
          </div>
          <div
            className={cn(
              "w-full rounded-[1.35rem] border border-border/40 bg-card/90 px-4 py-2.5 text-foreground transition-shadow",
              "shadow-sm hover:shadow-md dark:border-white/10 dark:bg-[#2f2f2f]",
            )}
          >
            <MarkdownRenderer
              content={message.content}
              className="prose-p:my-1.5 prose-p:leading-relaxed text-sm text-foreground"
            />
            {renderAttachmentList()}
            {userImageUrls.length ? (
              <div className="mt-2 grid grid-cols-2 gap-2">
                {userImageUrls.map((url, idx) => renderImageCard(url, `u-${idx}-${url.slice(0, 24)}`, "max-h-48 w-full cursor-zoom-in object-cover"))}
              </div>
            ) : null}
          </div>
          {/* 用户消息底部操作栏 */}
          <div className="flex items-center gap-0.5 opacity-0 transition group-hover/msg:opacity-100">
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
      ) : (
        <div className="flex w-full max-w-full flex-1 justify-start gap-3">
          <div
            className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary ring-1 ring-primary/20"
            aria-hidden
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={BRAND_ICON_PATH} alt={BRAND_NAME} className="h-4 w-4 rounded-full object-cover" />
          </div>
          <div className="min-w-0 flex-1 rounded-2xl px-1 py-0.5 transition-colors group-hover/msg:bg-card/25 sm:px-2 dark:group-hover/msg:bg-white/[0.025]">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground/90">{message.senderName ?? "Assistant"}</span>
              {displayModelName ? (
                <span className="rounded-md border border-border/50 bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {displayModelName}
                </span>
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
            {isStreaming && !message.content && !thinkContent ? (
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
                  className="prose-headings:mb-2 prose-headings:mt-4 prose-p:my-2 prose-p:leading-8 first:prose-p:mt-0 prose-li:my-1 text-[1rem] leading-8 text-foreground/95"
                />
              ) : null}
            </div>
            {message.citations?.length ? (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {message.citations.map((citation) => (
                  <a key={`${citation.index}-${citation.url}`} href={citation.url} target="_blank" rel="noopener noreferrer" className="group/source rounded-2xl border border-border/60 bg-muted/25 p-3 transition hover:border-primary/35 hover:bg-muted/45">
                    <div className="flex items-start gap-2"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">{citation.index}</span><span className="min-w-0 flex-1 truncate text-xs font-medium">{citation.title}</span><ExternalLink className="size-3.5 shrink-0 text-muted-foreground group-hover/source:text-primary" /></div>
                    <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-muted-foreground">{citation.snippet || citation.url}</p>
                  </a>
                ))}
              </div>
            ) : null}
            {message.imageUrls?.length ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {message.imageUrls.map((url, idx) => renderImageCard(url, `a-u-${idx}-${url.slice(0, 24)}`, "max-h-48 w-full cursor-zoom-in object-cover"))}
              </div>
            ) : null}
            {displayGeneratedImageUrls?.length ? (
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {displayGeneratedImageUrls.map((url, idx) => renderImageCard(url, `g-${idx}-${url.slice(0, 24)}`, "max-h-64 w-full cursor-zoom-in object-contain bg-black/5"))}
              </div>
            ) : null}

            {/* 底部操作栏 */}
            <div className="mt-2 flex items-center gap-0.5 opacity-0 transition duration-200 group-hover/msg:opacity-100 group-focus-within/msg:opacity-100">
              {totalVariants > 1 ? (
                <>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() =>
                      setVariantIdx((v) => {
                        const next = Math.max(0, v - 1);
                        onVariantChange?.(next);
                        return next;
                      })
                    }
                    disabled={variantIdx === 0}
                    title="上一个版本"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span className="min-w-[2.5rem] text-center text-[11px] text-muted-foreground tabular-nums">
                    {variantIdx + 1} / {totalVariants}
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() =>
                      setVariantIdx((v) => {
                        const next = Math.min(totalVariants - 1, v + 1);
                        onVariantChange?.(next);
                        return next;
                      })
                    }
                    disabled={variantIdx === totalVariants - 1}
                    title="下一个版本"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                  <span className="mx-1 inline-block h-3 w-px bg-border/60" />
                </>
              ) : null}
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={doCopy} title="复制">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
              {onRegenerate ? (
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={onRegenerate} title="重新生成">
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              ) : null}
              {displayRequestSnapshot ? (
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => setRequestOpen(true)} title="查看请求体">
                  <Code2 className="h-3.5 w-3.5" />
                </Button>
              ) : null}
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={onDelete} title="删除">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
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
      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="max-w-2xl">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-medium text-foreground">本次请求体</h3>
                {displayRequestSnapshot ? (
                  <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                    <div className="truncate">Endpoint: {displayRequestSnapshot.endpoint}</div>
                    <div className="truncate">Base URL: {displayRequestSnapshot.baseUrl}</div>
                  </div>
                ) : null}
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => void doCopyRequestBody()}>
                {requestCopied ? "已复制" : "复制 body"}
              </Button>
            </div>
            <pre className="max-h-[60vh] overflow-auto rounded-xl border border-border/70 bg-muted/45 p-3 text-xs leading-5 text-foreground">
              <code>{requestBodyText || "暂无请求体"}</code>
            </pre>
          </div>
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
    prev.isStreaming === next.isStreaming,
);
