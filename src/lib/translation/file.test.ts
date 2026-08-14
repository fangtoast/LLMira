/**
 * @project LLMira
 * @file src/lib/translation/file.test.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @description 翻译文件类型支持范围测试。
 */
import { describe, expect, it } from "vitest";
import { isTranslationFileSupported, readTranslationFile } from "./file";

describe("translation file support", () => {
  it("接受文本与 Markdown，拒绝图片和旧版 doc", async () => {
    expect(isTranslationFileSupported(new File(["hello"], "hello.md", { type: "text/markdown" }))).toBe(true);
    expect(isTranslationFileSupported(new File(["x"], "scan.png", { type: "image/png" }))).toBe(false);
    await expect(readTranslationFile(new File(["x"], "legacy.doc", { type: "application/msword" }))).rejects.toThrow(/不支持旧版/);
  });
});
