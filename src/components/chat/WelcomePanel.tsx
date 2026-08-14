"use client";

/**
 * @project LLMira
 * @file src/components/chat/WelcomePanel.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @description 个人对话与生图的稳定首屏文案，避免轮播造成视觉位移。
 */
import { ImageIcon, MessageCircleMore } from "lucide-react";

export function WelcomePanel({ mode = "chat" }: { mode?: "chat" | "image" }) {
  const Icon = mode === "image" ? ImageIcon : MessageCircleMore;
  return (
    <div className="mx-auto w-full max-w-4xl px-3 text-center">
      <span className="mx-auto mb-5 grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary"><Icon className="size-6" /></span>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{mode === "image" ? "把想法变成画面" : "今天想聊点什么？"}</h1>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted-foreground">{mode === "image" ? "选择支持生图的 Provider 模型，输入提示词即可生成并下载。" : "同一会话会携带完整上下文；切换模型后，新模型仍能继续这段对话。"}</p>
    </div>
  );
}
