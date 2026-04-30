"use client";

/**
 * @project LLMira
 * @file src/components/chat/StreamingText.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-04-30
 * @description 逐字展示动画（演示用）；与真实 SSE 流独立。
 */
import { useEffect, useState } from "react";

interface Props {
  text: string;
}

export function StreamingText({ text }: Props) {
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    let i = 0;
    setDisplayed("");
    const timer = setInterval(() => {
      i += Math.max(1, Math.floor(text.length / 120));
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [text]);

  return <>{displayed}</>;
}
