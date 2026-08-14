/**
 * @project LLMira
 * @file src/lib/models/catalog.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @function
 *   - 统一模型家族识别、能力展示、自然排序与收藏分组
 *   - 将 ProviderModel 规范化为前端模型目录条目
 * @description 纯函数模块，不读取 Store，便于聊天与翻译工作台复用和单测。
 */
import type { ProviderModel } from "@llmira/contracts";

export type ReasoningMode = "auto" | "low" | "medium" | "high";
export type ModelFamily =
  | "openai"
  | "anthropic"
  | "deepseek"
  | "google"
  | "qwen"
  | "glm"
  | "kimi"
  | "minimax"
  | "meta"
  | "mistral"
  | "xai"
  | "doubao"
  | "hunyuan"
  | "cohere"
  | "baichuan"
  | "yi"
  | "stepfun"
  | "perplexity"
  | "xiaomi"
  | "other";

export interface ModelPresentation extends ProviderModel {
  family: ModelFamily;
  familyLabel: string;
  iconKey: ModelFamily;
  favorite: boolean;
}

export const MODEL_FAMILIES: ReadonlyArray<{ id: ModelFamily; label: string }> = [
  { id: "openai", label: "OpenAI" },
  { id: "anthropic", label: "Anthropic" },
  { id: "deepseek", label: "DeepSeek" },
  { id: "google", label: "Google" },
  { id: "qwen", label: "Qwen" },
  { id: "glm", label: "GLM" },
  { id: "kimi", label: "Kimi" },
  { id: "minimax", label: "MiniMax" },
  { id: "meta", label: "Meta" },
  { id: "mistral", label: "Mistral" },
  { id: "xai", label: "xAI" },
  { id: "doubao", label: "豆包" },
  { id: "hunyuan", label: "混元" },
  { id: "cohere", label: "Cohere" },
  { id: "baichuan", label: "百川" },
  { id: "yi", label: "零一万物" },
  { id: "stepfun", label: "阶跃星辰" },
  { id: "perplexity", label: "Perplexity" },
  { id: "xiaomi", label: "小米" },
  { id: "other", label: "其他" },
];

const FAMILY_LABELS = new Map(MODEL_FAMILIES.map((family) => [family.id, family.label]));

/** 按名称、ID 与 ownedBy 识别模型家族。 */
export function inferModelFamily(model: Pick<ProviderModel, "id" | "name" | "ownedBy">): ModelFamily {
  const value = `${model.id} ${model.name} ${model.ownedBy ?? ""}`.toLowerCase();
  if (/openai|chatgpt|(^|[^a-z0-9])gpt(?:\d|[-_.\s/]|$)|(^|[^a-z0-9])o[134](?:[-_.\s/]|$)/.test(value)) return "openai";
  if (/anthropic|claude/.test(value)) return "anthropic";
  if (/deep[-_\s]?seek/.test(value)) return "deepseek";
  if (/google|gemini|gemma/.test(value)) return "google";
  if (/qwen|qwq|qvq|tongyi|通义|千问/.test(value)) return "qwen";
  if (/zhipu|chatglm|(^|[^a-z0-9])glm[-_.\s]?\d/.test(value)) return "glm";
  if (/moonshot|kimi/.test(value)) return "kimi";
  if (/minimax|(^|[^a-z0-9])abab(?:[-_.\s/]|\d|$)/.test(value)) return "minimax";
  if (/meta|llama/.test(value)) return "meta";
  if (/mistral|mixtral|codestral|ministral|magistral/.test(value)) return "mistral";
  if (/(^|[^a-z0-9])xai(?:[-_.\s/]|$)|grok/.test(value)) return "xai";
  if (/doubao|bytedance|字节|豆包|(^|[^a-z0-9])ep[-_.]?\d/.test(value)) return "doubao";
  if (/hunyuan|tencent|混元/.test(value)) return "hunyuan";
  if (/cohere|command[-_.\s]?r/.test(value)) return "cohere";
  if (/baichuan|百川/.test(value)) return "baichuan";
  if (/01[._-]?ai|零一万物|(^|[^a-z0-9])yi[-_.\s/]/.test(value)) return "yi";
  if (/stepfun|阶跃|(^|[^a-z0-9])step[-_.\s]?\d/.test(value)) return "stepfun";
  if (/perplexity|(^|[^a-z0-9])sonar(?:[-_.\s/]|$)/.test(value)) return "perplexity";
  if (/xiaomi|小米|(^|[^a-z0-9])mimo(?:[-_.\s/]|\d|$)/.test(value)) return "xiaomi";
  return "other";
}

/** 模型名自然数字降序，名称相同再按 ID 降序。 */
export function compareModelsNaturalDescending(a: Pick<ProviderModel, "id" | "name">, b: Pick<ProviderModel, "id" | "name">): number {
  const byName = b.name.localeCompare(a.name, "zh-CN", { numeric: true, sensitivity: "base" });
  return byName || b.id.localeCompare(a.id, "zh-CN", { numeric: true, sensitivity: "base" });
}

/** 将原始 Provider 模型转为展示目录，并标记当前 Provider 的收藏状态。 */
export function buildModelPresentations(models: ProviderModel[], favoriteIds: readonly string[]): ModelPresentation[] {
  const favorites = new Set(favoriteIds);
  const deduped = new Map<string, ProviderModel>();
  models.forEach((model) => deduped.set(model.id, model));
  return [...deduped.values()].map((model) => {
    const family = inferModelFamily(model);
    return {
      ...model,
      family,
      familyLabel: FAMILY_LABELS.get(family) ?? "其他",
      iconKey: family,
      favorite: favorites.has(model.id),
    };
  });
}

export interface ModelCatalogSection {
  id: "favorites" | ModelFamily;
  label: string;
  models: ModelPresentation[];
}

/** 收藏区置顶；全部模式的家族区不重复展示已收藏模型。 */
export function groupModelPresentations(models: ModelPresentation[], mode: "all" | "favorites", query = ""): ModelCatalogSection[] {
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = models.filter((model) => {
    if (!normalizedQuery) return true;
    return `${model.name} ${model.id} ${model.familyLabel}`.toLowerCase().includes(normalizedQuery);
  });
  const favorites = filtered.filter((model) => model.favorite).sort(compareModelsNaturalDescending);
  if (mode === "favorites") return favorites.length ? [{ id: "favorites", label: "收藏", models: favorites }] : [];
  const sections: ModelCatalogSection[] = favorites.length ? [{ id: "favorites", label: "收藏", models: favorites }] : [];
  MODEL_FAMILIES.forEach(({ id, label }) => {
    const familyModels = filtered.filter((model) => !model.favorite && model.family === id).sort(compareModelsNaturalDescending);
    if (familyModels.length) sections.push({ id, label, models: familyModels });
  });
  return sections;
}

/** 仅当模型支持推理且用户选择非自动档时，才向 Provider 发送参数。 */
export function resolveReasoningEffort(mode: ReasoningMode, supportsReasoning: boolean): Exclude<ReasoningMode, "auto"> | undefined {
  return supportsReasoning && mode !== "auto" ? mode : undefined;
}
