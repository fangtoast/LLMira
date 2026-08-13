/**
 * @project LLMira
 * @file apps/worker/src/ingest.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-13
 * @function
 *   - 读取对象存储或安全网页来源并提取文本
 *   - 切分、嵌入并写入 pgvector/全文检索索引
 * @description 文档失败会保留错误状态；原始正文不会进入日志。
 */
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import mammoth from "mammoth";
import type { Sql } from "postgres";
import { v7 as uuidv7 } from "uuid";
import { safeFetch } from "./network.js";

interface IngestConfig {
  s3Endpoint: string;
  s3Region: string;
  s3Bucket: string;
  s3AccessKey: string;
  s3SecretKey: string;
  embeddingBaseUrl?: string;
  embeddingApiKey?: string;
  embeddingModel: string;
}

interface DocumentRow {
  id: string;
  workspace_id: string;
  mime_type: string;
  source_type: "upload" | "url";
  source_url: string | null;
  object_key: string | null;
}

function stripHtml(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** 以段落为边界生成带重叠的检索块。 */
export function chunkText(text: string, targetLength = 1_200, overlap = 180): string[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!normalized) return [];
  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < normalized.length) {
    let end = Math.min(normalized.length, cursor + targetLength);
    if (end < normalized.length) {
      const boundary = Math.max(normalized.lastIndexOf("\n", end), normalized.lastIndexOf("。", end));
      if (boundary > cursor + targetLength * 0.6) end = boundary + 1;
    }
    chunks.push(normalized.slice(cursor, end).trim());
    if (end >= normalized.length) break;
    cursor = Math.max(cursor + 1, end - overlap);
  }
  return chunks.filter(Boolean);
}

async function extractPdf(buffer: Buffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => "str" in item ? item.str : "").join(" "));
  }
  return pages.join("\n\n");
}

async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === "application/pdf") return extractPdf(buffer);
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return (await mammoth.extractRawText({ buffer })).value;
  }
  const decoded = buffer.toString("utf8");
  return mimeType === "text/html" ? stripHtml(decoded) : decoded;
}

async function embeddings(chunks: string[], config: IngestConfig, signal: AbortSignal): Promise<Array<number[] | undefined>> {
  if (!config.embeddingBaseUrl || !config.embeddingApiKey) return chunks.map(() => undefined);
  const output: Array<number[] | undefined> = [];
  for (let index = 0; index < chunks.length; index += 32) {
    const batch = chunks.slice(index, index + 32);
    const response = await fetch(`${config.embeddingBaseUrl.replace(/\/$/, "")}/v1/embeddings`, {
      method: "POST",
      signal,
      headers: { authorization: `Bearer ${config.embeddingApiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ model: config.embeddingModel, input: batch }),
    });
    if (!response.ok) throw new Error(`EMBEDDING_REQUEST_FAILED:${response.status}`);
    const data = await response.json() as { data?: Array<{ embedding?: number[] }> };
    output.push(...batch.map((_, offset) => data.data?.[offset]?.embedding));
  }
  return output;
}

/** 处理一个知识文档队列任务。 */
export async function ingestDocument(sql: Sql, config: IngestConfig, documentId: string): Promise<void> {
  const [document] = await sql<DocumentRow[]>`select id, workspace_id, mime_type, source_type, source_url, object_key from knowledge_documents where id = ${documentId}`;
  if (!document) throw new Error("DOCUMENT_NOT_FOUND");
  await sql`update knowledge_documents set status = 'processing', error_message = null, updated_at = now() where id = ${documentId}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  try {
    let buffer: Buffer;
    if (document.source_type === "url") {
      if (!document.source_url) throw new Error("SOURCE_URL_MISSING");
      const response = await safeFetch(document.source_url, controller.signal);
      if (!response.ok) throw new Error(`SOURCE_FETCH_FAILED:${response.status}`);
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > 25 * 1024 * 1024) throw new Error("SOURCE_TOO_LARGE");
      buffer = Buffer.from(bytes);
    } else {
      if (!document.object_key) throw new Error("OBJECT_KEY_MISSING");
      const s3 = new S3Client({ region: config.s3Region, endpoint: config.s3Endpoint, forcePathStyle: true, credentials: { accessKeyId: config.s3AccessKey, secretAccessKey: config.s3SecretKey } });
      const object = await s3.send(new GetObjectCommand({ Bucket: config.s3Bucket, Key: document.object_key }), { abortSignal: controller.signal });
      buffer = Buffer.from(await object.Body!.transformToByteArray());
    }
    const text = await extractText(buffer, document.mime_type);
    const chunks = chunkText(text);
    if (!chunks.length) throw new Error("NO_EXTRACTABLE_TEXT");
    const vectors = await embeddings(chunks, config, controller.signal);
    await sql.begin(async (tx) => {
      await tx`delete from knowledge_chunks where document_id = ${document.id}`;
      for (let ordinal = 0; ordinal < chunks.length; ordinal += 1) {
        const vector = vectors[ordinal] ? `[${vectors[ordinal]!.join(",")}]` : null;
        await tx`
          insert into knowledge_chunks (id, workspace_id, document_id, ordinal, content, embedding)
          values (${uuidv7()}, ${document.workspace_id}, ${document.id}, ${ordinal}, ${chunks[ordinal]}, ${vector}::vector)
        `;
      }
      await tx`update knowledge_documents set status = 'ready', chunk_count = ${chunks.length}, updated_at = now() where id = ${document.id}`;
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "UNKNOWN_INGEST_ERROR";
    await sql`update knowledge_documents set status = 'failed', error_message = ${message}, updated_at = now() where id = ${documentId}`;
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
