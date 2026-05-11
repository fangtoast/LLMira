"use client";

/**
 * @project LLMira
 * @file src/lib/store/settingsStore.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-04-30
 * @function
 *   - API Key、模型、生成参数、侧栏状态等持久化设置
 * @description Zustand persist → localStorage；SSR 使用内存 storage 占位。
 */
import { create } from "zustand";
import { createJSONStorage, type StateStorage, persist } from "zustand/middleware";

const memoryStorage: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

const webStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
    } catch {
      /* ignore quota / private mode */
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      /* ignore */
    }
  },
};

const storage = createJSONStorage<unknown>(() =>
  typeof window === "undefined" ? memoryStorage : webStorage,
);

export type ModelGenerationSettings = {
  temperature: number;
  topP: number;
  maxTokens: number;
  presencePenalty: number;
  frequencyPenalty: number;
};

const DEFAULT_MODEL_GENERATION_SETTINGS: ModelGenerationSettings = {
  temperature: 0.7,
  topP: 1,
  maxTokens: 4096,
  presencePenalty: 0,
  frequencyPenalty: 0,
};

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function sanitizeModelSettings(input: Partial<ModelGenerationSettings>): ModelGenerationSettings {
  return {
    temperature: clampNumber(input.temperature ?? DEFAULT_MODEL_GENERATION_SETTINGS.temperature, 0, 2),
    topP: clampNumber(input.topP ?? DEFAULT_MODEL_GENERATION_SETTINGS.topP, 0, 1),
    maxTokens: Math.max(1, Math.floor(Number.isFinite(input.maxTokens ?? NaN) ? (input.maxTokens as number) : DEFAULT_MODEL_GENERATION_SETTINGS.maxTokens)),
    presencePenalty: clampNumber(input.presencePenalty ?? DEFAULT_MODEL_GENERATION_SETTINGS.presencePenalty, -2, 2),
    frequencyPenalty: clampNumber(input.frequencyPenalty ?? DEFAULT_MODEL_GENERATION_SETTINGS.frequencyPenalty, -2, 2),
  };
}

interface SettingsState {
  apiKey: string;
  userName: string;
  userAvatarText: string;
  activeModel: string;
  activeImageModel: string;
  generationMode: "chat" | "image";
  enableThinking: boolean;
  modelSettingsById: Record<string, ModelGenerationSettings>;
  temperature: number;
  topP: number;
  maxTokens: number;
  presencePenalty: number;
  frequencyPenalty: number;
  sidebarCollapsed: boolean;
  apiKeyModalOpen: boolean;
  hasCompletedOnboarding: boolean;
  setApiKey: (key: string) => void;
  setUserName: (name: string) => void;
  setUserAvatarText: (text: string) => void;
  setActiveModel: (model: string) => void;
  setActiveImageModel: (model: string) => void;
  setGenerationMode: (mode: "chat" | "image") => void;
  setEnableThinking: (enable: boolean) => void;
  ensureModelSettingsForModel: (modelId: string) => void;
  updateCurrentModelSettings: (patch: Partial<ModelGenerationSettings>) => void;
  applyCurrentSettingsToAllModels: (modelIds?: string[]) => void;
  setTemperature: (v: number) => void;
  setTopP: (v: number) => void;
  setMaxTokens: (v: number) => void;
  setPresencePenalty: (v: number) => void;
  setFrequencyPenalty: (v: number) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setApiKeyModalOpen: (open: boolean) => void;
  setHasCompletedOnboarding: (completed: boolean) => void;
}

