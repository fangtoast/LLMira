"use client";

import { useEffect, useRef, useState } from "react";
import { AppWindow, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type GuideItem = {
  id: string;
  title: string;
};

interface GuideRailProps {
  items: GuideItem[];
  activeId: string | null;
  onJump: (id: string) => void;
  onSwitchToArtifacts: () => void;
}

export function GuideRail({ items, activeId, onJump, onSwitchToArtifacts }: GuideRailProps) {
  const [expanded, setExpanded] = useState(false);
  const leaveTimerRef = useRef<number | null>(null);

  const clearLeaveTimer = () => {
    if (leaveTimerRef.current) {
      window.clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  };

  const handleEnter = () => {
    clearLeaveTimer();
    setExpanded(true);
  };

  const handleLeave = () => {
    clearLeaveTimer();
    leaveTimerRef.current = window.setTimeout(() => setExpanded(false), 120);
  };

  useEffect(() => () => clearLeaveTimer(), []);

  return (
    <aside className="hidden h-[100dvh] w-[88px] shrink-0 items-center justify-center border-l bg-card/55 xl:flex">
      <div className="relative flex h-[70%] min-h-[320px] items-center">
        <div
          className="group relative flex h-full items-center justify-end"
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
        >
          <div className="relative mr-3 h-[85%] w-5">
            <div className="absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2 rounded-full bg-zinc-300/55 dark:bg-zinc-700/70" />
            <div className="absolute left-1/2 top-0 flex h-full -translate-x-1/2 flex-col items-center justify-evenly">
              {items.slice(0, 10).map((item) => {
                const isActive = item.id === activeId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-label={`定位到: ${item.title}`}
                    onClick={() => onJump(item.id)}
                    className={cn(
                      "h-2.5 w-2.5 rounded-full border transition-all",
                      isActive
                        ? "border-blue-400 bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]"
                        : "border-zinc-400 bg-zinc-500/50 hover:border-blue-300 hover:bg-blue-400/80",
                    )}
                  />
                );
              })}
            </div>
          </div>

          <div
            className={cn(
              "absolute right-10 top-1/2 w-[280px] -translate-y-1/2 rounded-xl border bg-card/95 p-3 shadow-xl backdrop-blur transition-all",
              expanded ? "pointer-events-auto translate-x-0 opacity-100" : "pointer-events-none translate-x-2 opacity-0",
            )}
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Map className="h-3.5 w-3.5" />
                提问导览
              </div>
              <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onSwitchToArtifacts}>
                <AppWindow className="mr-1 h-3.5 w-3.5" />
                Artifacts
              </Button>
            </div>

            <div className="max-h-[56dvh] space-y-1 overflow-auto pr-1">
              {items.length === 0 ? (
                <p className="rounded-md border border-dashed px-2 py-3 text-xs text-muted-foreground">暂无可导览的提问</p>
              ) : (
                items.map((item) => {
                  const isActive = item.id === activeId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onJump(item.id)}
                      className={cn(
                        "w-full rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                        isActive
                          ? "bg-blue-500/15 text-blue-600 dark:text-blue-300"
                          : "text-foreground/85 hover:bg-accent hover:text-foreground",
                      )}
                      title={item.title}
                    >
                      {item.title}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
