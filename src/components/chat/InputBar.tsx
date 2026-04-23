"use client";

import { useState } from "react";
import { ArrowUp, FileUp, ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

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
        className={`mx-auto w-full max-w-3xl rounded-3xl border border-white/10 bg-white/5 p-2 backdrop-blur-md transition-all duration-200 ${
          dragActive ? "shadow-[0_0_0_1px_rgba(59,130,246,0.55)]" : "shadow-[0_12px_28px_rgba(0,0,0,0.28)]"
        }`}
      >
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2 px-1">
            {attachments.map((item) => (
              <div
                key={item.id}
                className="relative flex items-center gap-2 rounded-full bg-white/10 px-2 py-1 text-xs text-zinc-200"
              >
                {item.dataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.dataUrl} alt={item.name} className="h-6 w-6 rounded-full object-cover" />
                ) : (
                  <FileUp className="h-3.5 w-3.5 text-zinc-400" />
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
        <label className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-white/10 text-zinc-400 ring-1 ring-white/10 hover:text-zinc-200">
          <ImagePlus className="h-4 w-4" />
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
          className="min-h-[44px] max-h-32 resize-y rounded-2xl border-none bg-transparent leading-relaxed text-zinc-100 ring-0 focus-visible:ring-0"
        />
        <Button
          onClick={() => void submit()}
          disabled={loading}
          size="icon"
          className="h-9 w-9 rounded-full bg-white/10 text-zinc-300 transition-all duration-200 hover:scale-105 hover:bg-primary hover:text-primary-foreground"
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      </div>
      </div>
    </div>
  );
}
