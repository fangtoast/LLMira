"use client";

import { useEffect, useRef, useState, type ClipboardEvent, type ClipboardEventHandler } from "react";
import { ArrowUp, FileUp, Sparkles, Square, Wrench, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSettingsStore } from "@/lib/store/settingsStore";

const INPUT_MAX =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_INPUT_MAX_CHARS
    ? Number.parseInt(process.env.NEXT_PUBLIC_INPUT_MAX_CHARS, 10) || 16000
    : 16000;

interface AttachmentItem {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl?: string;
}

export function InputBar({
  onSend,
  onStop,
  loading,
}: {
  onSend: (payload: { text: string; imageDataUrls?: string[] }) => Promise<void>;
  onStop: () => void;
  loading: boolean;
}) {
  const { generationMode, setGenerationMode, enableThinking, setEnableThinking } = useSettingsStore();
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const prevLoading = useRef(loading);

  const imageDataUrls = attachments.filter((item) => item.type.startsWith("image/") && item.dataUrl).map((item) => item.dataUrl!);

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

  const submit = async () => {
    if (loading) return;
    const text = value.trim();
    if (!text && attachments.length === 0) return;
    const savedValue = value;
    const savedAttachments = attachments;
    const toSend = savedValue.slice(0, INPUT_MAX);
    setValue("");
    requestAnimationFrame(resizeTextarea);
    const fileHint =
      savedAttachments.length > 0
        ? `\n\n[已附加文件: ${savedAttachments.map((item) => item.name).join(", ")}]`
        : "";
    setAttachments([]);
    try {
      const payload = { text: `${toSend.trim()}${fileHint}`.trim(), imageDataUrls };
      await onSend(payload);
    } catch {
      setValue(savedValue);
      setAttachments(savedAttachments);
      requestAnimationFrame(resizeTextarea);
    }
  };

  const toAttachment = async (file: File): Promise<AttachmentItem> => {
    const base: AttachmentItem = {
      id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
    };
    if (!file.type.startsWith("image/")) return base;

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    return { ...base, dataUrl };
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
    const parsed = await Promise.all(files.slice(0, 20).map((file) => toAttachment(file)));
    setAttachments((prev) => [...prev, ...parsed].slice(0, 20));
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
      className="px-3 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6"
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
      <div
        className={`mx-auto w-full min-w-0 max-w-3xl rounded-2xl border border-slate-200/80 bg-white/85 p-3 backdrop-blur-md transition-all duration-200 shadow-[0_12px_28px_rgba(15,23,42,0.12)] dark:border-white/10 dark:bg-white/5 dark:shadow-[0_12px_28px_rgba(0,0,0,0.28)] sm:rounded-[32px] ${
          dragActive ? "shadow-[0_0_0_1px_rgba(59,130,246,0.55)]" : "shadow-[0_12px_28px_rgba(0,0,0,0.28)]"
        }`}
      >
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2 px-1">
            {attachments.map((item) => (
              <div
                key={item.id}
                className="relative flex items-center gap-2 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700 dark:bg-white/10 dark:text-zinc-200"
              >
                {item.dataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.dataUrl} alt={item.name} className="h-6 w-6 rounded-full object-cover" />
                ) : (
                  <FileUp className="h-3.5 w-3.5 text-slate-500 dark:text-zinc-400" />
                )}
                <span className="max-w-[130px] truncate">{item.name}</span>
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
            placeholder="输入你的问题...（可粘贴/拖入图片或文件；Enter 发送，Shift+Enter 换行）"
            className="min-h-[2.75rem] max-h-48 rounded-2xl border-none bg-transparent leading-relaxed text-slate-900 ring-0 focus-visible:ring-0 dark:text-zinc-100"
          />
          {loading ? (
            <Button
              type="button"
              onClick={onStop}
              size="icon"
              className="h-9 w-9 shrink-0 rounded-full bg-destructive/90 text-destructive-foreground transition-all duration-200 hover:scale-105"
              aria-label="停止生成"
            >
              <Square className="h-4 w-4 fill-current" />
            </Button>
          ) : (
            <Button
              onClick={() => void submit()}
              size="icon"
              className="h-9 w-9 shrink-0 rounded-full bg-slate-200 text-slate-600 transition-all duration-200 hover:scale-105 hover:bg-primary hover:text-primary-foreground dark:bg-white/10 dark:text-zinc-300"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="mt-1 flex items-center justify-between px-1 text-xs text-slate-500 dark:text-zinc-500">
          <span>
            {value.length}/{INPUT_MAX}
          </span>
        </div>
        <div className="mt-2 flex flex-col gap-2 px-1 text-sm text-slate-600 dark:text-zinc-400 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <label className="inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-full px-2 py-1 hover:bg-white/10">
              <FileUp className="h-3.5 w-3.5" />
              附件
              <input
                type="file"
                accept="image/*,.pdf,.doc,.docx,.txt,.md,.csv,.json"
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
                className="inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-full border-none bg-transparent px-2 py-1 text-sm text-inherit outline-none hover:bg-white/10"
                type="button"
              >
                <Wrench className="h-3.5 w-3.5" />
                工具
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-40 p-1" sideOffset={6}>
                <DropdownMenuItem
                  className="text-xs"
                  onSelect={() => setGenerationMode("chat")}
                >
                  对话模式{generationMode === "chat" ? " ✓" : ""}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-xs"
                  onSelect={() => setGenerationMode("image")}
                >
                  文生图模式{generationMode === "image" ? " ✓" : ""}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <label className="inline-flex min-h-9 items-center gap-1 rounded-full px-2 py-1 hover:bg-white/10">
              <Sparkles className="h-3.5 w-3.5" />
              思考
              <input
                type="checkbox"
                checked={enableThinking}
                onChange={(e) => setEnableThinking(e.target.checked)}
                className="ml-1"
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs sm:justify-end sm:gap-3">
            <span className="inline-flex min-h-7 items-center gap-1 rounded-full px-2 py-1 text-zinc-400">
              当前: {generationMode === "image" ? "文生图" : "对话"}
            </span>
            {enableThinking && generationMode === "chat" ? (
              <span className="inline-flex min-h-7 items-center gap-1 rounded-full px-2 py-1 hover:bg-white/10">
                <Sparkles className="h-3.5 w-3.5" />
                深度思考已开启
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
