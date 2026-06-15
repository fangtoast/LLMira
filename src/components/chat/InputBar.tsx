"use client";

/**
 * @project LLMira
 * @file src/components/chat/InputBar.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-05-12
 * @function
 *   - 多行输入、附件、发送/停止、可选深度思考
 *   - 附件 accept 与读取态 kind 与 attachmentFormat / parseAttachment 对齐
 * @description 字符上限来自 `NEXT_PUBLIC_INPUT_MAX_CHARS`。
 */
import { useEffect, useRef, useState, type ClipboardEvent, type ClipboardEventHandler } from "react";
import { ArrowUp, CheckCircle2, FileText, FileUp, Loader2, MessageCircle, Paintbrush, Sparkles, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ModelMenu } from "@/components/chat/ModelMenu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useModels } from "@/hooks/useModels";
import { FILE_INPUT_ACCEPT, inferAttachmentKind } from "@/lib/files/attachmentFormat";
import { parseAttachment } from "@/lib/files/parseAttachment";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { cn } from "@/lib/utils";
import type { ChatAttachment } from "@/types";

const INPUT_MAX =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_INPUT_MAX_CHARS
    ? Number.parseInt(process.env.NEXT_PUBLIC_INPUT_MAX_CHARS, 10) || 16000
    : 16000;

function createReadingAttachment(file: File): ChatAttachment {
  return {
    id: `reading-${crypto.randomUUID()}`,
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
    kind: inferAttachmentKind(file),
    status: "reading",
  };
}

