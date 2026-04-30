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

/** 根级明暗主题 Provider。 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}
