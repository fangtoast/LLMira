"use client";

/**
 * @project LLMira
 * @file src/components/layout/PersonalRail.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @function 个人一级导航与独立设置入口
 * @description 桌面为图标功能栏，移动端为四项底部导航；团队不占一级入口。
 */
import Link from "next/link";
import { BotMessageSquare, Images, LibraryBig, MoreHorizontal, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export type PersonalSection = "chat" | "images" | "knowledge" | "more";

const entries = [
  { id: "chat" as const, href: "/chat", label: "对话", Icon: BotMessageSquare },
  { id: "images" as const, href: "/images", label: "图像", Icon: Images },
  { id: "knowledge" as const, href: "/knowledge", label: "知识库", Icon: LibraryBig },
  { id: "more" as const, href: "/more", label: "更多", Icon: MoreHorizontal },
];

/** 跨桌面与移动端复用的个人导航。 */
export function PersonalRail({ active }: { active: PersonalSection | "settings" }) {
  return (
    <>
      <nav aria-label="主要功能" className="hidden w-[72px] shrink-0 flex-col items-center border-r border-white/5 bg-[#111318] py-4 md:flex">
        <Link href="/chat" aria-label="LLMira 新对话" className="mb-8 grid size-10 place-items-center rounded-2xl bg-primary text-lg font-black text-primary-foreground shadow-lg shadow-primary/25">M</Link>
        <div className="flex flex-1 flex-col gap-2">
          {entries.map(({ id, href, label, Icon }) => (
            <Link key={id} href={href} aria-current={active === id ? "page" : undefined} className={cn("flex w-14 flex-col items-center gap-1 rounded-2xl py-2 text-[11px] text-zinc-500 transition hover:bg-white/5 hover:text-zinc-100", active === id && "bg-primary/15 text-primary") }>
              <Icon aria-hidden className="size-5" />{label}
            </Link>
          ))}
        </div>
        <Link href="/settings" aria-label="设置" className="grid size-10 place-items-center rounded-2xl text-zinc-500 transition hover:bg-white/5 hover:text-zinc-100"><Settings className="size-5" /></Link>
      </nav>
      <nav aria-label="主要功能" className="fixed inset-x-0 bottom-0 z-40 grid h-[calc(4.25rem+env(safe-area-inset-bottom))] grid-cols-4 border-t border-border/70 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        {entries.map(({ id, href, label, Icon }) => (
          <Link key={id} href={href} aria-current={active === id ? "page" : undefined} className={cn("flex flex-col items-center justify-center gap-1 text-[11px] text-muted-foreground", active === id && "text-primary") }>
            <Icon aria-hidden className="size-5" />{label}
          </Link>
        ))}
      </nav>
    </>
  );
}
