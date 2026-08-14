"use client";

/**
 * @project LLMira
 * @file src/components/translate/TranslationWorkbench.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @function
 *   - 文本/单文件翻译、模型选择、进度、停止与失败段重试
 *   - 译文复制及 TXT/Markdown 下载
 * @description 仅在用户点击翻译后直连当前 Provider；不保存历史或写入聊天会话。
 */
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftRight, Check, ChevronDown, Clipboard, Download, FileText, Loader2, Moon, Send, Settings, Square, Sun, Trash2, Upload } from "lucide-react";
import { useTheme } from "next-themes";
import { ModelLibrary } from "@/components/models/ModelLibrary";
import { ApiKeyModal } from "@/components/modals/ApiKeyModal";
import { PersonalRail } from "@/components/layout/PersonalRail";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { useModelCatalog } from "@/hooks/useModels";
import { streamChatCompletion } from "@/lib/api/client";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { getTranslationExportFilename, runTranslationChunks, splitTranslationText, TRANSLATION_MAX_CHARS, type TranslationJob } from "@/lib/translation/core";
import { readTranslationFile, TRANSLATION_FILE_ACCEPT } from "@/lib/translation/file";
import { cn } from "@/lib/utils";
import type { TokenUsage } from "@/types";

const loadUsageRecorders = () => import("@/lib/usage/recorders");

const LANGUAGES = [
  ["auto", "自动检测"], ["zh-CN", "简体中文"], ["zh-TW", "繁体中文"], ["en", "英语"],
  ["ja", "日语"], ["ko", "韩语"], ["fr", "法语"], ["de", "德语"], ["es", "西班牙语"],
] as const;

function languageLabel(code: string) {
  return LANGUAGES.find(([value]) => value === code)?.[1] ?? code;
}

function LanguageMenu({ value, onChange, source = false }: { value: string; onChange: (value: string) => void; source?: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button type="button" variant="outline" className="min-w-[9.5rem] justify-between rounded-xl">{languageLabel(value)}<ChevronDown aria-hidden /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52"><DropdownMenuLabel>{source ? "源语言" : "目标语言"}</DropdownMenuLabel>{LANGUAGES.filter(([code]) => source || code !== "auto").map(([code, label]) => <DropdownMenuItem key={code} onSelect={() => onChange(code)}>{label}{value === code ? <Check className="ml-auto size-4 text-primary" /> : null}</DropdownMenuItem>)}</DropdownMenuContent>
    </DropdownMenu>
  );
}

