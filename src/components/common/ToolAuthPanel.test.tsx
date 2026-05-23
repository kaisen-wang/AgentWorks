import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { useAppStore } from "@/stores/appStore";
import { ToolAuthPanel } from "./ToolAuthPanel";
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

describe("ToolAuthPanel UI 测试", () => {
  beforeEach(resetStore);

  it("显示工具授权标题", () => {
    render(<ToolAuthPanel onClose={() => {}} />);
    expect(screen.getByText("工具授权")).toBeDefined();
  });

  it("显示选择 Agent 标签", () => {
    render(<ToolAuthPanel onClose={() => {}} />);
    expect(screen.getByText("选择 Agent")).toBeDefined();
  });

  it("有 Agent 时显示 Agent 名称", () => {
    useAppStore.getState().createAgent("设计专员", "specialist", null, [
      { name: "design", description: "设计工具", tools: ["dall-e"] },
    ]) as Agent;
    render(<ToolAuthPanel onClose={() => {}} />);
    expect(screen.getByText("设计专员")).toBeDefined();
  });

  it("无 Agent 时不崩溃", () => {
    render(<ToolAuthPanel onClose={() => {}} />);
    expect(screen.getByText("选择 Agent")).toBeDefined();
  });
});
