/**
 * @project LLMira
 * @file src/lib/translation/file.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @function 支持 PDF、DOCX 与纯文本类文件的单文件翻译读取
 * @description 不接受图片 OCR 与旧版 .doc，也不承诺还原原文档版式。
 */
import { getFileExtension, isDocx, isLegacyWordDoc, isPdfFile, isProbablyPlainText } from "@/lib/files/attachmentFormat";

export const TRANSLATION_FILE_ACCEPT = ".pdf,.docx,.txt,.md,.tex,.latex,.ltx,.bib,.csv,.json,.yaml,.yml,.html,.htm,.xml,.rst,.adoc,.log,text/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDFJS_WORKER_CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.worker.min.mjs";

export function isTranslationFileSupported(file: File): boolean {
  return !file.type.startsWith("image/") && !isLegacyWordDoc(file) && (isPdfFile(file) || isDocx(file) || isProbablyPlainText(file));
}

async function readPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN;
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const document = await task.promise;
  const pages: string[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items.map((item) => "str" in item ? String(item.str) : "").filter(Boolean).join(" ");
      pages.push(text.trim());
    }
  } finally {
    await document.destroy();
  }
  return pages.join("\n\n");
}

/** 读取翻译源文件的完整文本，字符上限由任务层统一检查。 */
export async function readTranslationFile(file: File): Promise<string> {
  if (!isTranslationFileSupported(file)) {
    const ext = getFileExtension(file.name);
    if (ext === "doc" || isLegacyWordDoc(file)) throw new Error("不支持旧版 .doc，请另存为 .docx 或 PDF");
    if (file.type.startsWith("image/")) throw new Error("首版翻译不支持图片 OCR");
    throw new Error("仅支持 PDF、DOCX、TXT、Markdown 和现有纯文本格式");
  }
  if (isPdfFile(file)) return readPdf(file);
  if (isDocx(file)) {
    const mammoth = await import("mammoth/mammoth.browser");
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return result.value;
  }
  return file.text();
}
