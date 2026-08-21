"use client";

/**
 * @project LLMira
 * @file src/components/settings/ProviderSetupForm.test.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-21
 * @function
 *   - 验证 Provider 扫描后显式保存
 *   - 验证设备凭据库失败时显示可操作错误
 * @description Provider 设置表单的关键保存路径测试，不使用真实网络或设备凭据库。
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProviderModel } from "@llmira/contracts";
import { ProviderSetupForm } from "./ProviderSetupForm";
import { inspectProvider } from "@/lib/providers/inspect";
import { useSettingsStore } from "@/lib/store/settingsStore";

const runtimeState = vi.hoisted(() => ({ tauri: false, saveError: undefined as Error | undefined }));

vi.mock("@/lib/providers/runtime", () => ({
  isTauriRuntime: () => runtimeState.tauri,
  readProviderSecret: async () => undefined,
  saveProviderSecret: async () => {
    if (runtimeState.saveError) throw runtimeState.saveError;
  },
  deleteProviderSecret: async () => undefined,
  runtimeFetch: vi.fn(),
}));

vi.mock("@/lib/providers/inspect", () => ({ inspectProvider: vi.fn() }));

const mockedInspectProvider = vi.mocked(inspectProvider);

const scannedModel: ProviderModel = {
  providerId: "provider-1",
  id: "chat-model",
  name: "Chat Model",
  capabilities: { chat: true, vision: false, imageGeneration: false, reasoning: false, tools: false, nativeWebSearch: false },
  source: "upstream",
};

describe("ProviderSetupForm", () => {
  beforeEach(() => {
    runtimeState.tauri = false;
    runtimeState.saveError = undefined;
    mockedInspectProvider.mockReset();
    mockedInspectProvider.mockResolvedValue({ normalizedBaseUrl: "https://provider.example", models: [scannedModel], scannedAt: "2026-08-21T00:00:00.000Z" });
    useSettingsStore.setState({
      apiProfiles: [{ id: "provider-1", name: "测试 Provider", baseUrl: "https://provider.example", apiKey: "", modelPreset: "", protocol: "openai_compatible", executionMode: "device", scanStatus: "never", modelCatalog: [] }],
      activeApiProfileId: "provider-1",
      activeModel: "chat-model",
      activeImageModel: "",
      apiKey: "",
      hasCompletedOnboarding: false,
    });
  });

  it("扫描成功后显式保存 Provider 和密钥", async () => {
    render(<ProviderSetupForm showProfileList={false} />);
    fireEvent.change(screen.getByLabelText("API Key"), { target: { value: "test-key" } });
    fireEvent.click(screen.getByRole("button", { name: "连接并扫描" }));
    await screen.findByText("扫描到 1 个模型");
    fireEvent.click(screen.getByRole("button", { name: "明确保存 Provider" }));

    await screen.findByText("已安全保存，可以开始对话。");
    expect(useSettingsStore.getState().apiProfiles[0]?.apiKey).toBe("test-key");
    expect(useSettingsStore.getState().apiProfiles[0]?.scanStatus).toBe("ready");
  });

  it("设备凭据库失败时显示保存错误且不标记为已保存", async () => {
    runtimeState.tauri = true;
    runtimeState.saveError = new Error("Android Keystore unavailable");
    render(<ProviderSetupForm showProfileList={false} />);
    fireEvent.change(screen.getByLabelText("API Key"), { target: { value: "test-key" } });
    fireEvent.click(screen.getByRole("button", { name: "连接并扫描" }));
    await screen.findByText("扫描到 1 个模型");
    fireEvent.click(screen.getByRole("button", { name: "明确保存 Provider" }));

    await waitFor(() => expect(screen.getByText("保存失败：Android Keystore unavailable")).toBeInTheDocument());
    expect(screen.queryByText("已安全保存，可以开始对话。")).not.toBeInTheDocument();
    expect(useSettingsStore.getState().apiProfiles[0]?.scanStatus).toBe("never");
  });
});
