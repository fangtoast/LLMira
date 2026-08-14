/**
 * @project LLMira
 * @file src/lib/chat/buildMessages.test.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @description 验证跨模型上下文与长会话裁剪不使用 RAG。
 */
import { describe, expect, it } from "vitest";
import { assembleConversationHistory, buildApiMessagesFromChat } from "./buildMessages";
import type { ChatMessage } from "@/types";

const message = (id: string, role: ChatMessage["role"], content: string, modelName?: string): ChatMessage => ({ id, role, content, modelName, createdAt: Number(id.replace(/\D/g, "")) || 1, status: "completed" });

describe("personal conversation context", () => {
  it("sends the GPT answer to Claude after switching models", () => {
    const history = [message("1", "user", "第一问"), message("2", "assistant", "GPT 的回答", "gpt-demo")];
    const payload = buildApiMessagesFromChat(history, "请继续");
    expect(payload).toEqual([{ role: "user", content: "第一问" }, { role: "assistant", content: "GPT 的回答" }, { role: "user", content: "请继续" }]);
  });

  it("excludes failed empty replies and summarizes old complete turns", () => {
    const history = Array.from({ length: 30 }, (_, index) => message(String(index + 1), index % 2 ? "assistant" : "user", `第 ${index + 1} 条 ${"内容".repeat(200)}`));
    history.splice(2, 0, { ...message("99", "assistant", ""), status: "failed" });
    const assembled = assembleConversationHistory(history, 1500);
    expect(assembled.trimmed).toBe(true);
    expect(assembled.summary).toContain("滚动摘要");
    expect(assembled.history.some((item) => item.id === "99")).toBe(false);
  });

  it("重放已持久化的工具请求、结果和最终回答", () => {
    const assistant = message("2", "assistant", "天气晴朗");
    assistant.toolCalls = [{
      id: "call-1", wireName: "mcp_weather_abc1234", serverId: "weather", serverName: "天气服务",
      toolName: "forecast", argumentsText: "{\"city\":\"长沙\"}", arguments: { city: "长沙" },
      approval: "approved", status: "completed", resultSummary: "晴，25°C",
    }];
    const payload = buildApiMessagesFromChat([message("1", "user", "长沙天气"), assistant], "要带伞吗");
    expect(payload).toContainEqual(expect.objectContaining({ role: "assistant", content: null, tool_calls: expect.any(Array) }));
    expect(payload).toContainEqual(expect.objectContaining({ role: "tool", tool_call_id: "call-1", content: "晴，25°C" }));
    expect(payload).toContainEqual({ role: "assistant", content: "天气晴朗" });
  });
});
