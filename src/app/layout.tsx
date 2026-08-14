/**
 * @project LLMira
 * @file src/app/layout.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-13
 * @function
 *   - 提供 HTML、字体、主题和应用元数据
 * @description App Router 根布局；默认深色并保留同构浅色主题。
 */
import type { Metadata, Viewport } from "next";
import "./globals.css";
import "katex/dist/katex.min.css";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { BRAND_ICON_PATH, BRAND_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: BRAND_NAME,
  description: `${BRAND_NAME} 个人多模型 AI 客户端`,
  icons: {
    icon: BRAND_ICON_PATH,
    shortcut: BRAND_ICON_PATH,
    apple: BRAND_ICON_PATH,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

/** 应用根布局：字体与明暗主题。 */
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full font-sans">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
