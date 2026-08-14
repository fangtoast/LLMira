/**
 * @project LLMira
 * @file packages/provider-core/src/index.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @function
 *   - 规范化 OpenAI-compatible Provider 地址并扫描模型
 *   - 统一模型能力推断与可操作错误分类
 * @description 纯协议模块；浏览器、Tauri 与 Fastify 通过注入 fetch 复用，不持久化密钥。
 */
import type { ModelCapabilities, ProviderModel } from "@llmira/contracts";

export type ProviderInspectErrorCode =
  | "invalid_url"
  | "insecure_url"
  | "unauthorized"
  | "forbidden"
  | "timeout"
  | "network"
  | "invalid_json"
  | "no_models"
  | "upstream_error";

export class ProviderInspectError extends Error {
  /** 标准化 Provider 连接错误，供 UI 显示精确原因。 */
  constructor(
    public readonly code: ProviderInspectErrorCode,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ProviderInspectError";
  }
}

export interface InspectProviderInput {
  providerId: string;
  baseUrl: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  allowInsecureLocalhost?: boolean;
}

export interface InspectProviderResult {
  normalizedBaseUrl: string;
  models: ProviderModel[];
  scannedAt: string;
}

const MODEL_ID_FIELDS = ["id", "model", "name", "model_id", "modelId", "value", "slug", "root"] as const;
const ARRAY_FIELDS = ["data", "models", "items", "rows", "list", "result", "records", "data_list"] as const;

function isLocalHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "::1";
}

/** 规范化 Base URL；最终值永远不含末尾 `/v1` 与斜杠。 */
export function normalizeProviderBaseUrl(value: string, allowInsecureLocalhost = true): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new ProviderInspectError("invalid_url", "API Host 不是有效 URL。");
  }
  if (url.username || url.password) {
    throw new ProviderInspectError("invalid_url", "API Host 不得包含用户名或密码。");
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new ProviderInspectError("invalid_url", "API Host 仅支持 HTTP 或 HTTPS。");
  }
  if (url.protocol !== "https:" && !(allowInsecureLocalhost && isLocalHostname(url.hostname))) {
    throw new ProviderInspectError("insecure_url", "生产连接必须使用 HTTPS；仅 localhost/127.0.0.1 可使用 HTTP。");
  }
  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\/+$/g, "").replace(/\/v1$/i, "") || "/";
  return url.toString().replace(/\/$/g, "");
}

/** 返回 Provider 的标准模型端点。 */
export function getModelsEndpoint(baseUrl: string, allowInsecureLocalhost = true): string {
  return `${normalizeProviderBaseUrl(baseUrl, allowInsecureLocalhost)}/v1/models`;
}

function readModelId(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  for (const field of MODEL_ID_FIELDS) {
    const id = record[field];
    if (typeof id === "string" && id.trim()) return id.trim();
    if (typeof id === "number" && Number.isFinite(id)) return String(id);
  }
  return undefined;
}

function collectModels(value: unknown, out: Map<string, Record<string, unknown>>): void {
  if (Array.isArray(value)) {
    value.forEach((item) => collectModels(item, out));
    return;
  }
  const id = readModelId(value);
  if (id) {
    const metadata = value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
    out.set(id, metadata);
  }
}

/** 兼容标准 `data[].id` 与常见网关数组结构。 */
export function parseProviderModels(value: unknown): Array<{ id: string; metadata: Record<string, unknown> }> {
  const out = new Map<string, Record<string, unknown>>();
  if (Array.isArray(value)) {
    collectModels(value, out);
  } else if (value && typeof value === "object") {
    const root = value as Record<string, unknown>;
    for (const field of ARRAY_FIELDS) {
      const candidate = root[field];
      if (Array.isArray(candidate)) collectModels(candidate, out);
      else if (candidate && typeof candidate === "object") {
        const nested = candidate as Record<string, unknown>;
        for (const nestedField of ARRAY_FIELDS) collectModels(nested[nestedField], out);
      }
    }
  }
  return [...out.entries()].map(([id, metadata]) => ({ id, metadata }));
}

function metadataBoolean(metadata: Record<string, unknown>, keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "boolean") return value;
    const capabilities = metadata.capabilities;
    if (capabilities && typeof capabilities === "object" && !Array.isArray(capabilities)) {
      const nestedValue = (capabilities as Record<string, unknown>)[key];
      if (typeof nestedValue === "boolean") return nestedValue;
    }
  }
  return undefined;
}

function metadataListIncludes(metadata: Record<string, unknown>, keys: string[], values: string[]): boolean | undefined {
  for (const key of keys) {
    const candidate = metadata[key];
    if (!Array.isArray(candidate)) continue;
    const normalized = candidate.filter((item): item is string => typeof item === "string").map((item) => item.toLowerCase());
    if (normalized.some((item) => values.includes(item))) return true;
  }
  const capabilities = metadata.capabilities;
  if (Array.isArray(capabilities)) {
    const normalized = capabilities.filter((item): item is string => typeof item === "string").map((item) => item.toLowerCase());
    if (normalized.some((item) => values.includes(item))) return true;
  }
  return undefined;
}

