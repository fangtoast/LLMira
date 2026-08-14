/**
 * @project LLMira
 * @file src/lib/translation/core.test.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @description 翻译分块、顺序执行、停止、失败重试与导出命名测试。
 */
import { describe, expect, it } from "vitest";
import { getTranslationExportFilename, runTranslationChunks, splitTranslationText, TRANSLATION_MAX_CHARS } from "./core";

describe("translation core", () => {
  it("按 Markdown 结构分块并保持原顺序与空行", () => {
    const source = "# 标题\n\n第一段。\n\n```ts\nconst a = 1;\n\nconst b = 2;\n```\n";
    const chunks = splitTranslationText(source, 2048);
    expect(chunks.map((chunk) => chunk.source).join("")).toBe(source);
  });

  it("拒绝超过 200,000 字符的任务", () => {
    expect(() => splitTranslationText("a".repeat(TRANSLATION_MAX_CHARS + 1))).toThrow(/200,000/);
  });

  it("顺序合并并在停止时保留已完成结果", async () => {
    const chunks = [{ id: 0, source: "a\n\n" }, { id: 1, source: "b\n\n" }, { id: 2, source: "c" }];
    const controller = new AbortController();
    const job = await runTranslationChunks({
      chunks,
      signal: controller.signal,
      translateChunk: async (chunk, index) => {
        if (index === 1) controller.abort();
        return chunk.source.toUpperCase();
      },
    });
    expect(job.status).toBe("cancelled");
    expect(job.results[0]).toBeDefined();
  });

  it("从失败段重试而不重跑已完成段", async () => {
    const chunks = [{ id: 0, source: "a" }, { id: 1, source: "b" }];
    const failed = await runTranslationChunks({ chunks, signal: new AbortController().signal, translateChunk: async (_chunk, index) => { if (index === 1) throw new Error("boom"); return "A"; } });
    expect(failed.failedChunkIndex).toBe(1);
    const retried = await runTranslationChunks({ chunks, signal: new AbortController().signal, initialResults: failed.results, startIndex: failed.failedChunkIndex, translateChunk: async () => "B" });
    expect(retried.results).toEqual(["A", "B"]);
  });

  it("按来源生成 TXT 与 Markdown 文件名", () => {
    expect(getTranslationExportFilename("notes.md", "md")).toBe("notes-translated.md");
    expect(getTranslationExportFilename("brief.docx", "txt")).toBe("brief-translated.txt");
  });
});