/** 用户级设置（含密钥与模型选择），详见 `partialize` 持久化字段。 */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      apiKey: "",
      userName: "Xiao",
      userAvatarText: "潇",
      activeModel: "gpt-5.5",
      activeImageModel: "gpt-image-1",
      generationMode: "chat",
      enableThinking: false,
      modelSettingsById: {
        "gpt-5.5": DEFAULT_MODEL_GENERATION_SETTINGS,
      },
      ...DEFAULT_MODEL_GENERATION_SETTINGS,
      sidebarCollapsed: false,
      apiKeyModalOpen: false,
      hasCompletedOnboarding: false,
      setApiKey: (apiKey) => set({ apiKey }),
      /** 允许空字符串，便于在输入框中删除后重新输入；界面展示处再用默认值兜底 */
      setUserName: (userName) => set({ userName }),
      setUserAvatarText: (userAvatarText) => set({ userAvatarText: userAvatarText.slice(0, 2) }),
      setActiveModel: (activeModel) =>
        set((state) => {
          const existing = state.modelSettingsById[activeModel];
          const nextSettings = sanitizeModelSettings(existing ?? DEFAULT_MODEL_GENERATION_SETTINGS);
          return {
            activeModel,
            modelSettingsById: existing
              ? state.modelSettingsById
              : { ...state.modelSettingsById, [activeModel]: nextSettings },
            ...nextSettings,
          };
        }),
      setActiveImageModel: (activeImageModel) => set({ activeImageModel }),
      setGenerationMode: (generationMode) => set({ generationMode }),
      setEnableThinking: (enableThinking) => set({ enableThinking }),
      ensureModelSettingsForModel: (modelId) =>
        set((state) => {
          if (!modelId || state.modelSettingsById[modelId]) return state;
          return {
            modelSettingsById: {
              ...state.modelSettingsById,
              [modelId]: sanitizeModelSettings(DEFAULT_MODEL_GENERATION_SETTINGS),
            },
          };
        }),
      updateCurrentModelSettings: (patch) =>
        set((state) => {
          const current = sanitizeModelSettings(state.modelSettingsById[state.activeModel] ?? DEFAULT_MODEL_GENERATION_SETTINGS);
          const next = sanitizeModelSettings({ ...current, ...patch });
          return {
            modelSettingsById: {
              ...state.modelSettingsById,
              [state.activeModel]: next,
            },
            ...next,
          };
        }),
      applyCurrentSettingsToAllModels: (modelIds) =>
        set((state) => {
          const current = sanitizeModelSettings(state.modelSettingsById[state.activeModel] ?? DEFAULT_MODEL_GENERATION_SETTINGS);
          const baseIds = Object.keys(state.modelSettingsById);
          const allIds = new Set([state.activeModel, ...baseIds, ...(modelIds ?? [])].filter(Boolean));
          const modelSettingsById = { ...state.modelSettingsById };
          allIds.forEach((id) => {
            modelSettingsById[id] = { ...current };
          });
          return {
            modelSettingsById,
            ...current,
          };
        }),
      setTemperature: (temperature) =>
        set((state) => {
          const current = sanitizeModelSettings(state.modelSettingsById[state.activeModel] ?? DEFAULT_MODEL_GENERATION_SETTINGS);
          const next = sanitizeModelSettings({ ...current, temperature });
          return {
            modelSettingsById: {
              ...state.modelSettingsById,
              [state.activeModel]: next,
            },
            ...next,
          };
        }),
      setTopP: (topP) =>
        set((state) => {
          const current = sanitizeModelSettings(state.modelSettingsById[state.activeModel] ?? DEFAULT_MODEL_GENERATION_SETTINGS);
          const next = sanitizeModelSettings({ ...current, topP });
          return {
            modelSettingsById: {
              ...state.modelSettingsById,
              [state.activeModel]: next,
            },
            ...next,
          };
        }),
      setMaxTokens: (maxTokens) =>
        set((state) => {
          const current = sanitizeModelSettings(state.modelSettingsById[state.activeModel] ?? DEFAULT_MODEL_GENERATION_SETTINGS);
          const next = sanitizeModelSettings({ ...current, maxTokens });
          return {
            modelSettingsById: {
              ...state.modelSettingsById,
              [state.activeModel]: next,
            },
            ...next,
          };
        }),
      setPresencePenalty: (presencePenalty) =>
        set((state) => {
          const current = sanitizeModelSettings(state.modelSettingsById[state.activeModel] ?? DEFAULT_MODEL_GENERATION_SETTINGS);
          const next = sanitizeModelSettings({ ...current, presencePenalty });
          return {
            modelSettingsById: {
              ...state.modelSettingsById,
              [state.activeModel]: next,
            },
            ...next,
          };
        }),
      setFrequencyPenalty: (frequencyPenalty) =>
        set((state) => {
          const current = sanitizeModelSettings(state.modelSettingsById[state.activeModel] ?? DEFAULT_MODEL_GENERATION_SETTINGS);
          const next = sanitizeModelSettings({ ...current, frequencyPenalty });
          return {
            modelSettingsById: {
              ...state.modelSettingsById,
              [state.activeModel]: next,
            },
            ...next,
          };
        }),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setApiKeyModalOpen: (apiKeyModalOpen) => set({ apiKeyModalOpen }),
      setHasCompletedOnboarding: (hasCompletedOnboarding) => set({ hasCompletedOnboarding }),
    }),
    {
      name: "huiyan-settings",
      storage,
      partialize: (state) => ({
        apiKey: state.apiKey,
        userName: state.userName,
        userAvatarText: state.userAvatarText,
        activeModel: state.activeModel,
        activeImageModel: state.activeImageModel,
        generationMode: state.generationMode,
        enableThinking: state.enableThinking,
        modelSettingsById: state.modelSettingsById,
        temperature: state.temperature,
        topP: state.topP,
        maxTokens: state.maxTokens,
        presencePenalty: state.presencePenalty,
        frequencyPenalty: state.frequencyPenalty,
        sidebarCollapsed: state.sidebarCollapsed,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
      }),
    },
  ),
);
