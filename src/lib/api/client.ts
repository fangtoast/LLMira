import { logger } from "@/lib/logger";
import type { TokenUsage } from "@/types";
import type { ChatCompletionRequest, ImageGenerationRequest, ModelsResponse, StreamCallbacks } from "./types";
import { MissingApiKeyError } from "./types";

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.huiyan-ai.cn";

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

export async function fetchModels(apiKey: string): Promise<ModelsResponse> {
  const res = await fetch(`${baseUrl}/v1/models`, {
    headers: getHeaders(apiKey),
  });
  if (!res.ok) throw new Error(`Failed to fetch models: ${res.status}`);
  return (await res.json()) as ModelsResponse;
}

export async function streamChatCompletion(
  apiKey: string,
  payload: ChatCompletionRequest,
  callbacks: StreamCallbacks,
) {
  const startedAt = performance.now();
  logger.info({ model: payload.model }, "[Request Model]");
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: getHeaders(apiKey),
    body: JSON.stringify({ ...payload, stream: true }),
  });
  if (!response.ok || !response.body) {
    throw new Error(`Chat API failed: ${response.status}`);
  }

  callbacks.onStart?.();
  logger.info("[Stream Start]");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let usage: TokenUsage | undefined;

  while (true) {
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
        logger.warn({ error }, "stream parse line failed");
      }
    }
  }

  logger.info(
    { elapsedMs: Math.round(performance.now() - startedAt), totalTokens: usage?.totalTokens ?? 0 },
    "[Token Count]",
  );
  callbacks.onDone?.(usage);
}

export async function generateImage(apiKey: string, payload: ImageGenerationRequest): Promise<string[]> {
  const startedAt = performance.now();
  logger.info({ model: payload.model }, "[Request Model]");
  const response = await fetch(`${baseUrl}/v1/images/generations`, {
    method: "POST",
    headers: getHeaders(apiKey),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Image API failed: ${response.status}`);
  }
  const json = (await response.json()) as { data?: Array<{ url?: string; b64_json?: string }> };
  const images = (json.data ?? [])
    .map((item) => item.url ?? (item.b64_json ? `data:image/png;base64,${item.b64_json}` : ""))
    .filter(Boolean);
  logger.info({ elapsedMs: Math.round(performance.now() - startedAt), count: images.length }, "[Token Count]");
  return images;
}
