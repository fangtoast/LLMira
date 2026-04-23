"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  apiKey: string;
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

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      apiKey: "",
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
      partialize: (state) => ({
        apiKey: state.apiKey,
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
