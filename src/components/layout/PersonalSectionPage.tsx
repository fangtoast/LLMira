/**
 * @project LLMira
 * @file src/components/layout/PersonalSectionPage.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @description 个人扩展页的轻量响应式壳层。
 */
import Link from "next/link";
import { ArrowRight, Settings } from "lucide-react";
import type { ReactNode } from "react";
import { PersonalRail, type PersonalSection } from "./PersonalRail";

export function PersonalSectionPage({ active, eyebrow, title, description, actionHref, actionLabel, children }: { active: PersonalSection; eyebrow: string; title: string; description: string; actionHref?: string; actionLabel?: string; children?: ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-background text-foreground">
      <PersonalRail active={active} />
      <main className="min-w-0 flex-1 px-5 pb-28 pt-6 md:px-10 md:pb-10 md:pt-9">
        <div className="mx-auto max-w-5xl">
          <div className="flex justify-end"><Link href="/settings" className="inline-flex size-10 items-center justify-center rounded-full border border-border/70 text-muted-foreground hover:text-foreground" aria-label="设置"><Settings className="size-4" /></Link></div>
          <section className="py-10 md:py-20">
            <p className="text-sm font-medium text-primary">{eyebrow}</p>
            <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-muted-foreground">{description}</p>
            {actionHref && actionLabel ? <Link href={actionHref} className="mt-7 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">{actionLabel}<ArrowRight className="size-4" /></Link> : null}
          </section>
          {children}
        </div>
      </main>
    </div>
  );
}
