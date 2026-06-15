"use client";

/**
 * @project LLMira
 * @file src/components/chat/WelcomePanel.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-04-30
 * @function
 *   - 空会话居中提示语
 * @description 新建会话首屏的极简标题，输入区由 `MainLayout` 居中装配。
 */
/** 无消息时的欢迎区。 */
export function WelcomePanel() {
  return (
    <div className="mx-auto w-full max-w-4xl px-2 text-center">
      <h2 className="text-2xl font-semibold tracking-normal text-foreground sm:text-[2rem] dark:text-zinc-100">
        你今天在想些什么？
      </h2>
    </div>
  );
}
