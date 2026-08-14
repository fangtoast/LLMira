"use client";

/**
 * @project LLMira
 * @file src/components/settings/ProviderSettings.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @description 兼容旧导入路径，统一转发到三栏个人设置中心。
 */
import { useSyncExternalStore } from "react";
import { PersonalSettingsShell } from "./PersonalSettingsShell";
import { Skeleton } from "@/components/ui/skeleton";

export function ProviderSettings() {
  const mounted = useSyncExternalStore(() => () => undefined, () => true, () => false);
  if (!mounted) return <div className="grid min-h-dvh grid-cols-[72px_260px_300px_1fr] bg-background"><Skeleton className="col-span-1 rounded-none" /><Skeleton className="col-span-1 rounded-none" /><Skeleton className="col-span-1 rounded-none" /><div className="grid content-start gap-5 p-10"><Skeleton className="h-10 w-64" /><Skeleton className="h-52 w-full" /></div></div>;
  return <PersonalSettingsShell />;
}
