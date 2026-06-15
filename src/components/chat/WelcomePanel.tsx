"use client";

import { useEffect, useState } from "react";

/**
 * @project LLMira
 * @file src/components/chat/WelcomePanel.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-04-30
 * @function
 *   - 空会话居中提示语轮播
 * @description 新建会话首屏的极简标题，输入区由 `MainLayout` 居中装配；问候词在本地轻量轮播。
 */
const GREETING_PROMPTS = [
  "你今天在想些什么？",
  "今天想从哪里开始？",
  "有什么问题想一起拆开？",
  "要不要先写下一个想法？",
  "今天想推进哪件事？",
  "需要我帮你理一理吗？",
  "把问题丢过来，我们慢慢拆。",
  "现在最想解决什么？",
  "想写点什么，还是改点什么？",
  "给我一个线索就行。",
  "今天的第一步是什么？",
  "要不要把想法变成计划？",
  "有什么卡住的地方？",
  "从一个小问题开始吧。",
  "想聊科研、代码，还是生活？",
  "要不要一起做个判断？",
  "今天想变清楚的是什么？",
  "需要一个更好的表达吗？",
  "把草稿发来，我来帮你磨。",
  "想让答案更短，还是更深？",
  "现在要做创作还是排错？",
  "要不要先列几个选项？",
  "我在，直接问。",
  "想把哪件事做顺一点？",
  "今天要写哪一页？",
  "要不要先搭个框架？",
  "把目标说给我听。",
  "我们从最重要的一点开始。",
  "有什么需要快速验证？",
  "今天想要一个灵感吗？",
  "想做总结、翻译，还是推演？",
  "把复杂的事交给我一起拆。",
  "需要我当你的第二大脑吗？",
  "想让这件事更漂亮一点吗？",
  "今天想探索哪个方向？",
  "要不要把零散想法收束一下？",
  "你想问什么都可以。",
  "从一句话开始也行。",
  "现在最值得做的小步是什么？",
  "需要我帮你找漏洞吗？",
  "要不要先生成一个版本？",
  "想要严谨一点，还是轻松一点？",
  "今天准备攻克哪块硬骨头？",
  "把上下文给我，我们开工。",
  "想要建议，还是直接实现？",
  "今天想让什么变得简单？",
  "要不要一起把它讲清楚？",
  "现在脑子里最吵的是什么？",
  "需要我帮你压缩成重点吗？",
  "想把想法落到文件里吗？",
  "我们先抓住主线。",
  "来，把问题交给我。",
] as const;

/** 无消息时的欢迎区。 */
export function WelcomePanel() {
  const [promptIndex, setPromptIndex] = useState(0);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setPromptIndex((index) => (index + 1) % GREETING_PROMPTS.length);
    }, 3600);

    return () => window.clearInterval(intervalId);
  }, []);

  const prompt = GREETING_PROMPTS[promptIndex];

  return (
    <div className="mx-auto w-full max-w-4xl px-2 text-center">
      <div className="flex min-h-[3.4rem] items-center justify-center overflow-hidden sm:min-h-[4rem]">
        <h2
          key={prompt}
          aria-live="off"
          className="llmira-greeting-roll text-2xl font-semibold leading-tight tracking-normal text-foreground sm:text-[2rem] dark:text-zinc-100"
        >
          {prompt}
        </h2>
      </div>
    </div>
  );
}
