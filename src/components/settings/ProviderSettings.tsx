"use client";

/**
 * @project LLMira
 * @file src/components/settings/ProviderSettings.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @description 个人 Provider 独立设置页面。
 */
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { PersonalRail } from "@/components/layout/PersonalRail";
import { ProviderSetupForm } from "./ProviderSetupForm";
import { SearchSettings } from "./SearchSettings";

export function ProviderSettings() {
  return <div className="flex min-h-dvh bg-background text-foreground"><PersonalRail active="settings" /><main className="min-w-0 flex-1 px-5 pb-28 pt-6 md:px-10 md:pb-12"><div className="mx-auto max-w-5xl"><Link href="/chat" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />返回对话</Link><header className="pb-8 pt-10"><div className="flex items-center gap-2 text-sm font-medium text-primary"><ShieldCheck className="size-4" />密钥不会写入浏览器持久化存储</div><h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Provider 与模型</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">填写 OpenAI-compatible API Host 与 Key，真实扫描 `/v1/models` 后再选择默认模型。相同模型名通过 Provider ID 隔离。</p></header><ProviderSetupForm /><SearchSettings /></div></main></div>;
}
