"use client";

/**
 * @project LLMira
 * @file src/components/providers/ThemeProvider.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-04-30
 * @description next-themes 封装：`class` 策略与默认深色。
 */
import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

function AccentSync() {
  React.useEffect(() => {
    const applyPersistedAccent = () => {
      try {
        const persisted = JSON.parse(window.localStorage.getItem("huiyan-settings") ?? "{}") as {
          state?: { accentTheme?: string };
        };
        document.documentElement.dataset.accent = persisted.state?.accentTheme ?? "blue";
      } catch {
        document.documentElement.dataset.accent = "blue";
      }
    };
    applyPersistedAccent();
    window.addEventListener("storage", applyPersistedAccent);
    window.addEventListener("llmira-accent", applyPersistedAccent);
    return () => {
      window.removeEventListener("storage", applyPersistedAccent);
      window.removeEventListener("llmira-accent", applyPersistedAccent);
    };
  }, []);
  return null;
}

/** 根级明暗主题 Provider。 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <AccentSync />
      {children}
    </NextThemesProvider>
  );
}
