/**
 * @project LLMira
 * @file src/lib/api/toolCalls.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @function 合并 OpenAI-compatible SSE 中被拆分的工具调用增量
 * @description 仅处理协议片段，不执行工具，也不记录参数。
 */
import type { ChatToolCallDelta, ChatToolCallWire } from "@/lib/api/types";

export function mergeToolCallDelta(
  calls: Map<number, ChatToolCallWire>,
  delta: ChatToolCallDelta,
): ChatToolCallWire {
  const current = calls.get(delta.index) ?? {
    id: delta.id ?? `tool-call-${delta.index}`,
    type: "function" as const,
    function: { name: "", arguments: "" },
  };
  const next: ChatToolCallWire = {
    id: delta.id || current.id,
    type: "function",
    function: {
      name: `${current.function.name}${delta.function?.name ?? ""}`,
      arguments: `${current.function.arguments}${delta.function?.arguments ?? ""}`,
    },
  };
  calls.set(delta.index, next);
  return next;
}

export function parseToolArguments(text: string): Record<string, unknown> {
  if (!text.trim()) return {};
  const parsed: unknown = JSON.parse(text);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("工具参数必须是 JSON 对象");
  }
  return parsed as Record<string, unknown>;
}
