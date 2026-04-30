"use client";

/**
 * @project LLMira
 * @file src/components/artifacts/ArtifactsPanel.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-04-30
 * @function
 *   - 宽屏右侧预览助手消息中的代码/HTML 片段
 * @description 与 `GuideRail` 在 MainLayout 中互斥切换展示。
 */
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ListTree } from "lucide-react";

interface Props {
  content: string;
  open: boolean;
  onSwitchToGuide?: () => void;
}

/** `open` 为 false 时不渲染（不占布局）。 */
export function ArtifactsPanel({ content, open, onSwitchToGuide }: Props) {
  if (!open) return null;
  return (
    <aside className="hidden h-[100dvh] w-[360px] border-l bg-card xl:block">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <h3 className="text-sm font-semibold">Artifacts</h3>
        <div className="flex items-center gap-1.5">
          {onSwitchToGuide ? (
            <Button size="sm" variant="ghost" onClick={onSwitchToGuide}>
              <ListTree className="mr-1 h-3.5 w-3.5" />
              导览
            </Button>
          ) : null}
          <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(content)}>
            复制
          </Button>
        </div>
      </div>
      <ScrollArea className="h-[calc(100dvh-3rem)] p-3">
        <pre className="whitespace-pre-wrap break-words text-xs">{content}</pre>
      </ScrollArea>
    </aside>
  );
}
