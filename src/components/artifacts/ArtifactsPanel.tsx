"use client";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  content: string;
  open: boolean;
}

export function ArtifactsPanel({ content, open }: Props) {
  if (!open) return null;
  return (
    <aside className="hidden w-[360px] border-l bg-card xl:block">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <h3 className="text-sm font-semibold">Artifacts</h3>
        <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(content)}>
          复制
        </Button>
      </div>
      <ScrollArea className="h-[calc(100vh-3rem)] p-3">
        <pre className="whitespace-pre-wrap break-words text-xs">{content}</pre>
      </ScrollArea>
    </aside>
  );
}