/** 按上游元数据优先、名称规则回退推断模型能力。 */
export function inferModelCapabilities(id: string, metadata: Record<string, unknown> = {}): ModelCapabilities {
  const name = id.toLowerCase();
  const isEmbedding = /embed|rerank|moderation|tts|speech|whisper|transcri/.test(name);
  const isGpt55Or56 = /(^|[^a-z0-9])gpt[-_.\s]?5[._-][56](?:[^0-9]|$)/.test(name);
  const isMiniMax = /minimax|(^|[^a-z0-9])abab(?:[-_.\s/]|\d|$)/.test(name);
  const namedImageGenerator = /dall[-_.\s]?e|gpt[-_.\s]?image|image[-_.\s]?gen|image[-_.\s]?0?1|imagen|flux|stable[-_.\s]?diffusion|sdxl|seedream|qwen[-_.\s]?image|(^|[-_/])wan[-_.\s]?\d|kolors|recraft|ideogram|midjourney|nano[-_.\s]?banana|gemini.*image/.test(name);
  const imageGenerationRule = !isEmbedding && (namedImageGenerator || isGpt55Or56 || isMiniMax);
  const upstreamImageGeneration = metadataBoolean(metadata, ["imageGeneration", "image_generation", "supports_image_generation"])
    ?? metadataListIncludes(metadata, ["output_modalities", "outputModalities"], ["image", "images"])
    ?? metadataListIncludes(metadata, [], ["image_generation", "image-generation"]);
  return {
    chat: metadataBoolean(metadata, ["chat", "supports_chat"]) ?? (!isEmbedding && !namedImageGenerator),
    vision: metadataBoolean(metadata, ["vision", "supports_vision", "multimodal"]) ?? /vision|vl|gpt-4o|gemini|claude-3/.test(name),
    imageGeneration: upstreamImageGeneration ?? imageGenerationRule,
    reasoning: metadataBoolean(metadata, ["reasoning", "supports_reasoning"]) ?? /(^|[-_/])(o[134]|r1|reason|thinking)|gpt-5|deepseek-r1/.test(name),
    tools: metadataBoolean(metadata, ["tools", "supports_tools", "function_calling"]) ?? !isEmbedding,
    nativeWebSearch: metadataBoolean(metadata, ["nativeWebSearch", "native_web_search", "web_search", "supports_web_search"]) ?? /search/.test(name),
  };
}

function errorFromStatus(status: number, detail: string): ProviderInspectError {
  if (status === 401) return new ProviderInspectError("unauthorized", "API Key 无效或未获得访问权限。", status);
  if (status === 403) return new ProviderInspectError("forbidden", "Provider 拒绝访问，请检查 Key 权限或来源限制。", status);
  return new ProviderInspectError("upstream_error", `Provider 返回 HTTP ${status}${detail ? `：${detail}` : ""}`, status);
}

/** 使用临时凭据连接 `/v1/models`，返回可直接展示的模型目录。 */
export async function inspectOpenAICompatibleProvider(input: InspectProviderInput): Promise<InspectProviderResult> {
  const normalizedBaseUrl = normalizeProviderBaseUrl(input.baseUrl, input.allowInsecureLocalhost ?? true);
  const fetchImpl = input.fetchImpl ?? fetch;
  const timeoutMs = input.timeoutMs ?? 20_000;
  let response: Response;
  try {
    response = await fetchImpl(`${normalizedBaseUrl}/v1/models`, {
      method: "GET",
      headers: { authorization: `Bearer ${input.apiKey}`, accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (error instanceof ProviderInspectError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    if (/abort|timeout/i.test(message)) throw new ProviderInspectError("timeout", "连接 Provider 超时。");
    throw new ProviderInspectError("network", `无法连接 Provider：${message}`);
  }
  const bodyText = await response.text();
  if (!response.ok) throw errorFromStatus(response.status, bodyText.slice(0, 180));
  let body: unknown;
  try {
    body = JSON.parse(bodyText) as unknown;
  } catch {
    throw new ProviderInspectError("invalid_json", "Provider 的 /v1/models 返回了无效 JSON。");
  }
  const parsed = parseProviderModels(body);
  if (!parsed.length) throw new ProviderInspectError("no_models", "连接成功，但 /v1/models 没有返回可用模型。");
  return {
    normalizedBaseUrl,
    scannedAt: new Date().toISOString(),
    models: parsed.map(({ id, metadata }) => ({
      providerId: input.providerId,
      id,
      name: typeof metadata.name === "string" ? metadata.name : id,
      ownedBy: typeof metadata.owned_by === "string" ? metadata.owned_by : undefined,
      contextWindow: typeof metadata.context_window === "number" ? metadata.context_window : undefined,
      capabilities: inferModelCapabilities(id, metadata),
      source: Object.keys(metadata).some((key) => key.startsWith("supports_") || ["capabilities", "output_modalities", "outputModalities"].includes(key)) ? "upstream" : "rule",
    })),
  };
}
