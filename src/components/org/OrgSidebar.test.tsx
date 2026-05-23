import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { useAppStore } from "@/stores/appStore";
import { OrgSidebar } from "./OrgSidebar";
import type { Agent } from "@/types";

function resetStore() {
  useAppStore.setState({
    agents: {},
    chats: {},
    activeChatId: null,
    messages: {},
    tasks: {},
    archives: [],
    scripts: {},
    knowledge: {},
    externalCollaborators: [],
    auditLogs: [],
    restMode: { enabled: false, rules: [] },
    installedPlugins: [],
    webhooks: [],
    abExperiments: [],
  });
}

describe("OrgSidebar UI 测试", () => {
  beforeEach(resetStore);

  it("空状态显示暂无 Agent 提示", () => {
    render(<OrgSidebar />);
    expect(screen.getByText(/暂无 Agent/)).toBeDefined();
  });

  it("显示组织架构标题", () => {
    render(<OrgSidebar />);
    expect(screen.getByText("组织架构")).toBeDefined();
  });

  it("显示会话标题", () => {
    render(<OrgSidebar />);
    expect(screen.getByText("会话")).toBeDefined();
  });

  it("有 Agent 时显示 Agent 名称", () => {
    const agent = useAppStore.getState().createAgent("营销主管", "supervisor", null) as Agent;
    render(<OrgSidebar />);
    expect(screen.getByText("营销主管")).toBeDefined();
  });

  it("有会话时显示会话名称", () => {
    useAppStore.getState().createChat("direct", "测试私聊", [
      { id: "user", name: "你", avatar: "user", role: "owner" },
    ]);
    render(<OrgSidebar />);
    expect(screen.getByText("测试私聊")).toBeDefined();
  });

  it("Agent 数量显示正确", () => {
    useAppStore.getState().createAgent("主管", "supervisor", null);
    useAppStore.getState().createAgent("专员", "specialist", null);
    render(<OrgSidebar />);
    expect(screen.getByText("2")).toBeDefined();
  });
});
