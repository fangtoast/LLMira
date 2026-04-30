/**
 * @project LLMira
 * @file src/components/ui/dialog.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-04-30
 * @description 轻量受控 Dialog（Context + 遮罩），非 Radix 完整封装。
 */
import * as React from "react";
import { cn } from "@/lib/utils";

type DialogCtx = { open: boolean; onOpenChange: (v: boolean) => void };
const DialogContext = React.createContext<DialogCtx | null>(null);

export function Dialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return <DialogContext.Provider value={{ open, onOpenChange }}>{children}</DialogContext.Provider>;
}

export function DialogContent({ className, children }: { className?: string; children: React.ReactNode }) {
  const ctx = React.useContext(DialogContext);
  if (!ctx?.open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={() => ctx.onOpenChange(false)}
    >
      <div
        className={cn("w-full max-w-lg rounded-lg border bg-card p-6", className)}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>
  );
}
