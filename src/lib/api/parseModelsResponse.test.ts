/**
 * @project LLMira
 * @file src/lib/api/parseModelsResponse.test.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @description 验证模型扫描同时保留上游元数据与旧式 ID 兼容格式。
 */
import { describe, expect, it } from "vitest";
import { extractModelIdsFromResponse, extractModelsFromResponse } from "./parseModelsResponse";

describe("model response parsing", () => {
  it("保留模型名称、所有者、上下文窗口和上游能力", () => {
    const models = extractModelsFromResponse({ data: [{
      id: "claude-demo",
      name: "Claude Demo",
      owned_by: "anthropic",
      context_window: 200000,
      supports_chat: true,
      supports_reasoning: true,
    }] }, "provider-a");

    expect(models).toEqual([expect.objectContaining({
      providerId: "provider-a",
      id: "claude-demo",
      name: "Claude Demo",
      ownedBy: "anthropic",
      contextWindow: 200000,
      source: "upstream",
      capabilities: expect.objectContaining({ chat: true, reasoning: true }),
    })]);
  });

  it("兼容仅返回字符串或嵌套列表的旧扫描响应", () => {
    const response = { data: { models: ["gpt-5", { model_id: "deepseek-r1" }] } };
    expect(extractModelIdsFromResponse(response)).toEqual(["gpt-5", "deepseek-r1"]);
    expect(extractModelsFromResponse(response, "provider-b").map((model) => model.id)).toEqual(["gpt-5", "deepseek-r1"]);
  });
});
