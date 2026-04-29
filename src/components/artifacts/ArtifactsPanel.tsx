"use client";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ListTree } from "lucide-react";

interface Props {
  content: string;
  open: boolean;
  onSwitchToGuide?: () => void;
}

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
