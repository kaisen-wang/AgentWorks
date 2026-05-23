import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { useAppStore } from "@/stores/appStore";
import { CostPanel } from "./CostPanel";
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

describe("CostPanel UI 测试", () => {
  beforeEach(resetStore);

  it("显示成本统计标题", () => {
    render(<CostPanel onClose={() => {}} />);
    expect(screen.getByText("成本统计")).toBeDefined();
  });

  it("显示总费用、总预算、API 调用标签", () => {
    render(<CostPanel onClose={() => {}} />);
    expect(screen.getByText("总费用")).toBeDefined();
    expect(screen.getByText("总预算")).toBeDefined();
    expect(screen.getByText("API 调用")).toBeDefined();
  });

  it("有 Agent 时显示各 Agent 费用标题", () => {
    useAppStore.getState().createAgent("营销主管", "supervisor", null) as Agent;
    render(<CostPanel onClose={() => {}} />);
    expect(screen.getByText("各 Agent 费用")).toBeDefined();
  });

  it("Agent 费用明细显示 Agent 名称", () => {
    useAppStore.getState().createAgent("设计专员", "specialist", null) as Agent;
    render(<CostPanel onClose={() => {}} />);
    expect(screen.getByText("设计专员")).toBeDefined();
  });
});
