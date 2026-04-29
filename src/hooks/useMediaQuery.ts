"use client";

import { useLayoutEffect, useState } from "react";

/** 与 Tailwind `md` 断点 (768px) 对齐。首帧默认 false，避免与 SSR 不一致。 */
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
