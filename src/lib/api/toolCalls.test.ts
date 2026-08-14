/**
 * @project LLMira
 * @file src/lib/api/toolCalls.test.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @description OpenAI-compatible 分片工具调用解析测试。
 */
import { describe, expect, it } from "vitest";
import { mergeToolCallDelta, parseToolArguments } from "./toolCalls";
import type { ChatToolCallWire } from "./types";

describe("tool call delta parser", () => {
  it("按 index 合并名称和参数分片", () => {
    const calls = new Map<number, ChatToolCallWire>();
    mergeToolCallDelta(calls, { index: 0, id: "call-1", function: { name: "mcp_weather_", arguments: "{\"city\":" } });
    mergeToolCallDelta(calls, { index: 0, function: { name: "abc1234", arguments: "\"长沙\"}" } });
    expect(calls.get(0)).toEqual({ id: "call-1", type: "function", function: { name: "mcp_weather_abc1234", arguments: "{\"city\":\"长沙\"}" } });
    expect(parseToolArguments(calls.get(0)!.function.arguments)).toEqual({ city: "长沙" });
  });

  it("拒绝非对象参数", () => expect(() => parseToolArguments("[]")).toThrow("JSON 对象"));
});