/** 底部输入条：聚合附件 data URL 后调用 `onSend`。 */
export function InputBar({
  onSend,
  onStop,
  loading,
  placement = "bottom",
}: {
  onSend: (payload: { text: string; attachments?: ChatAttachment[] }) => Promise<void>;
  onStop: () => void;
  loading: boolean;
  placement?: "bottom" | "center";
}) {
  const {
    activeModel,
    activeImageModel,
    generationMode,
    setGenerationMode,
    setActiveModel,
    setActiveImageModel,
    enableThinking,
    setEnableThinking,
  } = useSettingsStore();
  const models = useModels();
  const imageModels = models.filter((item) => /(image|mj|dall|flux|sd|gpt-image)/i.test(item));
  const modelOptions = generationMode === "image" ? [...new Set([...imageModels, ...models])] : models;
  const currentModel = generationMode === "image" ? activeImageModel : activeModel;
  const selectValue = currentModel
    ? modelOptions.includes(currentModel)
      ? currentModel
      : currentModel
    : (modelOptions[0] ?? "");
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const prevLoading = useRef(loading);

  const resizeTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 192)}px`;
  };

  useEffect(() => {
    if (prevLoading.current && !loading) {
      const id = requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
      return () => cancelAnimationFrame(id);
    }
    prevLoading.current = loading;
  }, [loading]);

  useEffect(() => {
    resizeTextarea();
  }, [value]);

  const hasReadingAttachments = attachments.some((item) => item.status === "reading");

  const submit = async () => {
    if (loading) return;
    if (hasReadingAttachments) return;
    const text = value.trim();
    if (!text && attachments.length === 0) return;
    const savedValue = value;
    const savedAttachments = attachments;
    const toSend = savedValue.slice(0, INPUT_MAX);
    setValue("");
    requestAnimationFrame(resizeTextarea);
    setAttachments([]);
    try {
      const payload = {
        text: toSend.trim(),
        attachments: savedAttachments,
      };
      await onSend(payload);
    } catch {
      setValue(savedValue);
      setAttachments(savedAttachments);
      requestAnimationFrame(resizeTextarea);
    }
  };

  const collectFilesFromEntry = async (entry: FileSystemEntry): Promise<File[]> =>
    new Promise((resolve) => {
      if (entry.isFile) {
        (entry as FileSystemFileEntry).file((file) => resolve([file]), () => resolve([]));
        return;
      }
      if (!entry.isDirectory) {
        resolve([]);
        return;
      }
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      const allEntries: FileSystemEntry[] = [];
      const readAll = () => {
        reader.readEntries(async (entries) => {
          if (!entries.length) {
            const nested = await Promise.all(allEntries.map((item) => collectFilesFromEntry(item)));
            resolve(nested.flat());
            return;
          }
          allEntries.push(...entries);
          readAll();
        }, () => resolve([]));
      };
      readAll();
    });

  const extractDroppedFiles = async (items: DataTransferItemList): Promise<File[]> => {
    const list = Array.from(items);
    const files = await Promise.all(
      list.map(async (item) => {
        const entry = item.webkitGetAsEntry?.();
        if (entry) return collectFilesFromEntry(entry);
        const file = item.getAsFile();
        return file ? [file] : [];
      }),
    );
    return files.flat();
  };

  const mergeAttachments = async (files: File[]) => {
    if (!files.length) return;
    const remainingSlots = Math.max(0, 20 - attachments.length);
    if (remainingSlots <= 0) return;
    const selectedFiles = files.slice(0, remainingSlots);
    const readingAttachments = selectedFiles.map(createReadingAttachment);
    const readingIdByIndex = readingAttachments.map((item) => item.id);
    setAttachments((prev) => [...prev, ...readingAttachments].slice(0, 20));
    const parsed = await Promise.all(selectedFiles.map((file) => parseAttachment(file)));
    const parsedByReadingId = new Map(readingIdByIndex.map((id, idx) => [id, parsed[idx]!]));
    setAttachments((prev) =>
      prev
        .map((item) => parsedByReadingId.get(item.id) ?? item)
        .slice(0, 20),
    );
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    await mergeAttachments(Array.from(files));
  };

  const extractPastedFiles = (e: ClipboardEvent<HTMLTextAreaElement>): File[] => {
    const out: File[] = [];
    const seen = new Set<string>();
    const add = (f: File | null) => {
      if (!f || f.size === 0) return;
      const key = `${f.name}\0${f.size}\0${f.lastModified}\0${f.type}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(f);
    };
    if (e.clipboardData?.items) {
      for (let i = 0; i < e.clipboardData.items.length; i++) {
        const item = e.clipboardData.items[i];
        if (item?.kind === "file") add(item.getAsFile());
      }
    }
    if (e.clipboardData?.files?.length) {
      for (let i = 0; i < e.clipboardData.files.length; i++) {
        add(e.clipboardData.files[i]!);
      }
    }
    return out;
  };

  const handlePaste: ClipboardEventHandler<HTMLTextAreaElement> = async (e) => {
    const files = extractPastedFiles(e);
    if (!files.length) return;
    e.preventDefault();
    await mergeAttachments(files);
  };

  return (
    <div
      className={cn(
        "px-3 sm:px-6",
        placement === "bottom" ? "pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]" : "py-0",
      )}
      onDragEnter={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        if (e.currentTarget === e.target) setDragActive(false);
      }}
      onDrop={async (e) => {
        e.preventDefault();
        setDragActive(false);
        const files = await extractDroppedFiles(e.dataTransfer.items);
        await mergeAttachments(files);
      }}
    >
      <div className="mx-auto flex w-full min-w-0 max-w-4xl flex-col gap-2">
        {attachments.length > 0 && (
          <div className="llmira-soft-pop flex flex-wrap gap-2 px-1">
            {attachments.map((item) => (
              <div
                key={item.id}
                title={
                  item.errorMessage?.trim() ||
                  (item.status === "unsupported"
                    ? "此附件正文不会被注入上下文，可移除后换支持的格式"
                    : undefined)
                }
                className="relative flex items-center gap-2 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700 dark:bg-white/10 dark:text-zinc-200"
              >
                {item.kind === "image" && item.dataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.dataUrl} alt={item.name} className="h-6 w-6 rounded-full object-cover" />
                ) : item.status === "reading" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500 dark:text-zinc-400" />
                ) : item.status === "ready" && item.textContent ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <FileText className="h-3.5 w-3.5 text-slate-500 dark:text-zinc-400" />
                )}
                <span className="max-w-[130px] truncate">{item.name}</span>
                {item.status === "ready" && item.textContent ? (
                  <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-600 dark:text-emerald-300">
                    {item.textTruncated ? "已截断" : "内容已读取"}
                  </span>
                ) : item.status === "reading" ? (
                  <span className="rounded-full bg-sky-500/10 px-1.5 py-0.5 text-[10px] text-sky-600 dark:text-sky-300">
                    读取中
                  </span>
                ) : item.status === "error" ? (
                  <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-600 dark:text-amber-300">
                    读取失败
                  </span>
                ) : item.status === "unsupported" ? (
                  <span className="rounded-full bg-slate-500/10 px-1.5 py-0.5 text-[10px] text-slate-500 dark:text-zinc-400">
                    不支持
                  </span>
                ) : null}
                <button
                  type="button"
                  className="rounded-full bg-black/40 p-0.5 text-white"
                  onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== item.id))}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 text-xs text-muted-foreground">
            <span className="rounded-full bg-secondary/70 px-2.5 py-1 ring-1 ring-border/50 dark:bg-white/5">
              即将使用：<span className="font-medium text-foreground">{selectValue || "模型加载中"}</span>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground sm:justify-end">
            <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-secondary/70 px-3 text-xs ring-1 ring-border/50 transition hover:bg-accent dark:bg-white/5 dark:hover:bg-white/10">
              <FileUp className="h-3.5 w-3.5" />
              附件
              <input
                type="file"
                accept={FILE_INPUT_ACCEPT}
                multiple
                className="hidden"
                onChange={(e) => {
                  void handleUpload(e.target.files);
                  e.currentTarget.value = "";
                }}
              />
            </label>
            <DropdownMenu>
              <DropdownMenuTrigger
                className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-secondary/70 px-3 text-xs text-inherit outline-none ring-1 ring-border/50 transition hover:bg-accent dark:bg-white/5 dark:hover:bg-white/10"
                type="button"
              >
                {generationMode === "image" ? <Paintbrush className="h-3.5 w-3.5" /> : <MessageCircle className="h-3.5 w-3.5" />}
                {generationMode === "image" ? "文生图" : "对话"}
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-40 rounded-2xl p-1.5" sideOffset={6}>
                <DropdownMenuItem className="gap-2 rounded-xl text-xs" onSelect={() => setGenerationMode("chat")}>
                  <MessageCircle className="h-3.5 w-3.5" />
                  对话模式{generationMode === "chat" ? " ✓" : ""}
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 rounded-xl text-xs" onSelect={() => setGenerationMode("image")}>
                  <Paintbrush className="h-3.5 w-3.5" />
                  文生图模式{generationMode === "image" ? " ✓" : ""}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              type="button"
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full bg-secondary/70 px-3 text-xs ring-1 ring-border/50 transition hover:bg-accent dark:bg-white/5 dark:hover:bg-white/10",
                enableThinking && "bg-primary/12 text-primary ring-primary/20 dark:bg-white/10 dark:text-zinc-50",
              )}
              onClick={() => setEnableThinking(!enableThinking)}
            >
              <Sparkles className="h-3.5 w-3.5" />
              思考{enableThinking ? " 开" : ""}
            </button>
            <ModelMenu
              value={selectValue}
              models={modelOptions}
              align="end"
              triggerClassName="h-8 max-w-[11rem] bg-secondary/70 dark:bg-white/5"
              onChange={(model) => {
                if (generationMode === "image") setActiveImageModel(model);
                else setActiveModel(model);
              }}
            />
          </div>
        </div>
        <div
          className={cn(
            "llmira-soft-pop w-full rounded-[28px] border border-slate-200/80 bg-white/90 px-3 py-2 backdrop-blur-xl transition-all duration-300 shadow-[0_16px_42px_rgba(15,23,42,0.14)] hover:shadow-[0_20px_50px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-[#242424]/95 dark:shadow-[0_18px_48px_rgba(0,0,0,0.34)] sm:rounded-[34px]",
            dragActive && "scale-[1.01] ring-2 ring-primary/40",
          )}
        >
        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value.slice(0, INPUT_MAX));
            }}
            onPaste={handlePaste}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder={generationMode === "image" ? "描述你想生成的画面..." : "有问题，尽管问"}
            className="min-h-[2.5rem] max-h-36 rounded-2xl border-none bg-transparent px-1 text-base leading-relaxed text-slate-900 ring-0 placeholder:text-slate-400 focus-visible:ring-0 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
          {loading ? (
            <Button
              type="button"
              onClick={onStop}
              size="icon"
              className="h-10 w-10 shrink-0 rounded-full bg-destructive/90 text-destructive-foreground transition-all duration-200 hover:scale-105"
              aria-label="停止生成"
            >
              <Square className="h-4 w-4 fill-current" />
            </Button>
          ) : (
            <Button
              onClick={() => void submit()}
              size="icon"
              disabled={hasReadingAttachments}
              className="h-10 w-10 shrink-0 rounded-full bg-slate-200 text-slate-600 transition-all duration-200 hover:-translate-y-0.5 hover:scale-105 hover:bg-primary hover:text-primary-foreground dark:bg-white dark:text-zinc-950"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="mt-1 flex items-center justify-between px-2 text-xs text-slate-500 dark:text-zinc-500">
          <span>
            {value.length}/{INPUT_MAX}
          </span>
          {hasReadingAttachments ? <span>附件读取中，完成后可发送</span> : null}
        </div>
        </div>
      </div>
    </div>
  );
}
