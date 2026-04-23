"use client";

import { useState } from "react";
import { ArrowUp, FileUp, Sparkles, Wrench, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSettingsStore } from "@/lib/store/settingsStore";

interface AttachmentItem {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl?: string;
}

export function InputBar({
  onSend,
  loading,
}: {
  onSend: (payload: { text: string; imageDataUrls?: string[] }) => Promise<void>;
  loading: boolean;
}) {
  const { generationMode, setGenerationMode, enableThinking, setEnableThinking } = useSettingsStore();
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [dragActive, setDragActive] = useState(false);

  const imageDataUrls = attachments.filter((item) => item.type.startsWith("image/") && item.dataUrl).map((item) => item.dataUrl!);

  const submit = async () => {
    const text = value.trim();
    if ((!text && attachments.length === 0) || loading) return;
    setValue("");
    const fileHint =
      attachments.length > 0
        ? `\n\n[已附加文件: ${attachments.map((item) => item.name).join(", ")}]`
        : "";
    const payload = { text: `${text}${fileHint}`.trim(), imageDataUrls };
    setAttachments([]);
    await onSend(payload);
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

  return (
    <div
      className="px-3 pb-4 pt-2 sm:px-6"
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
        className={`mx-auto w-full max-w-3xl rounded-[32px] border border-border/70 bg-card/40 p-3 backdrop-blur-md transition-all duration-200 dark:border-white/10 dark:bg-white/5 ${
          dragActive ? "shadow-[0_0_0_1px_rgba(59,130,246,0.55)]" : "shadow-[0_12px_28px_rgba(0,0,0,0.28)]"
        }`}
      >
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2 px-1">
            {attachments.map((item) => (
              <div
                key={item.id}
                className="relative flex items-center gap-2 rounded-full bg-secondary/70 px-2 py-1 text-xs text-foreground dark:bg-white/10 dark:text-zinc-200"
              >
                {item.dataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.dataUrl} alt={item.name} className="h-6 w-6 rounded-full object-cover" />
                ) : (
                  <FileUp className="h-3.5 w-3.5 text-muted-foreground dark:text-zinc-400" />
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

        <div className="flex items-center gap-2">
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder="输入你的问题..."
          className="min-h-[44px] max-h-32 resize-y rounded-2xl border-none bg-transparent leading-relaxed text-foreground ring-0 focus-visible:ring-0 dark:text-zinc-100"
        />
        <Button
          onClick={() => void submit()}
          disabled={loading}
          size="icon"
          className="h-9 w-9 rounded-full bg-secondary/80 text-muted-foreground transition-all duration-200 hover:scale-105 hover:bg-primary hover:text-primary-foreground dark:bg-white/10 dark:text-zinc-300"
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      </div>
      <div className="mt-2 flex items-center justify-between px-1 text-sm text-muted-foreground dark:text-zinc-400">
        <div className="flex items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-1 rounded-full px-2 py-1 hover:bg-white/10">
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
          <details className="relative">
            <summary className="inline-flex list-none cursor-pointer items-center gap-1 rounded-full px-2 py-1 hover:bg-white/10">
              <Wrench className="h-3.5 w-3.5" />
              工具
            </summary>
            <div className="absolute left-0 top-8 z-20 w-40 rounded-lg bg-card p-1 shadow-xl ring-1 ring-border dark:bg-zinc-900 dark:ring-zinc-700">
              <button
                type="button"
                onClick={() => setGenerationMode("chat")}
                className={`block w-full rounded-md px-2 py-1 text-left text-xs ${generationMode === "chat" ? "bg-secondary text-foreground dark:bg-zinc-800 dark:text-zinc-100" : "text-muted-foreground hover:bg-accent dark:text-zinc-300 dark:hover:bg-zinc-800/70"}`}
              >
                对话模式
              </button>
              <button
                type="button"
                onClick={() => setGenerationMode("image")}
                className={`mt-1 block w-full rounded-md px-2 py-1 text-left text-xs ${generationMode === "image" ? "bg-secondary text-foreground dark:bg-zinc-800 dark:text-zinc-100" : "text-muted-foreground hover:bg-accent dark:text-zinc-300 dark:hover:bg-zinc-800/70"}`}
              >
                文生图模式
              </button>
            </div>
          </details>
          <label className="inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-white/10">
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
        <div className="flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-zinc-400">
            当前: {generationMode === "image" ? "文生图" : "对话"}
          </span>
          {enableThinking && generationMode === "chat" ? (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-white/10">
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
