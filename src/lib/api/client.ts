/**
 * @project LLMira
 * @file src/lib/api/client.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-04-30
 * @function
 *   - OpenAI 兼容 HTTP：模型列表、流式对话、文生图
 *   - SSE 行解析与推理 token 抽取
 * @description 浏览器侧直连 `NEXT_PUBLIC_API_BASE_URL`；依赖 `@/lib/logger` 打点与 `@/lib/api/types` 请求体定义。
 */
import { logger } from "@/lib/logger";
import type { TokenUsage } from "@/types";
import { extractModelIdsFromResponse } from "./parseModelsResponse";
import type { ChatCompletionRequest, ImageGenerationRequest, StreamCallbacks, StreamRequestOptions } from "./types";
import { MissingApiKeyError } from "./types";

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.huiyan-ai.cn";

async function readErrorText(response: Response) {
  try {
    const text = await response.text();
    return text.slice(0, 200);
  } catch {
    return "";
  }
}

function extractReasoningToken(delta: unknown): string | undefined {
  if (!delta || typeof delta !== "object") return undefined;
  const d = delta as Record<string, unknown>;

  const direct =
    (typeof d.reasoning_content === "string" && d.reasoning_content) ||
    (typeof d.reasoning === "string" && d.reasoning) ||
    (typeof d.thinking === "string" && d.thinking);
  if (direct) return direct;

  const arr = d.reasoning_content;
  if (Array.isArray(arr)) {
    const text = arr
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const obj = item as Record<string, unknown>;
          return typeof obj.text === "string" ? obj.text : "";
        }
        return "";
      })
      .join("");
    return text || undefined;
  }
  return undefined;
}

function getHeaders(apiKey: string) {
  if (!apiKey) throw new MissingApiKeyError();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
}

/**
 * GET `/v1/models`，将任意兼容 JSON 转为模型 id 列表。
 *
 * @throws Error 当 HTTP 非成功或 JSON 非法时
 */
export async function fetchModels(apiKey: string): Promise<string[]> {
  const res = await fetch(`${baseUrl}/v1/models`, {
    headers: getHeaders(apiKey),
  });
  if (!res.ok) {
    const detail = await readErrorText(res);
    throw new Error(`Failed to fetch models: ${res.status}${detail ? ` - ${detail}` : ""}`);
  }
  const bodyText = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(bodyText) as unknown;
  } catch (e) {
    throw new Error(
      `Invalid JSON from /v1/models: ${e instanceof Error ? e.message : String(e)} body=${bodyText.slice(0, 120)}`,
    );
  }
  const ids = extractModelIdsFromResponse(json);
  if (ids.length === 0) {
    logger.warn(
      "[models] 解析后为空，请检查 /v1/models 是否兼容 OpenAI 结构。顶层键:",
      json && typeof json === "object" ? Object.keys(json as object) : typeof json,
    );
  }
  return ids;
}

function isAbortError(e: unknown): boolean {
  if (e && typeof e === "object" && "name" in e && (e as { name: string }).name === "AbortError") return true;
  return false;
}

function withRequestTimeout(signal?: AbortSignal, timeoutMs = 30000): AbortSignal {
  const AS = AbortSignal as typeof AbortSignal & {
    timeout?: (ms: number) => AbortSignal;
    any?: (signals: AbortSignal[]) => AbortSignal;
  };
  if (AS.timeout && AS.any && signal) return AS.any([signal, AS.timeout(timeoutMs)]);
  if (AS.timeout && !signal) return AS.timeout(timeoutMs);

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  const onAbort = () => ac.abort();
  if (signal) {
    if (signal.aborted) ac.abort();
    else signal.addEventListener("abort", onAbort, { once: true });
  }
  ac.signal.addEventListener(
    "abort",
    () => {
      clearTimeout(timer);
      if (signal) signal.removeEventListener("abort", onAbort);
    },
    { once: true },
  );
  return ac.signal;
}

/**
 * POST `/v1/chat/completions`（stream），解析 SSE `data:` 行并驱动回调。
 *
 * @remarks 中止时触发 `onAbort`；非中止错误向上抛出，由调用方处理。
 */
