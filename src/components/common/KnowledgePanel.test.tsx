import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useAppStore } from "@/stores/appStore";
import { KnowledgePanel } from "./KnowledgePanel";

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

describe("KnowledgePanel UI 测试", () => {
  beforeEach(resetStore);

  it("显示知识库标题", () => {
    render(<KnowledgePanel onClose={() => {}} />);
    expect(screen.getByText("知识库")).toBeDefined();
  });

  it("显示三个 scope 切换按钮", () => {
    render(<KnowledgePanel onClose={() => {}} />);
    expect(screen.getByText("全局")).toBeDefined();
    expect(screen.getByText("部门")).toBeDefined();
    expect(screen.getByText("个人")).toBeDefined();
  });

  it("空状态显示暂无知识条目", () => {
    render(<KnowledgePanel onClose={() => {}} />);
    expect(screen.getByText("暂无知识条目")).toBeDefined();
  });

  it("有知识条目时显示 key 和 value", () => {
    useAppStore.getState().addKnowledge("global", "brand_color", "#00FF00");
    render(<KnowledgePanel onClose={() => {}} />);
    expect(screen.getByText("brand_color")).toBeDefined();
    expect(screen.getByText("#00FF00")).toBeDefined();
  });

  it("切换到部门 scope", () => {
    useAppStore.getState().addKnowledge("department", "team_name", "设计组");
    render(<KnowledgePanel onClose={() => {}} />);
    fireEvent.click(screen.getByText("部门"));
    expect(screen.getByText("team_name")).toBeDefined();
  });
});
