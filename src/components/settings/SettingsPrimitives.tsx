/**
 * @project LLMira
 * @file src/components/settings/SettingsPrimitives.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @function 设置详情区的统一标题、卡片与行布局
 * @description 保持桌面三栏与移动单列中的信息密度、边框和焦点行为一致。
 */
import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function SettingsPageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border/70 pb-5">
      <div className="grid gap-1.5">
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{title}</h1>
        {description ? <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p> : null}
      </div>
      {actions}
    </header>
  );
}
export function SettingsCard({ title, description, children, className }: { title: string; description?: string; children: ReactNode; className?: string }) {
  return (
    <Card className={cn("rounded-xl border-border/70 bg-card/55 shadow-none", className)}>
      <CardHeader className="border-b border-border/60 px-5 py-4">
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <CardDescription className="leading-5">{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="grid gap-4 px-5 py-5">{children}</CardContent>
    </Card>
  );
}

export function SettingsRow({ title, description, control, className }: { title: string; description?: string; control: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-h-12 flex-wrap items-center justify-between gap-4 border-b border-border/55 py-3 last:border-b-0", className)}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        {description ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p> : null}
      </div>
      <div className="min-w-[10rem] max-w-full">{control}</div>
    </div>
  );
}
