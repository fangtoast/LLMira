/**
 * @project LLMira
 * @file apps/worker/src/ingest.test.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-13
 * @function
 *   - 验证知识文本分块边界与重叠
 * @description 纯函数测试不访问对象存储或 Provider。
 */
import { describe, expect, it } from "vitest";
import { chunkText } from "./ingest.js";

describe("chunkText", () => {
  it("keeps content complete with bounded chunks", () => {
    const input = `${"架构建议。".repeat(150)}\n\n${"权限与审计。".repeat(150)}`;
    const chunks = chunkText(input, 400, 60);
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.every((chunk) => chunk.length <= 410)).toBe(true);
    expect(chunks[0]).toContain("架构建议");
    expect(chunks.at(-1)).toContain("权限与审计");
  });
});
