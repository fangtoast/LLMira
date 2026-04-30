"use client";

/**
 * @project LLMira
 * @file src/hooks/useMediaQuery.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-04-30
 * @function
 *   - 匹配 Tailwind `md`（768px）断点
 * @description 首帧 `false` 避免 SSR/CSR 不一致；用于侧栏抽屉与桌面布局切换。
 */
import { useLayoutEffect, useState } from "react";

/** @returns 视口是否大于等于 `md` */
export function useIsMdUp(): boolean {
  const [matches, setMatches] = useState(false);
  useLayoutEffect(() => {
    const m = window.matchMedia("(min-width: 768px)");
    setMatches(m.matches);
    const onChange = () => setMatches(m.matches);
    m.addEventListener("change", onChange);
    return () => m.removeEventListener("change", onChange);
  }, []);
  return matches;
}
