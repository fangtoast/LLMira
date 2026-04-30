"use client";

/**
 * @project LLMira
 * @file src/hooks/useModels.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-04-30
 * @function
 *   - 拉取并合并远程模型列表与环境预设
 * @description 依赖 `apiKey`；列表过少时用 `NEXT_PUBLIC_MODEL_PRESET` 补足。
 */
import { useEffect, useState } from "react";
import { fetchModels } from "@/lib/api/client";
import { getPresetModelsFromEnv } from "@/lib/api/parseModelsResponse";
import { useSettingsStore } from "@/lib/store/settingsStore";

const PRESET_MODELS = getPresetModelsFromEnv();

const ULTIMATE_FALLBACK = ["gpt-5-chat"] as const;

function mergeWithPresetWhenSparse(ids: string[]): string[] {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length >= 2) return unique;
  if (PRESET_MODELS.length > 0) {
    return [...new Set([...unique, ...PRESET_MODELS])];
  }
  return unique.length > 0 ? unique : [...ULTIMATE_FALLBACK];
}

/**
 * @returns 模型 id 字符串数组，供 TopBar 等下拉使用
 */
export function useModels() {
  const { apiKey } = useSettingsStore();
  const [models, setModels] = useState<string[]>(() =>
    PRESET_MODELS.length > 0 ? PRESET_MODELS : [...ULTIMATE_FALLBACK],
  );

  useEffect(() => {
    if (!apiKey) {
      setModels(PRESET_MODELS.length > 0 ? PRESET_MODELS : [...ULTIMATE_FALLBACK]);
      return;
    }
    fetchModels(apiKey)
      .then((ids) => {
        const list = mergeWithPresetWhenSparse(ids);
        setModels(list);

        const { activeModel, activeImageModel, setActiveModel, setActiveImageModel } =
          useSettingsStore.getState();
        if (list.length && !list.includes(activeModel)) {
          setActiveModel(list[0]!);
        }
        const imageList = list.filter((item) => /(image|mj|dall|flux|sd|gpt-image)/i.test(item));
        const forImage = imageList.length > 0 ? imageList : list;
        if (forImage.length && !forImage.includes(activeImageModel)) {
          setActiveImageModel(forImage[0]!);
        }
      })
      .catch(() => {
        const fallback = mergeWithPresetWhenSparse([]);
        setModels(fallback);
        const { activeModel, activeImageModel, setActiveModel, setActiveImageModel } = useSettingsStore.getState();
        if (fallback.length) {
          if (!fallback.includes(activeModel)) setActiveModel(fallback[0]!);
          const imageList = fallback.filter((m) => /(image|mj|dall|flux|sd|gpt-image)/i.test(m));
          const forImage = imageList.length > 0 ? imageList : fallback;
          if (!forImage.includes(activeImageModel)) setActiveImageModel(forImage[0]!);
        }
      });
  }, [apiKey]);

  return models;
}
