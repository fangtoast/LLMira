"use client";

/**
 * @project LLMira
 * @file src/hooks/useModels.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-04-30
 * @function
 *   - 使用显式扫描目录并兼容旧 Profile 首次补扫
 * @description 上游扫描结果是模型可用性的唯一来源；不再注入假模型。
 */
import { useEffect, useState } from "react";
import { fetchModels } from "@/lib/api/client";
import { getPresetModelsFromEnv } from "@/lib/api/parseModelsResponse";
import { useSettingsStore } from "@/lib/store/settingsStore";

const PRESET_MODELS = getPresetModelsFromEnv();

function uniqueModels(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))];
}

/**
 * @returns 模型 id 字符串数组，供 TopBar 等下拉使用
 */
export function useModels() {
  const { activeApiProfileId, apiProfiles } = useSettingsStore();
  const [models, setModels] = useState<string[]>(PRESET_MODELS);

  useEffect(() => {
    const { getActiveApiProfile, getActiveProfilePresetModels, setProviderScanState } = useSettingsStore.getState();
    const activeProfile = getActiveApiProfile();
    const profilePresetModels = getActiveProfilePresetModels();
    const scannedModels = uniqueModels(activeProfile.modelCatalog.map((model) => model.id));
    const explicitModels = uniqueModels([...scannedModels, ...profilePresetModels, ...PRESET_MODELS]);

    if (explicitModels.length) {
      setModels(explicitModels);
    }

    if (!activeProfile.apiKey) {
      setModels(explicitModels);
      return;
    }
    if (scannedModels.length) return;
    fetchModels(activeProfile)
      .then((ids) => {
        const list = uniqueModels(ids);
        setModels(list);
        setProviderScanState(activeProfile.id, {
          scanStatus: "ready",
          lastScannedAt: new Date().toISOString(),
          scanError: undefined,
          modelCatalog: list.map((id) => ({
            providerId: activeProfile.id,
            id,
            name: id,
            capabilities: { chat: true, vision: false, imageGeneration: false, reasoning: false, tools: true, nativeWebSearch: false },
            source: "rule" as const,
          })),
          modelPreset: list.join(","),
          baseUrl: activeProfile.baseUrl,
        });

        const { activeModel, activeImageModel, setActiveModel, setActiveImageModel, ensureModelSettingsForModel } =
          useSettingsStore.getState();
        list.forEach((modelId) => ensureModelSettingsForModel(modelId));
        if (list.length && !list.includes(activeModel)) {
          setActiveModel(list[0]!);
        }
        if (list.length && !list.includes(activeImageModel)) {
          const imageList = list.filter((item) => /(image|mj|dall|flux|sd|gpt-image)/i.test(item));
          setActiveImageModel((imageList[0] ?? list[0])!);
        }
      })
      .catch((error: unknown) => {
        setModels(explicitModels);
        setProviderScanState(activeProfile.id, {
          scanStatus: "failed",
          lastScannedAt: activeProfile.lastScannedAt,
          scanError: error instanceof Error ? error.message : "模型扫描失败",
          modelCatalog: activeProfile.modelCatalog,
          modelPreset: activeProfile.modelPreset,
          baseUrl: activeProfile.baseUrl,
        });
      });
  }, [activeApiProfileId, apiProfiles]);

  return models;
}
