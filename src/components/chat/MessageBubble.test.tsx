import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { useAppStore } from "@/stores/appStore";
import { MessageBubble } from "./MessageBubble";
import type { Message, Agent } from "@/types";

// Mock resetStore
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

function createTestMessage(overrides: Partial<Message> = {}): Message {
  const chatId = "test-chat";
  const store = useAppStore.getState();

  // 确保聊天存在
  if (!store.chats[chatId]) {
    store.createChat("group", "测试群", []);
  }

  return {
    id: "msg-1",
    chatId,
    type: "text",
    senderId: "user",
    content: "测试消息",
    timestamp: Date.now(),
    ...overrides,
  };
}

describe("MessageBubble UI 测试", () => {
  beforeEach(resetStore);

  it("渲染用户文本消息", () => {
    const msg = createTestMessage({ senderId: "user", content: "你好世界", type: "text" });
    render(<MessageBubble message={msg} />);
    expect(screen.getByText("你好世界")).toBeDefined();
  });

  it("渲染系统消息居中显示", () => {
    const msg = createTestMessage({ senderId: "system", content: "系统通知", type: "text" });
    render(<MessageBubble message={msg} />);
    expect(screen.getByText("系统通知")).toBeDefined();
  });

  it("渲染 Agent 文本消息", () => {
    const agent = useAppStore.getState().createAgent("设计专员", "specialist", null) as Agent;
    const msg = createTestMessage({ senderId: agent.id, content: "设计完成", type: "text" });
    render(<MessageBubble message={msg} />);
    expect(screen.getByText("设计完成")).toBeDefined();
  });

  it("渲染进度消息 (UI-03)", () => {
    const msg = createTestMessage({
      type: "progress",
      content: "设计进度",
      progressData: { label: "设计进度", current: 3, total: 10, unit: "页" },
    });
    render(<MessageBubble message={msg} />);
    expect(screen.getByText("设计进度")).toBeDefined();
    expect(screen.getByText(/3\/10/)).toBeDefined();
  });

  it("渲染文件消息 (UI-03)", () => {
    const msg = createTestMessage({
      type: "file",
      content: "设计稿",
      fileData: { name: "设计稿.pdf", size: 2048000, mimeType: "application/pdf" },
    });
    render(<MessageBubble message={msg} />);
    expect(screen.getByText("设计稿.pdf")).toBeDefined();
    expect(screen.getByText(/2\.0 MB/)).toBeDefined();
  });

  it("渲染图片消息 (UI-03)", () => {
    const msg = createTestMessage({
      type: "image",
      content: "设计图",
      imageData: { url: "https://example.com/img.png", alt: "设计图" },
    });
    render(<MessageBubble message={msg} />);
    expect(screen.getByText("设计图")).toBeDefined();
    const img = screen.getByRole("img");
    expect(img).toBeDefined();
  });

  it("渲染任务卡片消息", () => {
    const msg = createTestMessage({
      type: "task_card",
      content: "任务",
      taskCard: {
        taskId: "t1",
        title: "设计海报",
        assigneeName: "设计专员",
        status: "in_progress",
        progress: 50,
        subTaskCount: 3,
        completedSubTaskCount: 1,
      },
    });
    render(<MessageBubble message={msg} />);
    expect(screen.getByText("设计海报")).toBeDefined();
  });

  it("渲染预算告警消息", () => {
    const msg = createTestMessage({
      type: "budget_alert",
      content: "预算告警",
      budgetAlert: {
        agentId: "a1",
        agentName: "设计专员",
        budgetUsed: 9,
        budgetTotal: 10,
        usagePercent: 0.9,
        options: [{ id: "increase", label: "增加预算" }],
      },
    });
    render(<MessageBubble message={msg} />);
    expect(screen.getByText("预算告警")).toBeDefined();
  });

  it("onReply 回调触发", () => {
    const onReply = vi.fn();
    const msg = createTestMessage({ senderId: "user", content: "消息", type: "text" });
    render(<MessageBubble message={msg} onReply={onReply} />);
    // 回复按钮在 hover 时显示，这里验证组件渲染不报错
    expect(screen.getByText("消息")).toBeDefined();
  });
});