export async function streamChatCompletion(
  apiKey: string,
  payload: ChatCompletionRequest,
  callbacks: StreamCallbacks,
  options?: StreamRequestOptions,
) {
  const signal = options?.signal;
  const requestSignal = withRequestTimeout(signal);
  const startedAt = performance.now();
  logger.info({ model: payload.model }, "[Request Model]");
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  try {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: getHeaders(apiKey),
      body: JSON.stringify({ ...payload, stream: true }),
      signal: requestSignal,
    });
    if (!response.ok || !response.body) {
      const detail = await readErrorText(response);
      throw new Error(`Chat API failed: ${response.status}${detail ? ` - ${detail}` : ""}`);
    }

    callbacks.onStart?.();
    logger.info("[Stream Start]");

    reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let usage: TokenUsage | undefined;

    while (true) {
      if (signal?.aborted) {
        try {
          await reader.cancel();
        } catch {
          /* ignore */
        }
        await callbacks.onAbort?.();
        return;
      }
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith("data:")) continue;
        const data = line.replace(/^data:\s*/, "");
        if (data === "[DONE]") continue;
        try {
          const json = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string; reasoning_content?: unknown; reasoning?: unknown; thinking?: unknown } }>;
            usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
          };
          const delta = json.choices?.[0]?.delta;
          const token = delta?.content;
          const reasoningToken = extractReasoningToken(delta);
          if (token) callbacks.onToken?.(token);
          if (reasoningToken) callbacks.onReasoningToken?.(reasoningToken);
          if (json.usage) {
            usage = {
              promptTokens: json.usage.prompt_tokens,
              completionTokens: json.usage.completion_tokens,
              totalTokens: json.usage.total_tokens,
              estimatedCostUSD: Number((json.usage.total_tokens * 0.000002).toFixed(6)),
            };
          }
        } catch (error) {
          logger.exception(error, "stream parse line failed");
        }
      }
    }

    logger.info(
      { elapsedMs: Math.round(performance.now() - startedAt), totalTokens: usage?.totalTokens ?? 0 },
      "[Token Count]",
    );
    await callbacks.onDone?.(usage);
  } catch (e) {
    if (requestSignal.aborted || signal?.aborted || isAbortError(e)) {
      if (reader) {
        try {
          await reader.cancel();
        } catch {
          /* ignore */
        }
      }
      await callbacks.onAbort?.();
      return;
    }
    throw e;
  }
}

/**
 * POST `/v1/images/generations`，返回图片 URL 列表（含 content 中解析的链接兜底）。
 */
export async function generateImage(
  apiKey: string,
  payload: ImageGenerationRequest,
  options?: StreamRequestOptions,
): Promise<string[]> {
  const startedAt = performance.now();
  const requestSignal = withRequestTimeout(options?.signal);
  logger.info({ model: payload.model }, "[Request Model]");
  const response = await fetch(`${baseUrl}/v1/images/generations`, {
    method: "POST",
    headers: getHeaders(apiKey),
    body: JSON.stringify(payload),
    signal: requestSignal,
  });
  if (!response.ok) {
    const detail = await readErrorText(response);
    throw new Error(`Image API failed: ${response.status}${detail ? ` - ${detail}` : ""}`);
  }
  const json = (await response.json()) as {
    data?: Array<{ url?: string; b64_json?: string }>;
    choices?: Array<{ message?: { content?: string } }>;
  };
  const fromData = (json.data ?? [])
    .map((item) => item.url ?? (item.b64_json ? `data:image/png;base64,${item.b64_json}` : ""))
    .filter(Boolean);
  const content = json.choices?.[0]?.message?.content ?? "";
  const fromContent = Array.from(content.matchAll(/!\[[^\]]*]\(([^)]+)\)|https?:\/\/\S+/g))
    .map((m) => m[1] ?? m[0])
    .filter(Boolean);
  const images = [...new Set([...fromData, ...fromContent])];
  logger.info({ elapsedMs: Math.round(performance.now() - startedAt), count: images.length }, "[Token Count]");
  return images;
}
