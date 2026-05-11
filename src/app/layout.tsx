/**
 * @project LLMira
 * @file src/app/layout.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-04-30
 * @function
 *   - 根 HTML、字体、主题提供者
 * @description App Router 根布局；元数据引用 `@/lib/brand`。
 */
import type { Metadata, Viewport } from "next";
import "./globals.css";
import "katex/dist/katex.min.css";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { BRAND_ICON_PATH, BRAND_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: BRAND_NAME,
  description: `${BRAND_NAME} AI 应用`,
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

/** 应用根布局：字体变量与明暗主题。 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <body className="min-h-full font-sans">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
