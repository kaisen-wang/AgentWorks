import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { useAppStore } from "@/stores/appStore";
import { OrgChartView } from "./OrgChartView";
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

describe("OrgChartView UI 测试", () => {
  beforeEach(resetStore);

  it("显示组织架构图标题", () => {
    render(<OrgChartView onClose={() => {}} />);
    expect(screen.getByText("组织架构图")).toBeDefined();
  });

  it("空状态显示暂无 Agent", () => {
    render(<OrgChartView onClose={() => {}} />);
    expect(screen.getByText("暂无 Agent")).toBeDefined();
  });

  it("有 Agent 时显示老板节点", () => {
    useAppStore.getState().createAgent("营销主管", "supervisor", null) as Agent;
    render(<OrgChartView onClose={() => {}} />);
    expect(screen.getByText(/老板/)).toBeDefined();
  });

  it("有 Agent 时显示 Agent 名称", () => {
    useAppStore.getState().createAgent("营销主管", "supervisor", null) as Agent;
    render(<OrgChartView onClose={() => {}} />);
    expect(screen.getByText("营销主管")).toBeDefined();
  });

  it("显示层级关系", () => {
    const supervisor = useAppStore.getState().createAgent("营销主管", "supervisor", null) as Agent;
    useAppStore.getState().createAgent("设计专员", "specialist", supervisor.id);
    render(<OrgChartView onClose={() => {}} />);
    expect(screen.getByText("营销主管")).toBeDefined();
    expect(screen.getByText("设计专员")).toBeDefined();
  });
});
