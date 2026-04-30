/**
 * @project LLMira
 * @file src/lib/api/parseModelsResponse.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-04-30
 * @function
 *   - 从 `/v1/models` 多种 JSON 形态抽取模型 id
 *   - 读取环境变量预设列表
 * @description Why：各网关返回结构不一致，集中容错避免改对接层多处分支。
 */

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function asModelIdFromObject(o: Record<string, unknown>): string | null {
  const v =
    o.id ??
    o.model ??
    o.name ??
    o.model_id ??
    o.modelId ??
    o.value ??
    o.slug ??
    o.root;
  if (isNonEmptyString(v)) return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

function walkItem(item: unknown, out: Set<string>) {
  if (item == null) return;
  if (typeof item === "number" && Number.isFinite(item)) {
    out.add(String(item));
    return;
  }
  if (typeof item === "string") {
    const t = item.trim();
    if (t) out.add(t);
    return;
  }
  if (Array.isArray(item)) {
    for (const el of item) walkItem(el, out);
    return;
  }
  if (typeof item === "object") {
    const id = asModelIdFromObject(item as Record<string, unknown>);
    if (id) out.add(id);
  }
}

function walkArray(arr: unknown, out: Set<string>) {
  if (!Array.isArray(arr)) return;
  for (const item of arr) walkItem(item, out);
}

/**
 * 从 `/v1/models` 或兼容接口的任意 JSON 中提取模型 id 列表（去重无序转数组）。
 */
export function extractModelIdsFromResponse(json: unknown): string[] {
  const out = new Set<string>();
  if (json == null) return [];

  if (Array.isArray(json)) {
    walkArray(json, out);
    return [...out];
  }

  if (typeof json !== "object") return [];

  const root = json as Record<string, unknown>;

  const data = root.data;
  if (Array.isArray(data)) {
    walkArray(data, out);
  } else if (data && typeof data === "object" && !Array.isArray(data)) {
    const inner = data as Record<string, unknown>;
    if (Array.isArray(inner.data)) walkArray(inner.data, out);
    if (Array.isArray(inner.models)) walkArray(inner.models, out);
    if (Array.isArray(inner.list)) walkArray(inner.list, out);
    if (Array.isArray(inner.items)) walkArray(inner.items, out);
    if (Array.isArray(inner.rows)) walkArray(inner.rows, out);
    if (Array.isArray(inner.records)) walkArray(inner.records, out);
    if (isNonEmptyString(inner.id) || isNonEmptyString(String(inner.model ?? ""))) {
      const id = asModelIdFromObject(inner);
      if (id) out.add(id);
    }
  }

  if (Array.isArray(root.models)) walkArray(root.models, out);
  if (Array.isArray(root.items)) walkArray(root.items, out);
  if (Array.isArray(root.rows)) walkArray(root.rows, out);
  if (Array.isArray(root.list)) walkArray(root.list, out);
  if (Array.isArray(root.result)) walkArray(root.result, out);
  if (Array.isArray(root.data_list)) walkArray(root.data_list, out);

  return [...out];
}

/**
 * 逗号分隔的额外/兜底模型，来自 `NEXT_PUBLIC_MODEL_PRESET`。
 */
export function getPresetModelsFromEnv(): string[] {
  const raw = process.env.NEXT_PUBLIC_MODEL_PRESET;
  if (!isNonEmptyString(raw)) return [];
  return [
    ...new Set(
      raw
        .split(/[,，\n]/g)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
}
