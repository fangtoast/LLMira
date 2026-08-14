"use client";

/**
 * @project LLMira
 * @file src/lib/store/settingsStore.ts
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-04-30
 * @function
 *   - Provider 元数据、模型、生成参数、侧栏状态等持久化设置
 * @description localStorage 只保存非敏感元数据；设备密钥由 Stronghold 适配器按需注入内存。
 */
import { create } from "zustand";
import { createJSONStorage, type StateStorage, persist } from "zustand/middleware";
import type { ExecutionMode, ProviderModel, ProviderProtocol } from "@llmira/contracts";
import { deleteProviderSecret, readProviderSecret, saveProviderSecret } from "@/lib/providers/runtime";

const DEFAULT_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.huiyan-ai.cn";
const DEFAULT_API_PROFILE_ID = "default";

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

export type ApiProfile = {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  modelPreset: string;
  protocol: ProviderProtocol;
  executionMode: ExecutionMode;
  scanStatus: "never" | "scanning" | "ready" | "failed";
  lastScannedAt?: string;
  scanError?: string;
  modelCatalog: ProviderModel[];
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

export function normalizeApiBaseUrl(value: string) {
  const trimmed = value.trim();
  const withoutTrailingSlash = trimmed.replace(/\/+$/g, "");
  return withoutTrailingSlash.replace(/\/v1$/i, "") || DEFAULT_API_BASE_URL;
}

function createDefaultApiProfile(apiKey = ""): ApiProfile {
  return {
    id: DEFAULT_API_PROFILE_ID,
    name: "慧言默认",
    baseUrl: normalizeApiBaseUrl(DEFAULT_API_BASE_URL),
    apiKey,
    modelPreset: process.env.NEXT_PUBLIC_MODEL_PRESET ?? "",
    protocol: "openai_compatible",
    executionMode: "device",
    scanStatus: "never",
    modelCatalog: [],
  };
}

function createApiProfileId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeApiProfile(input: Partial<ApiProfile> | undefined, fallbackApiKey = ""): ApiProfile {
  const fallback = createDefaultApiProfile(fallbackApiKey);
  return {
    id: input?.id?.trim() || fallback.id,
    name: input?.name?.trim() || fallback.name,
    baseUrl: normalizeApiBaseUrl(input?.baseUrl ?? fallback.baseUrl),
    apiKey: input?.apiKey ?? fallback.apiKey,
    modelPreset: input?.modelPreset ?? fallback.modelPreset,
    protocol: "openai_compatible",
    executionMode: input?.executionMode ?? fallback.executionMode,
    scanStatus: input?.scanStatus ?? fallback.scanStatus,
    lastScannedAt: input?.lastScannedAt,
    scanError: input?.scanError,
    modelCatalog: Array.isArray(input?.modelCatalog) ? input.modelCatalog : [],
  };
}

function parsePresetModels(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[,，\n]/g)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
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
  apiProfiles: ApiProfile[];
  activeApiProfileId: string;
  userName: string;
  userAvatarText: string;
  activeModel: string;
  activeImageModel: string;
  generationMode: "chat" | "image";
  webSearchMode: "off" | "auto" | "on";
  searchProvider: "searxng" | "tavily" | "brave";
  searchBaseUrl: string;
  searchApiKey: string;
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
  saveActiveApiKey: (key: string) => Promise<void>;
  hydrateProviderSecrets: () => Promise<void>;
  setProviderScanState: (profileId: string, state: Pick<ApiProfile, "scanStatus" | "lastScannedAt" | "scanError" | "modelCatalog" | "modelPreset" | "baseUrl">) => void;
  setActiveApiProfileId: (profileId: string) => void;
  addApiProfile: () => string;
  updateApiProfile: (profileId: string, patch: Partial<Omit<ApiProfile, "id">>) => void;
  deleteApiProfile: (profileId: string) => void;
  getActiveApiProfile: () => ApiProfile;
  getActiveProfilePresetModels: () => string[];
  setUserName: (name: string) => void;
  setUserAvatarText: (text: string) => void;
  setActiveModel: (model: string) => void;
  setActiveImageModel: (model: string) => void;
  setGenerationMode: (mode: "chat" | "image") => void;
  setWebSearchMode: (mode: "off" | "auto" | "on") => void;
  setSearchProfile: (patch: Partial<Pick<SettingsState, "searchProvider" | "searchBaseUrl" | "searchApiKey">>) => void;
  saveSearchApiKey: (key: string) => Promise<void>;
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
    (set, get) => ({
      apiKey: "",
      apiProfiles: [createDefaultApiProfile()],
      activeApiProfileId: DEFAULT_API_PROFILE_ID,
      userName: "Xiao",
      userAvatarText: "潇",
      activeModel: "gpt-5.5",
      activeImageModel: "gpt-image-1",
      generationMode: "chat",
      webSearchMode: "off",
      searchProvider: "searxng",
      searchBaseUrl: "",
      searchApiKey: "",
      enableThinking: false,
      modelSettingsById: {
        "gpt-5.5": DEFAULT_MODEL_GENERATION_SETTINGS,
      },
      ...DEFAULT_MODEL_GENERATION_SETTINGS,
      sidebarCollapsed: false,
      apiKeyModalOpen: false,
      hasCompletedOnboarding: false,
      setApiKey: (apiKey) =>
        set((state) => {
          const activeId = state.activeApiProfileId || state.apiProfiles[0]?.id || DEFAULT_API_PROFILE_ID;
          const profiles = state.apiProfiles.length ? state.apiProfiles : [createDefaultApiProfile()];
          return {
            apiKey,
            activeApiProfileId: activeId,
            apiProfiles: profiles.map((profile, idx) =>
              profile.id === activeId || (!profiles.some((item) => item.id === activeId) && idx === 0)
                ? { ...profile, apiKey }
                : profile,
            ),
          };
        }),
      saveActiveApiKey: async (apiKey) => {
        const activeId = get().activeApiProfileId;
        await saveProviderSecret(activeId, apiKey);
        get().setApiKey(apiKey);
      },
      hydrateProviderSecrets: async () => {
        const state = get();
        const [loaded, searchSecret] = await Promise.all([
          Promise.all(state.apiProfiles.map(async (profile) => [profile.id, await readProviderSecret(profile.id)] as const)),
          readProviderSecret(`search:${state.searchProvider}`),
        ]);
        const secrets = new Map(loaded.filter((item): item is readonly [string, string] => Boolean(item[1])));
        if (!secrets.size && !searchSecret) return;
        set((current) => {
          const apiProfiles = current.apiProfiles.map((profile) => ({ ...profile, apiKey: secrets.get(profile.id) ?? "" }));
          const active = apiProfiles.find((profile) => profile.id === current.activeApiProfileId) ?? apiProfiles[0];
          return { apiProfiles, apiKey: active?.apiKey ?? "", searchApiKey: searchSecret ?? "" };
        });
      },
      setProviderScanState: (profileId, scan) => set((state) => ({
        apiProfiles: state.apiProfiles.map((profile) => profile.id === profileId ? { ...profile, ...scan } : profile),
      })),
      setActiveApiProfileId: (activeApiProfileId) =>
        set((state) => {
          const profile = state.apiProfiles.find((item) => item.id === activeApiProfileId) ?? state.apiProfiles[0];
          if (!profile) return state;
          return {
            activeApiProfileId: profile.id,
            apiKey: profile.apiKey,
          };
        }),
      addApiProfile: () => {
        const id = createApiProfileId();
        set((state) => {
          const profile: ApiProfile = {
            id,
            name: `中转站 ${state.apiProfiles.length + 1}`,
            baseUrl: normalizeApiBaseUrl(DEFAULT_API_BASE_URL),
            apiKey: "",
            modelPreset: "",
            protocol: "openai_compatible",
            executionMode: "device",
            scanStatus: "never",
            modelCatalog: [],
          };
          return {
            apiProfiles: [...state.apiProfiles, profile],
            activeApiProfileId: id,
            apiKey: "",
          };
        });
        return id;
      },
      updateApiProfile: (profileId, patch) =>
        set((state) => {
          const profiles = state.apiProfiles.length ? state.apiProfiles : [createDefaultApiProfile(state.apiKey)];
          const nextProfiles = profiles.map((profile) => {
            if (profile.id !== profileId) return profile;
            return sanitizeApiProfile(
              {
                ...profile,
                ...patch,
                baseUrl: patch.baseUrl !== undefined ? normalizeApiBaseUrl(patch.baseUrl) : profile.baseUrl,
              },
              state.apiKey,
            );
          });
          const active = nextProfiles.find((profile) => profile.id === state.activeApiProfileId) ?? nextProfiles[0]!;
          return {
            apiProfiles: nextProfiles,
            activeApiProfileId: active.id,
            apiKey: active.apiKey,
          };
        }),
      deleteApiProfile: (profileId) => {
        void deleteProviderSecret(profileId);
        set((state) => {
          const profiles = state.apiProfiles.length ? state.apiProfiles : [createDefaultApiProfile(state.apiKey)];
          if (profiles.length <= 1) return state;
          const nextProfiles = profiles.filter((profile) => profile.id !== profileId);
          const active =
            state.activeApiProfileId === profileId
              ? nextProfiles[0]!
              : nextProfiles.find((profile) => profile.id === state.activeApiProfileId) ?? nextProfiles[0]!;
          return {
            apiProfiles: nextProfiles,
            activeApiProfileId: active.id,
            apiKey: active.apiKey,
          };
        });
      },
      getActiveApiProfile: () => {
        const state = get();
        return (
          state.apiProfiles.find((profile) => profile.id === state.activeApiProfileId) ??
          state.apiProfiles[0] ??
          createDefaultApiProfile(state.apiKey)
        );
      },
      getActiveProfilePresetModels: () => parsePresetModels(get().getActiveApiProfile().modelPreset),
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
      setWebSearchMode: (webSearchMode) => set({ webSearchMode }),
      setSearchProfile: (patch) => set(patch),
      saveSearchApiKey: async (searchApiKey) => {
        await saveProviderSecret(`search:${get().searchProvider}`, searchApiKey);
        set({ searchApiKey });
      },
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
      version: 3,
      storage,
      migrate: (persisted) => {
        const data = (persisted ?? {}) as Partial<SettingsState> & { apiKey?: string };
        const hadLegacyPlaintextSecret = Boolean(data.apiKey) || (Array.isArray(data.apiProfiles) && data.apiProfiles.some((profile) => Boolean(profile?.apiKey)));
        const profiles =
          Array.isArray(data.apiProfiles) && data.apiProfiles.length
            ? data.apiProfiles.map((profile) => sanitizeApiProfile({ ...profile, apiKey: "" }, ""))
            : [createDefaultApiProfile("")];
        const active =
          profiles.find((profile) => profile.id === data.activeApiProfileId) ??
          profiles[0]!;
        return {
          ...data,
          apiProfiles: profiles,
          activeApiProfileId: active.id,
          apiKey: "",
          hasCompletedOnboarding: hadLegacyPlaintextSecret ? false : data.hasCompletedOnboarding,
        };
      },
      partialize: (state) => ({
        apiKey: "",
        apiProfiles: state.apiProfiles.map((profile) => ({ ...profile, apiKey: "" })),
        activeApiProfileId: state.activeApiProfileId,
        userName: state.userName,
        userAvatarText: state.userAvatarText,
        activeModel: state.activeModel,
        activeImageModel: state.activeImageModel,
        generationMode: state.generationMode,
        webSearchMode: state.webSearchMode,
        searchProvider: state.searchProvider,
        searchBaseUrl: state.searchBaseUrl,
        searchApiKey: "",
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
