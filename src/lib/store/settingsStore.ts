"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  apiKey: string;
  activeModel: string;
  activeImageModel: string;
  generationMode: "chat" | "image";
  enableThinking: boolean;
  sidebarCollapsed: boolean;
  apiKeyModalOpen: boolean;
  setApiKey: (key: string) => void;
  setActiveModel: (model: string) => void;
  setActiveImageModel: (model: string) => void;
  setGenerationMode: (mode: "chat" | "image") => void;
  setEnableThinking: (enable: boolean) => void;
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
      sidebarCollapsed: false,
      apiKeyModalOpen: false,
      setApiKey: (apiKey) => set({ apiKey }),
      setActiveModel: (activeModel) => set({ activeModel }),
      setActiveImageModel: (activeImageModel) => set({ activeImageModel }),
      setGenerationMode: (generationMode) => set({ generationMode }),
      setEnableThinking: (enableThinking) => set({ enableThinking }),
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
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    },
  ),
);
