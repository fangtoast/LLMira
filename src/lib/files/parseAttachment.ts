/**
 * @project LLMira
 * @file src/lib/files/parseAttachment.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-05-12
 * @function
 *   - 将浏览器 File 解析为可持久化的聊天附件
 * @description 文本、PDF、docx 正文会写入 ChatAttachment，随后随消息保存到 IndexedDB。
 */
import type { ChatAttachment } from "@/types";
import { logger } from "@/lib/logger";
import {
  buildUnsupportedFormatMessage,
  getFileExtension,
  isDocx,
  isLegacyWordDoc,
  isPdfFile,
  isProbablyPlainText,
  legacyDocUnsupportedMessage,
} from "@/lib/files/attachmentFormat";

const TEXT_MAX_CHARS = 50000;
const PDF_MAX_CHARS = Number.POSITIVE_INFINITY;
const PDFJS_WORKER_CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.worker.min.mjs";

function uid() {
  return crypto.randomUUID();
}

function baseAttachment(file: File): Omit<ChatAttachment, "kind" | "status"> {
  return {
    id: `${file.name}-${file.lastModified}-${uid()}`,
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
  };
}

function truncateText(text: string) {
  return {
    textContent: text.slice(0, TEXT_MAX_CHARS),
    textTruncated: text.length > TEXT_MAX_CHARS,
    textCharCount: text.length,
  };
}

function truncateByLimit(text: string, maxChars: number) {
  if (!Number.isFinite(maxChars)) {
    return {
      textContent: text,
      textTruncated: false,
      textCharCount: text.length,
    };
  }
  return {
    textContent: text.slice(0, maxChars),
    textTruncated: text.length > maxChars,
    textCharCount: text.length,
  };
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function parsePdfText(file: File) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(await file.arrayBuffer());
  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN;
  const loadingParams = { data } as Parameters<typeof pdfjs.getDocument>[0];
  const documentTask = pdfjs.getDocument(loadingParams);
  const document = await documentTask.promise;
  const pages: string[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? String(item.str) : ""))
        .filter(Boolean)
        .join(" ");
      if (text.trim()) pages.push(`第 ${pageNumber} 页\n${text.trim()}`);
    }
  } finally {
    await document.destroy();
  }

  return pages.join("\n\n");
}

async function parseDocxPlainText(file: File): Promise<string> {
  const mammoth = await import("mammoth/mammoth.browser");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

function fallbackKindForCatch(file: File): ChatAttachment["kind"] {
  if (isPdfFile(file)) return "pdf";
  if (isDocx(file) || isProbablyPlainText(file)) return "text";
  return "unsupported";
}

/** 解析单个 File，并返回可随 ChatMessage 持久化的附件记录。 */
export async function parseAttachment(file: File): Promise<ChatAttachment> {
  const base = baseAttachment(file);

  try {
    if (file.type.startsWith("image/")) {
      return {
        ...base,
        kind: "image",
        status: "ready",
        dataUrl: await readFileAsDataUrl(file),
      };
    }

    if (isPdfFile(file)) {
      const text = await parsePdfText(file);
      const truncated = truncateByLimit(text, PDF_MAX_CHARS);
      return {
        ...base,
        kind: "pdf",
        status: "ready",
        ...truncated,
      };
    }

    if (isDocx(file)) {
      const raw = await parseDocxPlainText(file);
      return {
        ...base,
        kind: "text",
        status: "ready",
        ...truncateText(raw),
      };
    }

    if (isLegacyWordDoc(file)) {
      return {
        ...base,
        kind: "unsupported",
        status: "unsupported",
        errorMessage: legacyDocUnsupportedMessage(),
      };
    }

    if (isProbablyPlainText(file)) {
      const text = await readFileAsText(file);
      return {
        ...base,
        kind: "text",
        status: "ready",
        ...truncateText(text),
      };
    }

    return {
      ...base,
      kind: "unsupported",
      status: "unsupported",
      errorMessage: buildUnsupportedFormatMessage(file),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "文件内容读取失败";
    logger.exception(error, "parseAttachment failed", {
      fileName: file.name,
      mime: file.type || "",
      ext: getFileExtension(file.name),
    });
    return {
      ...base,
      kind: fallbackKindForCatch(file),
      status: "error",
      errorMessage: message,
    };
  }
}
