/**
 * @project LLMira
 * @file src/components/chat/InputBar.test.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @description 输入区模型、联网与思考控件迁移测试。
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InputBar } from "./InputBar";
import { useSettingsStore } from "@/lib/store/settingsStore";

vi.mock("@/hooks/useMediaQuery", () => ({ useIsMdUp: () => true }));
vi.mock("@/hooks/useModels", () => ({
  useModelCatalog: () => [{ providerId: "default", id: "gpt-5.5", name: "GPT-5.5", family: "openai", familyLabel: "OpenAI", iconKey: "openai", favorite: false, capabilities: { chat: true, vision: true, imageGeneration: false, reasoning: true, tools: true, nativeWebSearch: true }, source: "rule" }],
}));

describe("InputBar controls", () => {
  it("在输入框底部提供附件、模型、联网和思考入口", () => {
    useSettingsStore.setState({ activeApiProfileId: "default", activeModel: "gpt-5.5", generationMode: "chat", webSearchMode: "auto", reasoningModeByProviderModel: { default: { "gpt-5.5": "medium" } } });
    render(<InputBar onSend={vi.fn()} onStop={vi.fn()} loading={false} />);
    expect(screen.getByLabelText("添加附件")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "选择模型" })).toHaveTextContent("gpt-5.5");
    expect(screen.getByRole("button", { name: /联网 自动/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /思考 均衡/ })).toBeInTheDocument();
    expect(screen.queryByText(/即将使用/)).not.toBeInTheDocument();
  });
});
