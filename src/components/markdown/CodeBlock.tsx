"use client";

import { useMemo, useState } from "react";
import { Copy, Check } from "lucide-react";
import Prism from "prismjs";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-json";
import "prismjs/components/prism-bash";
import "prismjs/themes/prism-tomorrow.css";
import { Button } from "@/components/ui/button";

interface Props {
  code: string;
  language: string;
}

export function CodeBlock({ code, language }: Props) {
  const [copied, setCopied] = useState(false);
  const html = useMemo(() => {
    const lang = Prism.languages[language] ?? Prism.languages.javascript;
    return Prism.highlight(code, lang, language || "javascript");
  }, [code, language]);

  return (
    <div className="relative my-4 overflow-hidden rounded-lg border">
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
      <pre className="max-w-full overflow-x-auto p-3 text-sm">
        <code dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
    </div>
  );
}
