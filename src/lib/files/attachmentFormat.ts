/**
 * @project LLMira
 * @file src/lib/files/attachmentFormat.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-05-12
 * @function
 *   - 附件 MIME / 扩展名判定（纯文本、docx、旧版 doc）
 *   - 供 InputBar 预览与 parseAttachment 共用，避免分叉
 * @description 浏览器端可读正文的上限由 parseAttachment 截断；此处只做分类。
 */

/** 按扩展名视为「可按 UTF-8 文本读取」的常见文稿与代码周边格式。 */
export const PLAIN_TEXT_FILE_EXTENSIONS = new Set([
  "txt",
  "md",
  "csv",
  "json",
  "tex",
  "latex",
  "ltx",
  "bib",
  "sty",
  "cls",
  "yaml",
  "yml",
  "html",
  "htm",
  "xml",
  "rst",
  "adoc",
  "log",
]);

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const LEGACY_DOC_MIME = "application/msword";

/** `<input type="file" accept>`：常用扩展名 + 允许任选类型以便冷门格式上传后提示不支持 */
export const FILE_INPUT_ACCEPT = [
  "image/*",
  ".pdf",
  ".doc",
  ".docx",
  ".txt",
  ".md",
  ".tex",
  ".latex",
  ".ltx",
  ".bib",
  ".csv",
  ".json",
  ".yaml",
  ".yml",
  ".html",
  ".htm",
  ".xml",
  ".rst",
  ".adoc",
  ".log",
  "*/*",
].join(",");

/** 向用户展示的支持范围摘要（用于不支持时的 errorMessage）。 */
export const SUPPORTED_FORMATS_SUMMARY =
  "图片、PDF、Word（.docx）、纯文本类文件（含 md、txt、LaTeX（.tex 等）、csv、json、yaml、html、xml 等）";

export function getFileExtension(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function mimeLooksPlainText(mime: string): boolean {
  if (!mime) return false;
  if (mime.startsWith("text/")) return true;
  if (
    mime === "application/json" ||
    mime === "application/xml" ||
    mime === "text/xml" ||
    mime === "application/yaml" ||
    mime === "application/x-yaml" ||
    mime === "text/yaml"
  ) {
    return true;
  }
  return false;
}

/** 是否可按纯文本 readAsText 尝试读取正文（扩展名或 MIME）。 */
export function isProbablyPlainText(file: File): boolean {
  const ext = getFileExtension(file.name);
  if (PLAIN_TEXT_FILE_EXTENSIONS.has(ext)) return true;
  return mimeLooksPlainText(file.type || "");
}

export function isDocx(file: File): boolean {
  const ext = getFileExtension(file.name);
  return ext === "docx" || file.type === DOCX_MIME;
}

/** Word 97–2003 .doc（OLE），浏览器端不做转换。 */
export function isLegacyWordDoc(file: File): boolean {
  const ext = getFileExtension(file.name);
  return ext === "doc" || file.type === LEGACY_DOC_MIME;
}

export function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || getFileExtension(file.name) === "pdf";
}

/**
 * 发送前「读取中」阶段的 kind 预览，应与 parseAttachment 最终分类一致（docx → text）。
 */
export function inferAttachmentKind(
  file: File,
): "image" | "text" | "pdf" | "unsupported" {
  if (file.type.startsWith("image/")) return "image";
  if (isPdfFile(file)) return "pdf";
  if (isDocx(file) || isProbablyPlainText(file)) return "text";
  if (isLegacyWordDoc(file)) return "unsupported";
  return "unsupported";
}

/** 旧版 .doc 固定提示文案 */
export function legacyDocUnsupportedMessage(): string {
  return "不支持 Microsoft Word 97-2003 格式（.doc）。请将文档另存为 .docx 或导出为 PDF 后再上传。";
}

/**
 * 构造通用「不支持读取正文」说明（含后缀与 MIME，便于用户自查）。
 */
export function buildUnsupportedFormatMessage(file: File): string {
  const ext = getFileExtension(file.name);
  const extLabel = ext ? `.${ext}` : "无扩展名";
  const mime = file.type?.trim() || "（浏览器未提供 MIME）";
  return `无法读取「${file.name}」的正文：格式 ${extLabel}（类型 ${mime}）不在支持范围内。当前支持：${SUPPORTED_FORMATS_SUMMARY}。`;
}
