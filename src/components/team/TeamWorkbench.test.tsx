/**
 * @project LLMira
 * @file src/components/team/TeamWorkbench.test.tsx
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-13
 * @description 验证知识来源、导航和逐次授权等核心工作台交互。
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TeamWorkbench } from "./TeamWorkbench";
import { TeamApiClient, type TeamSession } from "@/lib/team/api";

const session: TeamSession = {
  user: {
    userId: "test-user",
    organizationId: "test-org",
    email: "member@example.com",
    displayName: "测试成员",
  },
  workspace: {
    id: "test-workspace",
    name: "测试工作区",
    role: "workspace_owner",
  },
};

describe("TeamWorkbench", () => {
  it("opens a located citation", () => {
    render(<TeamWorkbench session={session} api={new TeamApiClient("http://localhost:4000")} preview />);
    fireEvent.click(screen.getByRole("button", { name: /查看来源 1/ }));
    expect(screen.getByRole("dialog")).toHaveTextContent("引用来源 1");
  });

  it("resolves one approval without persisting blanket permission", () => {
    render(<TeamWorkbench session={session} api={new TeamApiClient("http://localhost:4000")} preview />);
    fireEvent.click(screen.getAllByRole("button", { name: "仅本次允许" })[0]!);
    expect(screen.getAllByText("已允许本次操作").length).toBeGreaterThan(0);
  });

  it("moves settings out of the chat sidebar", async () => {
    render(<TeamWorkbench session={session} api={new TeamApiClient("http://localhost:4000")} preview />);
    fireEvent.click(screen.getByRole("button", { name: "设置" }));
    expect(await screen.findByRole("heading", { name: "设置" })).toBeInTheDocument();
  });

  it("submits a team run and renders resumable stream events", async () => {
    const api = new TeamApiClient("http://localhost:4000", "test-token");
    vi.spyOn(api, "createRun").mockResolvedValue({
      id: "019ffa8d-3db9-7b33-b2af-e63676d85b95",
      workspaceId: session.workspace.id,
      requestedBy: session.user.userId,
      title: "测试实时回答",
      prompt: "测试实时回答",
      status: "running",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    vi.spyOn(api, "streamRunEvents").mockImplementation(async (runId, onEvent) => {
      onEvent({ id: "event-1", runId, sequence: 1, type: "run.delta", createdAt: new Date().toISOString(), payload: { content: "这是实时回答。" } });
      onEvent({ id: "event-2", runId, sequence: 2, type: "run.completed", createdAt: new Date().toISOString(), payload: {} });
    });
    render(<TeamWorkbench session={session} api={api} />);
    fireEvent.change(screen.getByRole("textbox", { name: "向团队智能体提问" }), { target: { value: "测试实时回答" } });
    fireEvent.click(screen.getByRole("button", { name: "发送消息" }));
    await waitFor(() => expect(screen.getByText("这是实时回答。")).toBeInTheDocument());
    expect(screen.getByText("已完成")).toBeInTheDocument();
  });
});