function downloadText(text: string, filename: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** LLMira 翻译一级页面。 */
export function TranslationWorkbench() {
  const settings = useSettingsStore();
  const catalog = useModelCatalog().filter((model) => model.capabilities.chat);
  const profile = settings.apiProfiles.find((item) => item.id === settings.activeApiProfileId) ?? settings.apiProfiles[0];
  const savedModel = profile ? settings.translationModelByProviderId[profile.id] : undefined;
  const translationModel = catalog.some((model) => model.id === savedModel)
    ? savedModel!
    : catalog.some((model) => model.id === settings.activeModel) ? settings.activeModel : (catalog[0]?.id ?? "");
  const modelMetadata = catalog.find((model) => model.id === translationModel);
  const [sourceLanguage, setSourceLanguage] = useState("auto");
  const [targetLanguage, setTargetLanguage] = useState("zh-CN");
  const [source, setSource] = useState("");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [fileStatus, setFileStatus] = useState<"idle" | "reading" | "ready" | "error">("idle");
  const [error, setError] = useState<string>();
  const [job, setJob] = useState<TranslationJob>();
  const [streamingText, setStreamingText] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    void useSettingsStore.getState().hydrateProviderSecrets();
  }, []);

  const translatedText = useMemo(() => `${job?.results.join("") ?? ""}${streamingText}`, [job?.results, streamingText]);
  const running = job?.status === "running";

  const run = async (startIndex = 0, initialResults: string[] = [], existingChunks?: TranslationJob["chunks"]) => {
    if (!profile?.apiKey) {
      settings.setApiKeyModalOpen(true);
      setError("请先配置当前 Provider 的 API Key");
      return;
    }
    if (!translationModel) {
      setError("当前 Provider 没有可用聊天模型");
      return;
    }
    const trimmed = source;
    if (!trimmed.trim()) {
      setError("请输入或上传要翻译的内容");
      return;
    }
    let chunks: TranslationJob["chunks"];
    try {
      chunks = existingChunks ?? splitTranslationText(trimmed, modelMetadata?.contextWindow);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "无法创建翻译任务");
      return;
    }
    setError(undefined);
    const controller = new AbortController();
    const operationId = crypto.randomUUID();
    abortRef.current = controller;
    setStreamingText("");
    const result = await runTranslationChunks({
      chunks,
      startIndex,
      initialResults,
      signal: controller.signal,
      onProgress: setJob,
      translateChunk: async (chunk, index, signal) => {
        let output = "";
        let usage: TokenUsage | undefined;
        const startedAt = Date.now();
        try {
          await streamChatCompletion(profile, {
          model: translationModel,
          temperature: 0.2,
          top_p: 1,
          max_tokens: settings.modelSettingsById[translationModel]?.maxTokens ?? 4096,
          messages: [
            { role: "system", content: "You are a professional translator. Return only the translation. Preserve headings, Markdown syntax, code fences, paragraph order, and blank lines. Do not summarize or add commentary." },
            { role: "user", content: `Translate the following content from ${languageLabel(sourceLanguage)} to ${languageLabel(targetLanguage)}. Keep formatting unchanged.\n\n${chunk.source}` },
          ],
        }, {
          onToken: (token) => {
            output += token;
            setStreamingText(output);
          },
          onDone: (nextUsage) => { usage = nextUsage; setStreamingText(""); },
          onAbort: () => setStreamingText(""),
          }, { signal });
          if (!signal.aborted && !output) throw new Error(`第 ${index + 1} 段未返回译文`);
          await (await loadUsageRecorders()).recordTranslationUsage(operationId, startedAt, signal.aborted ? "cancelled" : "completed", profile, translationModel, usage);
        } catch (translationError) {
          await (await loadUsageRecorders()).recordTranslationUsage(operationId, startedAt, signal.aborted ? "cancelled" : "failed", profile, translationModel, usage);
          throw translationError;
        }
        setStreamingText("");
        return output;
      },
    });
    setJob(result);
    abortRef.current = null;
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setSourceFile(file);
    setFileStatus("reading");
    setError(undefined);
    try {
      const text = await readTranslationFile(file);
      if (text.length > TRANSLATION_MAX_CHARS) throw new Error(`文件正文超过 ${TRANSLATION_MAX_CHARS.toLocaleString("zh-CN")} 个字符`);
      setSource(text);
      setFileStatus("ready");
      setJob(undefined);
    } catch (fileError) {
      setFileStatus("error");
      setError(fileError instanceof Error ? fileError.message : "文件读取失败");
    }
  };

  const clear = () => {
    abortRef.current?.abort();
    setSource("");
    setSourceFile(null);
    setFileStatus("idle");
    setJob(undefined);
    setStreamingText("");
    setError(undefined);
  };

  return (
    <div className="flex h-dvh min-h-0 min-w-0 overflow-hidden bg-background text-foreground">
      <PersonalRail active="translate" />
      <section className="flex min-h-0 min-w-0 flex-1 flex-col pb-[4.25rem] md:pb-0">
        <header className="flex h-16 shrink-0 items-center border-b px-4 sm:px-6">
          <h1 className="text-lg font-semibold">翻译</h1>
          <div className="ml-auto flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon" className="rounded-full" disabled={!resolvedTheme} onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} aria-label="切换主题">{resolvedTheme === "dark" ? <Sun /> : <Moon />}</Button>
            <Button asChild variant="ghost" size="sm" className="rounded-full"><Link href="/settings"><Settings data-icon="inline-start" />设置</Link></Button>
          </div>
        </header>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b p-3 sm:px-5">
            <LanguageMenu value={sourceLanguage} onChange={setSourceLanguage} source />
            <Button type="button" variant="ghost" size="icon" className="rounded-xl" disabled={sourceLanguage === "auto"} onClick={() => { const previous = sourceLanguage; setSourceLanguage(targetLanguage); setTargetLanguage(previous); }} aria-label="交换语言"><ArrowLeftRight /></Button>
            <LanguageMenu value={targetLanguage} onChange={setTargetLanguage} />
            <ModelLibrary value={translationModel} onChange={(model) => { if (profile) settings.setTranslationModel(profile.id, model); }} side="bottom" align="start" trigger={<Button type="button" variant="outline" className="max-w-[13rem] justify-between rounded-xl"><span className="truncate">{translationModel || "选择模型"}</span><ChevronDown /></Button>} />
            <Button type="button" className="rounded-xl" disabled={running || fileStatus === "reading" || !source.trim()} onClick={() => void run()}><Send data-icon="inline-start" />翻译</Button>
          </div>
          {error ? <div role="alert" className="border-b border-destructive/30 bg-destructive/10 px-5 py-2 text-sm text-destructive">{error}</div> : null}
          <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-2">
            <section className="flex min-h-[42vh] min-w-0 flex-col border-b md:min-h-0 md:border-b-0 md:border-r">
              <div className="flex h-14 shrink-0 items-center border-b px-4"><h2 className="font-medium">原文</h2><div className="ml-auto flex items-center gap-1"><Button type="button" variant="ghost" size="xs" onClick={clear}><Trash2 data-icon="inline-start" />清空</Button><Button type="button" variant="ghost" size="xs" onClick={() => void navigator.clipboard.writeText(source)}><Clipboard data-icon="inline-start" />复制</Button></div></div>
              <Textarea value={source} onChange={(event) => { setSource(event.target.value.slice(0, TRANSLATION_MAX_CHARS)); setSourceFile(null); setFileStatus("idle"); setJob(undefined); }} placeholder="输入或粘贴要翻译的文本…" className="min-h-0 flex-1 resize-none rounded-none border-0 bg-transparent p-5 text-base leading-7 focus-visible:ring-0" />
              <div className="flex shrink-0 items-center px-5 py-2 text-xs text-muted-foreground"><span>{source.length.toLocaleString("zh-CN")} / {TRANSLATION_MAX_CHARS.toLocaleString("zh-CN")}</span></div>
              <label className="mx-4 mb-3 flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-secondary/20 text-sm text-muted-foreground transition hover:bg-accent" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void handleFile(event.dataTransfer.files[0]); }}>
                {fileStatus === "reading" ? <Loader2 className="animate-spin" /> : <Upload />}
                <span>拖入或选择 PDF、DOCX、TXT、Markdown</span>
                <input type="file" accept={TRANSLATION_FILE_ACCEPT} className="hidden" onChange={(event) => { void handleFile(event.target.files?.[0]); event.currentTarget.value = ""; }} />
              </label>
              {sourceFile ? <div className="mx-4 mb-4 flex items-center gap-3 rounded-xl border bg-card px-3 py-2 text-sm"><FileText className="size-5 text-primary" /><span className="min-w-0 flex-1 truncate">{sourceFile.name}</span><span className="text-xs text-muted-foreground">{fileStatus === "ready" ? "已读取" : fileStatus === "error" ? "读取失败" : "读取中"}</span><Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => { setSourceFile(null); setSource(""); setFileStatus("idle"); }} aria-label="移除文件">×</Button></div> : null}
            </section>
            <section className="flex min-h-[42vh] min-w-0 flex-col">
              <div className="flex h-14 shrink-0 items-center border-b px-4"><h2 className="font-medium">译文</h2><div className="ml-auto flex items-center gap-1"><Button type="button" variant="ghost" size="xs" disabled={!translatedText} onClick={() => void navigator.clipboard.writeText(translatedText)}><Clipboard data-icon="inline-start" />复制</Button><Button type="button" variant="ghost" size="xs" disabled={!translatedText} onClick={() => downloadText(translatedText, getTranslationExportFilename(sourceFile?.name, "txt"), "text/plain;charset=utf-8")}><Download data-icon="inline-start" />TXT</Button><Button type="button" variant="ghost" size="xs" disabled={!translatedText} onClick={() => downloadText(translatedText, getTranslationExportFilename(sourceFile?.name, "md"), "text/markdown;charset=utf-8")}><Download data-icon="inline-start" />Markdown</Button></div></div>
              <div className={cn("min-h-0 flex-1 whitespace-pre-wrap overflow-y-auto p-5 text-base leading-7", !translatedText && "text-muted-foreground")} aria-live="polite">{translatedText || "译文将在这里显示。"}</div>
              {job && job.status !== "idle" ? <div className="m-4 flex shrink-0 items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm"><span className={cn("size-2 rounded-full", job.status === "completed" ? "bg-emerald-500" : job.status === "failed" ? "bg-destructive" : job.status === "cancelled" ? "bg-amber-500" : "bg-primary")} /> <span className="min-w-0 flex-1">{job.status === "running" ? `正在翻译第 ${job.currentIndex + 1} / ${job.chunks.length} 段` : job.status === "completed" ? `翻译完成，共 ${job.chunks.length} 段` : job.status === "cancelled" ? "已停止，已完成内容已保留" : `第 ${(job.failedChunkIndex ?? 0) + 1} 段失败：${job.error}`}</span>{running ? <Button type="button" variant="outline" size="sm" onClick={() => abortRef.current?.abort()}><Square data-icon="inline-start" />停止</Button> : job.status === "failed" ? <Button type="button" variant="outline" size="sm" onClick={() => void run(job.failedChunkIndex, job.results, job.chunks)}>从失败段重试</Button> : null}</div> : null}
            </section>
          </div>
        </div>
      </section>
      <ApiKeyModal />
    </div>
  );
}
