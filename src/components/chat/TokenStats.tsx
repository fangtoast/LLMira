/**
 * @project LLMira
 * @file src/components/chat/TokenStats.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-04-30
 * @description 展示最近一次补全的 token 用量（无数据则不渲染）。
 */
import type { TokenUsage } from "@/types";

export function TokenStats({ usage }: { usage?: TokenUsage }) {
  if (!usage) return null;
  return (
    <div className="px-2 pb-2 text-xs text-muted-foreground">
      Tokens: {usage.totalTokens.toLocaleString()}（输入 {usage.promptTokens.toLocaleString()}
      {usage.cachedPromptTokens ? ` / 缓存 ${usage.cachedPromptTokens.toLocaleString()}` : ""} / 输出 {usage.completionTokens.toLocaleString()}
      {usage.reasoningTokens ? ` / 推理 ${usage.reasoningTokens.toLocaleString()}` : ""}）
      {usage.requestCount && usage.requestCount > 1 ? ` · ${usage.requestCount} 次模型请求` : ""}
      {usage.estimatedCostUSD !== undefined ? ` · $${usage.estimatedCostUSD.toFixed(6)}` : " · 费用未知"}
    </div>
  );
}
