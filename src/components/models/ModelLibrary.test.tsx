/**
 * @project LLMira
 * @file src/components/models/ModelLibrary.test.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-14
 * @description 模型资料库搜索、收藏、键盘选择和移动 Sheet 测试。
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ModelLibrary } from "./ModelLibrary";
import { useSettingsStore } from "@/lib/store/settingsStore";

const viewport = vi.hoisted(() => ({ desktop: true }));
vi.mock("@/hooks/useMediaQuery", () => ({ useIsMdUp: () => viewport.desktop }));
vi.mock("@/hooks/useModels", () => ({
  useModelCatalog: () => [
    { providerId: "p1", id: "gpt-5", name: "GPT-5", family: "openai", familyLabel: "OpenAI", iconKey: "openai", favorite: false, capabilities: { chat: true, vision: true, imageGeneration: false, reasoning: true, tools: true, nativeWebSearch: true }, source: "rule" },
    { providerId: "p1", id: "deepseek-r1", name: "DeepSeek R1", family: "deepseek", familyLabel: "DeepSeek", iconKey: "deepseek", favorite: false, capabilities: { chat: true, vision: false, imageGeneration: false, reasoning: true, tools: true, nativeWebSearch: false }, source: "rule" },
    { providerId: "p1", id: "MiniMax-M2.5", name: "MiniMax M2.5", family: "minimax", familyLabel: "MiniMax", iconKey: "minimax", favorite: false, capabilities: { chat: true, vision: false, imageGeneration: true, reasoning: false, tools: true, nativeWebSearch: false }, source: "rule" },
    { providerId: "p1", id: "gpt-image-1", name: "GPT Image 1", family: "openai", familyLabel: "OpenAI", iconKey: "openai", favorite: false, capabilities: { chat: false, vision: false, imageGeneration: true, reasoning: false, tools: false, nativeWebSearch: false }, source: "rule" },
  ],
}));

describe("ModelLibrary", () => {
  beforeEach(() => {
    viewport.desktop = true;
    useSettingsStore.setState({ activeApiProfileId: "p1", favoriteModelsByProvider: {} });
  });

  it("支持搜索、收藏且收藏按钮不切换模型", () => {
    const onChange = vi.fn();
    render(<ModelLibrary value="gpt-5" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "选择模型" }));
    fireEvent.change(screen.getByPlaceholderText("搜索模型、ID 或家族"), { target: { value: "DeepSeek" } });
    expect(screen.getByText("DeepSeek R1")).toBeInTheDocument();
    expect(screen.queryByText("GPT-5")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "收藏 DeepSeek R1" }));
    expect(onChange).not.toHaveBeenCalled();
    expect(useSettingsStore.getState().favoriteModelsByProvider.p1).toEqual(["deepseek-r1"]);
  });

  it("Enter 选择当前键盘高亮项，Esc 关闭", () => {
    const onChange = vi.fn();
    render(<ModelLibrary value="gpt-5" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "选择模型" }));
    const input = screen.getByPlaceholderText("搜索模型、ID 或家族");
    fireEvent.change(input, { target: { value: "DeepSeek" } });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("deepseek-r1");
  });

  it("移动端使用全屏 Sheet", () => {
    viewport.desktop = false;
    render(<ModelLibrary value="gpt-5" onChange={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "选择模型" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("DeepSeek R1");
  });

  it("图片模式显示多用途和图片专用模型", () => {
    render(<ModelLibrary value="MiniMax-M2.5" capability="imageGeneration" onChange={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "选择模型" }));
    expect(screen.getByText("MiniMax M2.5")).toBeInTheDocument();
    expect(screen.getByText("GPT Image 1")).toBeInTheDocument();
    expect(screen.queryByText("DeepSeek R1")).not.toBeInTheDocument();
  });
});
