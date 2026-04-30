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
      Tokens: {usage.totalTokens} (Prompt {usage.promptTokens} / Completion {usage.completionTokens})
      {usage.estimatedCostUSD ? ` · $${usage.estimatedCostUSD}` : ""}
    </div>
  );
}
