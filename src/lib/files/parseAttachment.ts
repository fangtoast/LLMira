/**
 * @project LLMira
 * @file src/lib/files/parseAttachment.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-05-11
 * @function
 *   - 将浏览器 File 解析为可持久化的聊天附件
 * @description 文本与 PDF 正文会写入 ChatAttachment，随后随消息保存到 IndexedDB。
 */
import type { ChatAttachment } from "@/types";

const TEXT_MAX_CHARS = 50000;
const TEXT_FILE_EXTENSIONS = new Set(["txt", "md", "csv", "json"]);

function uid() {
  return crypto.randomUUID();
}

function getFileExtension(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function baseAttachment(file: File): Omit<ChatAttachment, "kind" | "status"> {
  return {
    id: `${file.name}-${file.lastModified}-${uid()}`,
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
  };
}

function isPdfFile(file: File) {
  return file.type === "application/pdf" || getFileExtension(file.name) === "pdf";
}

function isReadableTextFile(file: File) {
  const extension = getFileExtension(file.name);
  return file.type.startsWith("text/") || file.type === "application/json" || TEXT_FILE_EXTENSIONS.has(extension);
}

function truncateText(text: string) {
  return {
    textContent: text.slice(0, TEXT_MAX_CHARS),
    textTruncated: text.length > TEXT_MAX_CHARS,
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
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  const data = new Uint8Array(await file.arrayBuffer());
  const documentTask = pdfjs.getDocument({ data });
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
      const truncated = truncateText(text);
      return {
        ...base,
        kind: "pdf",
        status: "ready",
        ...truncated,
      };
    }

    if (isReadableTextFile(file)) {
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
      errorMessage: "当前仅支持图片、PDF、txt、md、csv、json 文件正文读取",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "文件内容读取失败";
    return {
      ...base,
      kind: isPdfFile(file) ? "pdf" : isReadableTextFile(file) ? "text" : "unsupported",
      status: "error",
      errorMessage: message,
    };
  }
}
