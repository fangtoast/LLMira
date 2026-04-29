"use client";

import { useEffect, useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

import "prismjs/themes/prism-tomorrow.css";

interface Props {
  code: string;
  language: string;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function CodeBlock({ code, language }: Props) {
  const [copied, setCopied] = useState(false);
  const [html, setHtml] = useState(() => escapeHtml(code));

  useEffect(() => {
    setHtml(escapeHtml(code));
    let cancelled = false;

    void (async () => {
      try {
        const mod = await import("prismjs");
        const Prism = mod.default ?? mod;
        await import("prismjs/components/prism-javascript");
        await import("prismjs/components/prism-typescript");
        await import("prismjs/components/prism-json");
        await import("prismjs/components/prism-bash");
        if (cancelled) return;

        const lang = Prism.languages[language] ?? Prism.languages.javascript;
        if (!lang) {
          setHtml(escapeHtml(code));
          return;
        }
        setHtml(Prism.highlight(code, lang, language || "javascript"));
      } catch {
        if (!cancelled) setHtml(escapeHtml(code));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code, language]);

  const lineCount = (code.match(/\n/g) ?? []).length + 1;
  const isLong = lineCount > 25;
  const block = (
    <div className={isLong ? "relative overflow-hidden" : "relative my-4 overflow-hidden rounded-lg border"}>
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 z-10 h-8 w-8"
        onClick={async () => {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
      <div className="max-h-[min(70vh,28rem)] max-w-full overflow-y-auto overflow-x-auto">
        <pre className="p-3 text-sm">
          <code dangerouslySetInnerHTML={{ __html: html }} />
        </pre>
      </div>
    </div>
  );

  if (!isLong) return block;

  return (
    <details className="group/cb my-4 rounded-lg border" open>
      <summary className="cursor-pointer list-none border-b bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground marker:content-none">
        代码 {lineCount} 行（点击折叠 / 展开）
      </summary>
      <div className="border-t-0">{block}</div>
    </details>
  );
}
