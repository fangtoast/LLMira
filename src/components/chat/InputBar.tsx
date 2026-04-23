"use client";

import { useState } from "react";
import { ArrowUp, ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function InputBar({
  onSend,
  loading,
}: {
  onSend: (payload: { text: string; imageDataUrls?: string[] }) => Promise<void>;
  loading: boolean;
}) {
  const [value, setValue] = useState("");
  const [images, setImages] = useState<string[]>([]);

  const submit = async () => {
    const text = value.trim();
    if ((!text && images.length === 0) || loading) return;
    setValue("");
    const payload = { text, imageDataUrls: images };
    setImages([]);
    await onSend(payload);
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, 4);
    const encoded = await Promise.all(
      list.map(
        (file) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = reject;
            reader.readAsDataURL(file);
          }),
      ),
    );
    setImages((prev) => [...prev, ...encoded].slice(0, 4));
  };

  return (
    <div className="px-3 pb-4 pt-2 sm:px-6">
      <div className="mx-auto w-full max-w-3xl rounded-full bg-zinc-900/86 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_18px_36px_rgba(0,0,0,0.35)] ring-1 ring-zinc-800/80 transition-all duration-200 hover:ring-zinc-700">
      {images.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2 px-2">
          {images.map((url, idx) => (
            <div key={`${url.slice(0, 20)}-${idx}`} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="upload" className="h-12 w-12 rounded-lg object-cover ring-1 ring-zinc-700" />
              <button
                type="button"
                className="absolute -right-1 -top-1 rounded-full bg-black/70 p-0.5 text-white"
                onClick={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <label className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-zinc-800 text-zinc-400 ring-1 ring-zinc-700 hover:text-zinc-200">
          <ImagePlus className="h-4 w-4" />
          <input
            type="file"
            accept="image/*"
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
          className="min-h-[44px] max-h-32 resize-y rounded-3xl border-none bg-zinc-800/70 leading-relaxed text-zinc-100 ring-0 focus-visible:ring-0"
        />
        <Button
          onClick={() => void submit()}
          disabled={loading}
          size="icon"
          className="h-9 w-9 rounded-full bg-zinc-700/70 text-zinc-300 transition-all duration-200 hover:scale-105 hover:bg-primary hover:text-primary-foreground"
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      </div>
      </div>
    </div>
  );
}
