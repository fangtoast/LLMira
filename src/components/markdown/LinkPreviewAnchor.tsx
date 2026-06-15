"use client";

/**
 * @project LLMira
 * @file src/components/markdown/LinkPreviewAnchor.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-06-15
 * @function
 *   - Markdown 外链安全跳转
 *   - 鼠标悬停 / 键盘聚焦时展示沙盒网页预览
 * @description 预览只在浏览器端使用 sandbox iframe；不做代理抓取，避免引入额外隐私与服务端风险。
 */
import { useRef, useState, type AnchorHTMLAttributes, type ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

type PreviewPosition = {
  left: number;
  top: number;
};

type LinkPreviewAnchorProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href?: string;
  children: ReactNode;
};

function isExternalHttpUrl(value: string | undefined): value is string {
  return Boolean(value && /^https?:\/\//i.test(value));
}

function getDisplayHost(href: string) {
  try {
    return new URL(href).host;
  } catch {
    return href;
  }
}

/** Markdown 链接：外链 hover/focus 预览，点击安全新标签打开。 */
export function LinkPreviewAnchor({ href, children, className, ...props }: LinkPreviewAnchorProps) {
  const anchorRef = useRef<HTMLAnchorElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<PreviewPosition>({ left: 16, top: 16 });
  const external = isExternalHttpUrl(href);

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const openPreview = () => {
    if (!external || !anchorRef.current) return;
    clearCloseTimer();
    const rect = anchorRef.current.getBoundingClientRect();
    const width = Math.min(360, window.innerWidth - 24);
    const left = Math.min(Math.max(12, rect.left), Math.max(12, window.innerWidth - width - 12));
    const belowTop = rect.bottom + 10;
    const top = belowTop + 260 > window.innerHeight ? Math.max(12, rect.top - 270) : belowTop;
    setPosition({ left, top });
    setOpen(true);
  };

  const scheduleClose = () => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => setOpen(false), 140);
  };

  if (!external) {
    return (
      <a href={href} className={className} {...props}>
        {children}
      </a>
    );
  }

  return (
    <>
      <a
        ref={anchorRef}
        href={href}
        className={cn("underline decoration-border underline-offset-4 transition-colors hover:text-primary", className)}
        target="_blank"
        rel="noopener noreferrer"
        onMouseEnter={openPreview}
        onMouseLeave={scheduleClose}
        onFocus={openPreview}
        onBlur={scheduleClose}
        {...props}
      >
        {children}
      </a>
      {open ? (
        <div
          className="llmira-soft-pop fixed z-50 w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-xl border border-border/70 bg-card/95 text-card-foreground shadow-2xl shadow-black/25 backdrop-blur-xl"
          style={{ left: position.left, top: position.top }}
          onMouseEnter={clearCloseTimer}
          onMouseLeave={scheduleClose}
        >
          <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
            <div className="min-w-0">
              <div className="truncate text-xs font-medium">{getDisplayHost(href)}</div>
              <div className="truncate text-[11px] text-muted-foreground">{href}</div>
            </div>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground"
              aria-label="打开链接"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
          <div className="h-44 bg-background">
            <iframe
              title={`预览 ${getDisplayHost(href)}`}
              src={href}
              sandbox=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className="h-full w-full border-0 bg-background"
            />
          </div>
          <div className="px-3 py-2 text-[11px] leading-5 text-muted-foreground">
            若页面禁止嵌入，点击右上角图标或链接正文会在新标签打开。
          </div>
        </div>
      ) : null}
    </>
  );
}
