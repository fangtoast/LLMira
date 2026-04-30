"use client";

/**
 * @project LLMira
 * @file src/components/markdown/MarkdownRenderer.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-04-30
 * @function
 *   - Markdown + KaTeX；代码块委托 `CodeBlock`
 * @description `urlTransform` 限制危险协议，减轻 XSS 面。
 */
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { CodeBlock } from "./CodeBlock";
import { cn } from "@/lib/utils";

interface Props {
  content: string;
  className?: string;
}

/** 助手正文渲染入口。 */
export function MarkdownRenderer({ content, className }: Props) {
  const safeUrlTransform = (url: string) => {
    const value = url.trim();
    if (/^data:image\//i.test(value)) return value;
    if (/^https?:\/\//i.test(value)) return value;
    if (/^\//.test(value)) return value;
    return "";
  };

  return (
    <div
      className={cn(
        "prose prose-zinc dark:prose-invert max-w-none text-sm",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        urlTransform={safeUrlTransform}
        components={{
          code(props) {
            const { children, className } = props;
            const match = /language-(\w+)/.exec(className || "");
            const value = String(children).replace(/\n$/, "");
            if (match) return <CodeBlock code={value} language={match[1]} />;
            return <code className="rounded bg-muted px-1 py-0.5">{children}</code>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
