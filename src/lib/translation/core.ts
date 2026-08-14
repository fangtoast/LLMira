/**
 * @project LLMira
 * @file src/lib/translation/core.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @function
 *   - 按段落、标题和 Markdown 块切分长文
 *   - 顺序执行、取消并保留部分翻译结果
 * @description 纯任务层；网络请求由调用方注入，翻译内容不会写入会话或数据库。
 */
export const TRANSLATION_MAX_CHARS = 200_000;

export interface TranslationChunk {
  id: number;
  source: string;
}

export interface TranslationJob {
  chunks: TranslationChunk[];
  currentIndex: number;
  results: string[];
  status: "idle" | "running" | "completed" | "failed" | "cancelled";
  error?: string;
  failedChunkIndex?: number;
}

/** 已知上下文按保守比例换算，未知上下文使用约 8,000 字符，单块不超过 12,000。 */
export function getTranslationChunkSize(contextWindow?: number): number {
  if (!contextWindow || contextWindow <= 0) return 8_000;
  return Math.min(12_000, Math.max(2_000, Math.floor(contextWindow * 1.6)));
}

function splitOversizedBlock(block: string, maxChars: number): string[] {
  if (block.length <= maxChars) return [block];
  const lines = block.match(/[^\n]*\n|[^\n]+$/g) ?? [block];
  const out: string[] = [];
  let current = "";
  const flush = () => {
    if (current) out.push(current);
    current = "";
  };
  lines.forEach((line) => {
    if (line.length > maxChars) {
      flush();
      for (let index = 0; index < line.length; index += maxChars) out.push(line.slice(index, index + maxChars));
      return;
    }
    if (current.length + line.length > maxChars) flush();
    current += line;
  });
  flush();
  return out;
}

function structuredBlocks(text: string): string[] {
  const lines = text.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  const blocks: string[] = [];
  let current = "";
  let fenced = false;
  const flush = () => {
    if (current) blocks.push(current);
    current = "";
  };
  lines.forEach((line) => {
    const trimmed = line.trimStart();
    const isFence = /^(```|~~~)/.test(trimmed);
    const isHeading = /^#{1,6}\s/.test(trimmed);
    if (!fenced && isHeading && current.trim()) flush();
    current += line;
    if (isFence) fenced = !fenced;
    if (!fenced && /^\s*$/.test(line.replace(/\n$/, ""))) flush();
  });
  flush();
  return blocks;
}

/** 保留原顺序与空行，优先在结构块边界切分。 */
export function splitTranslationText(text: string, contextWindow?: number): TranslationChunk[] {
  if (text.length > TRANSLATION_MAX_CHARS) throw new Error(`单次翻译最多 ${TRANSLATION_MAX_CHARS.toLocaleString("zh-CN")} 个字符`);
  if (!text) return [];
  const maxChars = getTranslationChunkSize(contextWindow);
  const blocks = structuredBlocks(text).flatMap((block) => splitOversizedBlock(block, maxChars));
  const chunks: string[] = [];
  let current = "";
  blocks.forEach((block) => {
    if (current && current.length + block.length > maxChars) {
      chunks.push(current);
      current = "";
    }
    current += block;
  });
  if (current) chunks.push(current);
  return chunks.map((source, id) => ({ id, source }));
}

export type RunTranslationInput = {
  chunks: TranslationChunk[];
  translateChunk: (chunk: TranslationChunk, index: number, signal: AbortSignal) => Promise<string>;
  signal: AbortSignal;
  initialResults?: string[];
  startIndex?: number;
  onProgress?: (job: TranslationJob) => void;
};

/** 顺序翻译分块；失败或取消时返回可重试的部分结果。 */
export async function runTranslationChunks(input: RunTranslationInput): Promise<TranslationJob> {
  const results = [...(input.initialResults ?? [])];
  const startIndex = input.startIndex ?? results.length;
  for (let index = startIndex; index < input.chunks.length; index += 1) {
    const running: TranslationJob = { chunks: input.chunks, currentIndex: index, results: [...results], status: "running" };
    input.onProgress?.(running);
    if (input.signal.aborted) return { ...running, status: "cancelled" };
    try {
      const translated = await input.translateChunk(input.chunks[index]!, index, input.signal);
      if (input.signal.aborted) return { ...running, results: [...results], status: "cancelled" };
      results[index] = translated;
    } catch (error) {
      if (input.signal.aborted) return { ...running, results: [...results], status: "cancelled" };
      const failed: TranslationJob = {
        ...running,
        results: [...results],
        status: "failed",
        failedChunkIndex: index,
        error: error instanceof Error ? error.message : "翻译失败",
      };
      input.onProgress?.(failed);
      return failed;
    }
  }
  const completed: TranslationJob = { chunks: input.chunks, currentIndex: input.chunks.length, results, status: "completed" };
  input.onProgress?.(completed);
  return completed;
}

export function getTranslationExportFilename(sourceName: string | undefined, format: "txt" | "md"): string {
  const raw = sourceName?.trim() || "llmira-translation";
  const base = raw.replace(/\.[^.]+$/, "") || "llmira-translation";
  return `${base}-translated.${format}`;
}
