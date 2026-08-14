/**
 * @project LLMira
 * @file src/lib/store/settingsStore.test.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @description v4 迁移与 Provider 级收藏隔离测试。
 */
import { beforeEach, describe, expect, it } from "vitest";
import { migrateSettingsState, useSettingsStore } from "./settingsStore";

describe("settings store v4", () => {
  beforeEach(() => {
    useSettingsStore.setState({ favoriteModelsByProvider: {}, reasoningModeByProviderModel: {}, translationModelByProviderId: {} });
  });

  it("将旧 enableThinking 映射为当前 Provider/模型的 high", () => {
    const migrated = migrateSettingsState({ activeApiProfileId: "p1", activeModel: "gpt-5", enableThinking: true, apiProfiles: [{ id: "p1", name: "P1", baseUrl: "https://example.com", apiKey: "secret", modelPreset: "", protocol: "openai_compatible", executionMode: "device", scanStatus: "never", modelCatalog: [] }] });
    expect(migrated.reasoningModeByProviderModel.p1?.["gpt-5"]).toBe("high");
    expect(migrated.apiProfiles[0]?.apiKey).toBe("");
  });

  it("收藏按 Provider 独立保存且取消不影响另一 Provider", () => {
    const state = useSettingsStore.getState();
    state.toggleFavoriteModel("p1", "gpt-5");
    state.toggleFavoriteModel("p2", "gpt-5");
    useSettingsStore.getState().toggleFavoriteModel("p1", "gpt-5");
    expect(useSettingsStore.getState().favoriteModelsByProvider.p1).toEqual([]);
    expect(useSettingsStore.getState().favoriteModelsByProvider.p2).toEqual(["gpt-5"]);
  });
});
