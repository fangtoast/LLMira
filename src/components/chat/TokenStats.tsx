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
