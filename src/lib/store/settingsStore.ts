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

interface SettingsState {
  apiKey: string;
  userName: string;
  userAvatarText: string;
  activeModel: string;
  activeImageModel: string;
  generationMode: "chat" | "image";
  enableThinking: boolean;
  temperature: number;
  topP: number;
  maxTokens: number;
  presencePenalty: number;
  frequencyPenalty: number;
  sidebarCollapsed: boolean;
  apiKeyModalOpen: boolean;
  setApiKey: (key: string) => void;
  setUserName: (name: string) => void;
  setUserAvatarText: (text: string) => void;
  setActiveModel: (model: string) => void;
  setActiveImageModel: (model: string) => void;
  setGenerationMode: (mode: "chat" | "image") => void;
  setEnableThinking: (enable: boolean) => void;
  setTemperature: (v: number) => void;
  setTopP: (v: number) => void;
  setMaxTokens: (v: number) => void;
  setPresencePenalty: (v: number) => void;
  setFrequencyPenalty: (v: number) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setApiKeyModalOpen: (open: boolean) => void;
}

/** 用户级设置（含密钥与模型选择），详见 `partialize` 持久化字段。 */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      apiKey: "",
      userName: "Xiao",
      userAvatarText: "潇",
      activeModel: "gpt-5-chat",
      activeImageModel: "gpt-image-1",
      generationMode: "chat",
      enableThinking: false,
      temperature: 0.7,
      topP: 1,
      maxTokens: 4096,
      presencePenalty: 0,
      frequencyPenalty: 0,
      sidebarCollapsed: false,
      apiKeyModalOpen: false,
      setApiKey: (apiKey) => set({ apiKey }),
      setUserName: (userName) => set({ userName: userName || "Xiao" }),
      setUserAvatarText: (userAvatarText) => set({ userAvatarText: (userAvatarText || "潇").slice(0, 2) }),
      setActiveModel: (activeModel) => set({ activeModel }),
      setActiveImageModel: (activeImageModel) => set({ activeImageModel }),
      setGenerationMode: (generationMode) => set({ generationMode }),
      setEnableThinking: (enableThinking) => set({ enableThinking }),
      setTemperature: (temperature) => set({ temperature }),
      setTopP: (topP) => set({ topP }),
      setMaxTokens: (maxTokens) => set({ maxTokens }),
      setPresencePenalty: (presencePenalty) => set({ presencePenalty }),
      setFrequencyPenalty: (frequencyPenalty) => set({ frequencyPenalty }),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setApiKeyModalOpen: (apiKeyModalOpen) => set({ apiKeyModalOpen }),
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
        temperature: state.temperature,
        topP: state.topP,
        maxTokens: state.maxTokens,
        presencePenalty: state.presencePenalty,
        frequencyPenalty: state.frequencyPenalty,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    },
  ),
);
