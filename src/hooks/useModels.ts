"use client";

/**
 * @project LLMira
 * @file src/hooks/useModels.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @function
 *   - 扫描并规范化当前 Provider 的聊天模型目录
 *   - 保留 useModels 字符串数组兼容入口
 * @description 展示层通过 useModelCatalog 获取家族、能力、ownedBy 与收藏状态。
 */
import { useEffect, useMemo, useState } from "react";
import type { ProviderModel } from "@llmira/contracts";
import { inferModelCapabilities } from "@llmira/provider-core";
import { fetchModels } from "@/lib/api/client";
import { getPresetModelsFromEnv } from "@/lib/api/parseModelsResponse";
import { buildModelPresentations, type ModelPresentation } from "@/lib/models/catalog";
import { useSettingsStore } from "@/lib/store/settingsStore";

const PRESET_MODELS = getPresetModelsFromEnv();
const scanInFlight = new Set<string>();
const EMPTY_FAVORITES: string[] = [];

function uniqueModels(models: ProviderModel[]): ProviderModel[] {
  const unique = new Map<string, ProviderModel>();
  models.forEach((model) => unique.set(model.id, model));
  return [...unique.values()];
}

function modelFromId(providerId: string, id: string): ProviderModel {
  return {
    providerId,
    id,
    name: id,
    capabilities: inferModelCapabilities(id),
    source: "rule",
  };
}

function composeModels(providerId: string, catalog: ProviderModel[], preset: string[]): ProviderModel[] {
  return uniqueModels([
    ...preset.map((id) => modelFromId(providerId, id)),
    ...PRESET_MODELS.map((id) => modelFromId(providerId, id)),
    // 扫描目录最后合并，确保其上游元数据覆盖同名预设的名称规则结果。
    ...catalog.map((model) => ({ ...model, capabilities: inferModelCapabilities(model.id, { ...model.capabilities }) })),
  ]);
}

function useProviderModels(): ProviderModel[] {
  const { activeApiProfileId, apiProfiles } = useSettingsStore();
  const activeProfile = apiProfiles.find((profile) => profile.id === activeApiProfileId) ?? apiProfiles[0];
  const preset = useMemo(
    () => activeProfile?.modelPreset
      ?.split(/[,，\n]/g)
      .map((item) => item.trim())
      .filter(Boolean) ?? [],
    [activeProfile?.modelPreset],
  );
  const [models, setModels] = useState<ProviderModel[]>(() =>
    activeProfile ? composeModels(activeProfile.id, activeProfile.modelCatalog, preset) : [],
  );

  useEffect(() => {
    if (!activeProfile) {
      setModels([]);
      return;
    }
    const explicitModels = composeModels(activeProfile.id, activeProfile.modelCatalog, preset);
    setModels(explicitModels);
    if (!activeProfile.apiKey || activeProfile.modelCatalog.length || scanInFlight.has(activeProfile.id)) return;

    scanInFlight.add(activeProfile.id);
    fetchModels(activeProfile)
      .then((models) => {
        const list = uniqueModels(models);
        setModels(list);
        useSettingsStore.getState().setProviderScanState(activeProfile.id, {
          scanStatus: "ready",
          lastScannedAt: new Date().toISOString(),
          scanError: undefined,
          modelCatalog: list,
          modelPreset: list.map((model) => model.id).join(","),
          baseUrl: activeProfile.baseUrl,
        });
        const state = useSettingsStore.getState();
        list.forEach((model) => state.ensureModelSettingsForModel(model.id));
        const chatModels = list.filter((model) => model.capabilities.chat);
        const imageModels = list.filter((model) => model.capabilities.imageGeneration);
        if (chatModels.length && !chatModels.some((model) => model.id === state.activeModel)) state.setActiveModel(chatModels[0]!.id);
        if (imageModels.length && !imageModels.some((model) => model.id === state.activeImageModel)) {
          state.setActiveImageModel(imageModels[0]!.id);
        }
      })
      .catch((error: unknown) => {
        useSettingsStore.getState().setProviderScanState(activeProfile.id, {
          scanStatus: "failed",
          lastScannedAt: activeProfile.lastScannedAt,
          scanError: error instanceof Error ? error.message : "模型扫描失败",
          modelCatalog: activeProfile.modelCatalog,
          modelPreset: activeProfile.modelPreset,
          baseUrl: activeProfile.baseUrl,
        });
      })
      .finally(() => scanInFlight.delete(activeProfile.id));
  }, [activeProfile, preset]);

  return models;
}

/** 返回当前 Provider 的能力完整模型目录。 */
export function useModelCatalog(): ModelPresentation[] {
  const models = useProviderModels();
  const activeApiProfileId = useSettingsStore((state) => state.activeApiProfileId);
  const favoriteIds = useSettingsStore((state) => state.favoriteModelsByProvider[activeApiProfileId] ?? EMPTY_FAVORITES);
  return useMemo(() => buildModelPresentations(models, favoriteIds), [favoriteIds, models]);
}

/** 兼容旧展示层的模型 ID 数组入口。 */
export function useModels(): string[] {
  return useModelCatalog().filter((model) => model.capabilities.chat).map((model) => model.id);
}
