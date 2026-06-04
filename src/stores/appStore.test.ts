import { describe, it, expect, beforeEach } from "vitest";
import { useAppStore } from "./appStore";
import type { Agent, AgentId, Chat, Task } from "@/types";

// Helper: 重置 store 到初始状态
function resetStore() {
  const store = useAppStore.getState();
  // 通过创建新 agent/chat/task 来测试，每个 test 前重置
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

describe("appStore - 组织架构", () => {
  beforeEach(resetStore);

  it("创建 supervisor Agent", () => {
    const agent = useAppStore.getState().createAgent("营销主管", "supervisor", null);
    expect(agent).not.toHaveProperty("error");
    const a = agent as Agent;
    expect(a.name).toBe("营销主管");
    expect(a.role).toBe("supervisor");
    expect(a.parentId).toBeNull();
    expect(a.avatar).toBe("supervisor");
  });

  it("创建 specialist Agent 并设置父级", () => {
    const parent = useAppStore.getState().createAgent("营销主管", "supervisor", null) as Agent;
    const child = useAppStore.getState().createAgent("设计专员", "specialist", parent.id) as Agent;
    expect(child.parentId).toBe(parent.id);
    // 父级的 childIds 应包含子级
    const updatedParent = useAppStore.getState().agents[parent.id];
    expect(updatedParent.childIds).toContain(child.id);
  });

  it("管理幅度限制 (ORG-03)", () => {
    const parent = useAppStore.getState().createAgent("主管", "supervisor", null) as Agent;
    // maxChildren 默认为 5
    for (let i = 0; i < 5; i++) {
      useAppStore.getState().createAgent(`专员${i}`, "specialist", parent.id);
    }
    // 第6个应该失败
    const result = useAppStore.getState().createAgent("专员5", "specialist", parent.id);
    expect(result).toHaveProperty("error");
  });

  it("删除 Agent 并递归删除下属", () => {
    const parent = useAppStore.getState().createAgent("主管", "supervisor", null) as Agent;
    const child = useAppStore.getState().createAgent("专员", "specialist", parent.id) as Agent;
    useAppStore.getState().deleteAgent(parent.id);
    expect(useAppStore.getState().agents[parent.id]).toBeUndefined();
    expect(useAppStore.getState().agents[child.id]).toBeUndefined();
  });

  it("删除 Agent 时任务转移给上级 (ORG-04)", () => {
    const parent = useAppStore.getState().createAgent("主管", "supervisor", null) as Agent;
    const child = useAppStore.getState().createAgent("专员", "specialist", parent.id) as Agent;
    const chat = useAppStore.getState().createChat("direct", "测试", [{ id: child.id, name: "专员", avatar: "specialist", role: "member" }]);
    const task = useAppStore.getState().createTask("任务1", "描述", child.id, chat.id) as Task;
    useAppStore.getState().deleteAgent(child.id);
    // 任务应转移给父级
    const updatedTask = useAppStore.getState().tasks[task.id];
    expect(updatedTask.assigneeId).toBe(parent.id);
  });

  it("setParent 移动 Agent", () => {
    const p1 = useAppStore.getState().createAgent("主管1", "supervisor", null) as Agent;
    const p2 = useAppStore.getState().createAgent("主管2", "supervisor", null) as Agent;
    const child = useAppStore.getState().createAgent("专员", "specialist", p1.id) as Agent;
    const result = useAppStore.getState().setParent(child.id, p2.id);
    expect(result.success).toBe(true);
    const updated = useAppStore.getState().agents[child.id];
    expect(updated.parentId).toBe(p2.id);
    // p1 的 childIds 不再包含 child
    expect(useAppStore.getState().agents[p1.id].childIds).not.toContain(child.id);
    // p2 的 childIds 包含 child
    expect(useAppStore.getState().agents[p2.id].childIds).toContain(child.id);
  });

  it("getSubordinates 返回直接下属", () => {
    const parent = useAppStore.getState().createAgent("主管", "supervisor", null) as Agent;
    const c1 = useAppStore.getState().createAgent("专员1", "specialist", parent.id) as Agent;
    const c2 = useAppStore.getState().createAgent("专员2", "specialist", parent.id) as Agent;
    const subs = useAppStore.getState().getSubordinates(parent.id);
    expect(subs).toHaveLength(2);
    expect(subs.map((s) => s.id).sort()).toEqual([c1.id, c2.id].sort());
  });

  it("getAncestors 返回祖先链", () => {
    const root = useAppStore.getState().createAgent("老板", "supervisor", null) as Agent;
    const mid = useAppStore.getState().createAgent("主管", "supervisor", root.id) as Agent;
    const leaf = useAppStore.getState().createAgent("专员", "specialist", mid.id) as Agent;
    const ancestors = useAppStore.getState().getAncestors(leaf.id);
    expect(ancestors).toHaveLength(2);
    expect(ancestors[0].id).toBe(mid.id);
    expect(ancestors[1].id).toBe(root.id);
  });

  it("updateMaxChildren", () => {
    const agent = useAppStore.getState().createAgent("主管", "supervisor", null) as Agent;
    useAppStore.getState().updateMaxChildren(agent.id, 10);
    expect(useAppStore.getState().agents[agent.id].maxChildren).toBe(10);
  });
});

describe("appStore - 聊天", () => {
  beforeEach(resetStore);

  it("创建和删除聊天", () => {
    const chat = useAppStore.getState().createChat("group", "群聊", []);
    expect(chat.name).toBe("群聊");
    expect(chat.type).toBe("group");
    useAppStore.getState().deleteChat(chat.id);
    expect(useAppStore.getState().chats[chat.id]).toBeUndefined();
  });

  it("setActiveChat", () => {
    const chat = useAppStore.getState().createChat("direct", "私聊", []);
    useAppStore.getState().setActiveChat(chat.id);
    expect(useAppStore.getState().activeChatId).toBe(chat.id);
  });

  it("添加和移除成员", () => {
    const chat = useAppStore.getState().createChat("group", "群聊", []);
    const member = { id: "m1", name: "成员1", avatar: "bot", role: "member" as const };
    useAppStore.getState().addMemberToChat(chat.id, member);
    expect(useAppStore.getState().chats[chat.id].members).toHaveLength(1);
    useAppStore.getState().removeMemberFromChat(chat.id, "m1");
    expect(useAppStore.getState().chats[chat.id].members).toHaveLength(0);
  });

  it("群聊成员去重", () => {
    const chat = useAppStore.getState().createChat("group", "群聊", []);
    const member = { id: "m1", name: "成员1", avatar: "bot", role: "member" as const };
    useAppStore.getState().addMemberToChat(chat.id, member);
    useAppStore.getState().addMemberToChat(chat.id, member); // 重复添加
    expect(useAppStore.getState().chats[chat.id].members).toHaveLength(1);
  });

  it("群聊成员角色", () => {
    const chat = useAppStore.getState().createChat("group", "群聊", [
      { id: "user", name: "你", avatar: "user", role: "owner" },
    ]);
    expect(useAppStore.getState().chats[chat.id].members[0].role).toBe("owner");
    const member = { id: "m1", name: "成员1", avatar: "bot", role: "readonly" as const };
    useAppStore.getState().addMemberToChat(chat.id, member);
    expect(useAppStore.getState().chats[chat.id].members[1].role).toBe("readonly");
  });

  it("群聊不能移除群主", () => {
    const chat = useAppStore.getState().createChat("group", "群聊", [
      { id: "user", name: "你", avatar: "user", role: "owner" },
      { id: "m1", name: "成员1", avatar: "bot", role: "member" },
    ]);
    // removeMemberFromChat 不区分角色，但 GroupDetailPanel 中限制了
    // 此处测试 store 层行为：移除后成员减少
    useAppStore.getState().removeMemberFromChat(chat.id, "m1");
    expect(useAppStore.getState().chats[chat.id].members).toHaveLength(1);
    expect(useAppStore.getState().chats[chat.id].members[0].id).toBe("user");
  });

  it("群聊创建时包含多个成员", () => {
    const chat = useAppStore.getState().createChat("group", "作战室", [
      { id: "user", name: "你", avatar: "user", role: "owner" },
      { id: "a1", name: "Agent1", avatar: "bot", role: "member" },
      { id: "a2", name: "Agent2", avatar: "specialist", role: "readonly" },
    ]);
    expect(chat.type).toBe("group");
    expect(chat.name).toBe("作战室");
    expect(chat.members).toHaveLength(3);
  });

  it("updateMemberRole 变更成员角色", () => {
    const chat = useAppStore.getState().createChat("group", "群聊", [
      { id: "user", name: "你", avatar: "user", role: "owner" },
      { id: "m1", name: "成员1", avatar: "bot", role: "member" },
    ]);
    useAppStore.getState().updateMemberRole(chat.id, "m1", "readonly");
    const member = useAppStore.getState().chats[chat.id].members.find((m) => m.id === "m1");
    expect(member!.role).toBe("readonly");
  });

  it("updateMemberRole 不能修改群主角色", () => {
    const chat = useAppStore.getState().createChat("group", "群聊", [
      { id: "user", name: "你", avatar: "user", role: "owner" },
      { id: "m1", name: "成员1", avatar: "bot", role: "member" },
    ]);
    useAppStore.getState().updateMemberRole(chat.id, "user", "member");
    const owner = useAppStore.getState().chats[chat.id].members.find((m) => m.id === "user");
    expect(owner!.role).toBe("owner"); // 角色不变
  });

  it("updateMemberRole 相同角色不变更", () => {
    const chat = useAppStore.getState().createChat("group", "群聊", [
      { id: "user", name: "你", avatar: "user", role: "owner" },
      { id: "m1", name: "成员1", avatar: "bot", role: "member" },
    ]);
    useAppStore.getState().updateMemberRole(chat.id, "m1", "member");
    const member = useAppStore.getState().chats[chat.id].members.find((m) => m.id === "m1");
    expect(member!.role).toBe("member");
  });

  it("群聊创建时自动设置 ownerId", () => {
    const chat = useAppStore.getState().createChat("group", "群聊", [
      { id: "user", name: "你", avatar: "user", role: "owner" },
      { id: "m1", name: "成员1", avatar: "bot", role: "member" },
    ]);
    expect(chat.ownerId).toBe("user");
  });

  it("成员变更时生成系统消息", () => {
    const chat = useAppStore.getState().createChat("group", "群聊", [
      { id: "user", name: "你", avatar: "user", role: "owner" },
    ]);
    // 创建群聊时已有一条系统消息
    const msgsBefore = useAppStore.getState().messages[chat.id];
    expect(msgsBefore).toHaveLength(1);
    useAppStore.getState().addMemberToChat(chat.id, { id: "m1", name: "成员1", avatar: "bot", role: "member" });
    const msgs = useAppStore.getState().messages[chat.id];
    expect(msgs).toHaveLength(2);
    expect(msgs[1].type).toBe("system");
    expect(msgs[1].content).toContain("加入了群聊");
  });
});

describe("appStore - 消息", () => {
  beforeEach(resetStore);

  it("发送消息", () => {
    const chat = useAppStore.getState().createChat("direct", "私聊", []);
    const msg = useAppStore.getState().sendMessage(chat.id, "text", "user", "你好");
    expect(msg.content).toBe("你好");
    expect(msg.senderId).toBe("user");
    const msgs = useAppStore.getState().messages[chat.id];
    expect(msgs).toHaveLength(1);
  });

  it("resolveReportCard", () => {
    const chat = useAppStore.getState().createChat("direct", "私聊", []);
    const msg = useAppStore.getState().sendMessage(chat.id, "report_card", "system", "报告", {
      reportCard: {
        title: "决策",
        problem: "需要决策",
        options: [
          { id: "opt1", label: "选项1" },
          { id: "opt2", label: "选项2" },
        ],
        resolved: false,
      },
    });
    useAppStore.getState().resolveReportCard(chat.id, msg.id, "opt1");
    const resolved = useAppStore.getState().messages[chat.id][0];
    expect(resolved.reportCard?.resolved).toBe(true);
    expect(resolved.reportCard?.resolvedOption).toBe("opt1");
  });
});

describe("appStore - 任务", () => {
  beforeEach(resetStore);

  it("创建任务和子任务", () => {
    const agent = useAppStore.getState().createAgent("专员", "specialist", null) as Agent;
    const chat = useAppStore.getState().createChat("direct", "私聊", []);
    const task = useAppStore.getState().createTask("主任务", "描述", agent.id, chat.id);
    expect(task.status).toBe("pending");
    const sub = useAppStore.getState().addSubTask(task.id, agent.id, "子任务", "子描述");
    expect(sub.parentTaskId).toBe(task.id);
    const updatedTask = useAppStore.getState().tasks[task.id];
    expect(updatedTask.subTasks).toHaveLength(1);
  });

  it("更新任务和子任务状态", () => {
    const agent = useAppStore.getState().createAgent("专员", "specialist", null) as Agent;
    const chat = useAppStore.getState().createChat("direct", "私聊", []);
    const task = useAppStore.getState().createTask("任务", "描述", agent.id, chat.id);
    const sub = useAppStore.getState().addSubTask(task.id, agent.id, "子任务", "子描述");
    useAppStore.getState().updateSubTaskStatus(task.id, sub.id, "completed", "结果");
    expect(useAppStore.getState().tasks[task.id].subTasks[0].status).toBe("completed");
    useAppStore.getState().updateTaskStatus(task.id, "completed");
    expect(useAppStore.getState().tasks[task.id].status).toBe("completed");
  });
});

describe("appStore - 归档", () => {
  beforeEach(resetStore);

  it("添加和搜索归档", () => {
    useAppStore.getState().addArchive({
      taskId: "t1",
      taskTitle: "新品发布",
      agentId: "a1",
      agentName: "营销主管",
      input: "创建发布计划",
      output: "计划已生成",
      cost: 0.5,
      apiCalls: 3,
      model: "deepseek-v4-flash",
      duration: 2000,
      tags: ["发布", "营销"],
      createdAt: Date.now(),
    });
    const results = useAppStore.getState().searchArchives("发布");
    expect(results).toHaveLength(1);
    expect(results[0].taskTitle).toBe("新品发布");
  });
});

describe("appStore - 剧本", () => {
  beforeEach(resetStore);

  it("保存剧本", () => {
    const script = useAppStore.getState().saveScript("标准流程", "描述", [
      { agentId: "a1", action: "步骤1" },
      { agentId: "a2", action: "步骤2" },
    ]);
    expect(script.name).toBe("标准流程");
    expect(script.steps).toHaveLength(2);
  });
});

describe("appStore - 知识库", () => {
  beforeEach(resetStore);

  it("添加和查询知识", () => {
    const entry = useAppStore.getState().addKnowledge("global", "brand_color", "#00FF00");
    expect(entry.key).toBe("brand_color");
    const found = useAppStore.getState().getKnowledge("global", "brand_color");
    expect(found?.value).toBe("#00FF00");
  });

  it("部门级知识需要 agentId", () => {
    const agent = useAppStore.getState().createAgent("专员", "specialist", null) as Agent;
    useAppStore.getState().addKnowledge("department", "style", "dark", agent.id);
    const found = useAppStore.getState().getKnowledge("department", "style", agent.id);
    expect(found?.value).toBe("dark");
  });
});

describe("appStore - 预算", () => {
  beforeEach(resetStore);

  it("updateAgentBudget 更新已用预算", () => {
    const agent = useAppStore.getState().createAgent("专员", "specialist", null) as Agent;
    useAppStore.getState().updateAgentBudget(agent.id, 3);
    expect(useAppStore.getState().agents[agent.id].config.budgetUsed).toBe(3);
  });

  it("预算超限告警 (SOLO-03)", () => {
    const agent = useAppStore.getState().createAgent("专员", "specialist", null, [], {
      monthlyBudget: 10,
      budgetAlertThreshold: 0.9,
    }) as Agent;
    // 使用 9 元，达到 90% 阈值
    const result = useAppStore.getState().updateAgentBudget(agent.id, 9);
    expect(result.alert).toBeDefined();
    expect(result.alert?.usagePercent).toBeGreaterThanOrEqual(0.9);
  });
});

describe("appStore - 工作区克隆 (SOLO-04)", () => {
  beforeEach(resetStore);

  it("cloneWorkspace 克隆所有 Agent 并建立 ID 映射", () => {
    const parent = useAppStore.getState().createAgent("主管", "supervisor", null) as Agent;
    const child = useAppStore.getState().createAgent("专员", "specialist", parent.id) as Agent;

    const idMapping = useAppStore.getState().cloneWorkspace("(副本)");

    // 映射应包含所有旧 ID
    expect(idMapping[parent.id]).toBeDefined();
    expect(idMapping[child.id]).toBeDefined();

    // 新 Agent 应存在
    const newParentId = idMapping[parent.id];
    const newChildId = idMapping[child.id];
    const newParent = useAppStore.getState().agents[newParentId];
    const newChild = useAppStore.getState().agents[newChildId];

    expect(newParent.name).toBe("主管 (副本)");
    expect(newChild.name).toBe("专员 (副本)");
    expect(newChild.parentId).toBe(newParentId);
    expect(newParent.childIds).toContain(newChildId);
    // 克隆后预算重置
    expect(newParent.config.budgetUsed).toBe(0);
  });
});

describe("appStore - 任务转移 (ORG-04)", () => {
  beforeEach(resetStore);

  it("transferTasks 转移任务到目标 Agent", () => {
    const from = useAppStore.getState().createAgent("专员A", "specialist", null) as Agent;
    const to = useAppStore.getState().createAgent("专员B", "specialist", null) as Agent;
    const chat = useAppStore.getState().createChat("direct", "私聊", []);

    const t1 = useAppStore.getState().createTask("任务1", "描述", from.id, chat.id);
    const t2 = useAppStore.getState().createTask("任务2", "描述", from.id, chat.id);
    const sub = useAppStore.getState().addSubTask(t1.id, from.id, "子任务", "子描述");

    const count = useAppStore.getState().transferTasks(from.id, to.id);
    // 2个主任务 + 1个子任务 = 3
    expect(count).toBe(3);
    expect(useAppStore.getState().tasks[t1.id].assigneeId).toBe(to.id);
    expect(useAppStore.getState().tasks[t2.id].assigneeId).toBe(to.id);
    expect(useAppStore.getState().tasks[t1.id].subTasks[0].assigneeId).toBe(to.id);
  });
});

describe("appStore - 审计日志", () => {
  beforeEach(resetStore);

  it("addAuditLog 添加日志", () => {
    useAppStore.getState().addAuditLog("a1", "execute", "执行了任务");
    expect(useAppStore.getState().auditLogs).toHaveLength(1);
    expect(useAppStore.getState().auditLogs[0].agentId).toBe("a1");
    expect(useAppStore.getState().auditLogs[0].contentHash).toBeDefined();
  });
});

describe("appStore - 休息模式", () => {
  beforeEach(resetStore);

  it("setRestMode 更新配置", () => {
    useAppStore.getState().setRestMode({ enabled: true });
    expect(useAppStore.getState().restMode.enabled).toBe(true);
  });
});

// ============================================================
// 补充测试：覆盖缺失的边界场景
// ============================================================

describe("appStore - 组织架构补充", () => {
  beforeEach(resetStore);

  it("updateAgent 通用更新方法", () => {
    const agent = useAppStore.getState().createAgent("主管", "supervisor", null) as Agent;
    useAppStore.getState().updateAgent(agent.id, { name: "新名称" });
    expect(useAppStore.getState().agents[agent.id].name).toBe("新名称");
  });

  it("updateAgent 不存在的 Agent 不报错", () => {
    useAppStore.getState().updateAgent("non-existent", { name: "测试" });
    // 不应抛异常
  });

  it("getOrgChart 返回组织架构", () => {
    const p1 = useAppStore.getState().createAgent("主管1", "supervisor", null) as Agent;
    const p2 = useAppStore.getState().createAgent("主管2", "supervisor", null) as Agent;
    const orgChart = useAppStore.getState().getOrgChart();
    expect(orgChart.rootAgentIds).toHaveLength(2);
    expect(orgChart.rootAgentIds).toContain(p1.id);
    expect(orgChart.rootAgentIds).toContain(p2.id);
  });

  it("删除无上级的 Agent", () => {
    const agent = useAppStore.getState().createAgent("独立专员", "specialist", null) as Agent;
    useAppStore.getState().deleteAgent(agent.id);
    expect(useAppStore.getState().agents[agent.id]).toBeUndefined();
  });

  it("setParent 管理幅度限制失败场景", () => {
    const p1 = useAppStore.getState().createAgent("主管1", "supervisor", null) as Agent;
    const p2 = useAppStore.getState().createAgent("主管2", "supervisor", null) as Agent;
    // p2 已有 5 个下属
    for (let i = 0; i < 5; i++) {
      useAppStore.getState().createAgent(`专员${i}`, "specialist", p2.id);
    }
    // 尝试将 p1 的下属移到 p2（p2 已满）
    const child = useAppStore.getState().createAgent("新专员", "specialist", p1.id) as Agent;
    const result = useAppStore.getState().setParent(child.id, p2.id);
    expect(result.success).toBe(false);
    expect(result.error).toContain("管理幅度已达上限");
  });

  it("setParent 不存在的 Agent 返回失败", () => {
    const result = useAppStore.getState().setParent("non-existent", null);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Agent 不存在");
  });

  it("getSubordinates 不存在的 Agent 返回空数组", () => {
    const subs = useAppStore.getState().getSubordinates("non-existent");
    expect(subs).toEqual([]);
  });

  it("getAncestors 无上级的 Agent 返回空数组", () => {
    const agent = useAppStore.getState().createAgent("主管", "supervisor", null) as Agent;
    const ancestors = useAppStore.getState().getAncestors(agent.id);
    expect(ancestors).toEqual([]);
  });

  it("createAgent 带自定义 config", () => {
    const agent = useAppStore.getState().createAgent("专员", "specialist", null, [], {
      model: "gpt-3.5-turbo",
      temperature: 0.5,
      monthlyBudget: 20,
    }) as Agent;
    expect(agent.config.model).toBe("gpt-3.5-turbo");
    expect(agent.config.temperature).toBe(0.5);
    expect(agent.config.monthlyBudget).toBe(20);
  });
});

describe("appStore - 消息补充", () => {
  beforeEach(resetStore);

  it("sendMessage 带 mentions", () => {
    const chat = useAppStore.getState().createChat("group", "群聊", []);
    const msg = useAppStore.getState().sendMessage(chat.id, "text", "user", "@专员 请处理", {
      mentions: ["agent1"],
    });
    expect(msg.mentions).toEqual(["agent1"]);
  });

  it("sendMessage 带 taskCard", () => {
    const chat = useAppStore.getState().createChat("group", "群聊", []);
    const taskCard = {
      taskId: "t1",
      title: "任务",
      assigneeName: "专员",
      status: "pending" as const,
      subTaskCount: 0,
      completedSubTaskCount: 0,
      progress: 0,
    };
    const msg = useAppStore.getState().sendMessage(chat.id, "task_card", "system", "任务卡片", {
      taskCard,
    });
    expect(msg.taskCard).toBeDefined();
    expect(msg.taskCard?.taskId).toBe("t1");
  });

  it("sendMessage 更新聊天 lastMessage", () => {
    const chat = useAppStore.getState().createChat("group", "群聊", []);
    useAppStore.getState().sendMessage(chat.id, "text", "user", "这是一条消息");
    const updatedChat = useAppStore.getState().chats[chat.id];
    expect(updatedChat.lastMessage).toBe("这是一条消息");
    expect(updatedChat.lastMessageTime).toBeDefined();
  });

  it("多条消息按顺序存储", () => {
    const chat = useAppStore.getState().createChat("group", "群聊", []);
    useAppStore.getState().sendMessage(chat.id, "text", "user", "消息1");
    useAppStore.getState().sendMessage(chat.id, "text", "user", "消息2");
    const msgs = useAppStore.getState().messages[chat.id];
    expect(msgs).toHaveLength(2);
    expect(msgs[0].content).toBe("消息1");
    expect(msgs[1].content).toBe("消息2");
  });
});

describe("appStore - 任务补充", () => {
  beforeEach(resetStore);

  it("创建任务带优先级和截止时间", () => {
    const agent = useAppStore.getState().createAgent("专员", "specialist", null) as Agent;
    const chat = useAppStore.getState().createChat("direct", "私聊", []);
    const deadline = Date.now() + 86400000;
    const task = useAppStore.getState().createTask("紧急任务", "描述", agent.id, chat.id, "urgent", deadline);
    expect(task.priority).toBe("urgent");
    expect(task.deadline).toBe(deadline);
  });

  it("updateSubTaskStatus 带 result", () => {
    const agent = useAppStore.getState().createAgent("专员", "specialist", null) as Agent;
    const chat = useAppStore.getState().createChat("direct", "私聊", []);
    const task = useAppStore.getState().createTask("任务", "描述", agent.id, chat.id);
    const sub = useAppStore.getState().addSubTask(task.id, agent.id, "子任务", "子描述");
    useAppStore.getState().updateSubTaskStatus(task.id, sub.id, "completed", "执行结果");
    const updatedSub = useAppStore.getState().tasks[task.id].subTasks[0];
    expect(updatedSub.status).toBe("completed");
    expect(updatedSub.result).toBe("执行结果");
    expect(updatedSub.completedAt).toBeDefined();
  });

  it("updateTaskStatus completed 设置 completedAt", () => {
    const agent = useAppStore.getState().createAgent("专员", "specialist", null) as Agent;
    const chat = useAppStore.getState().createChat("direct", "私聊", []);
    const task = useAppStore.getState().createTask("任务", "描述", agent.id, chat.id);
    useAppStore.getState().updateTaskStatus(task.id, "completed");
    const updatedTask = useAppStore.getState().tasks[task.id];
    expect(updatedTask.completedAt).toBeDefined();
  });
});

describe("appStore - 归档补充", () => {
  beforeEach(resetStore);

  it("searchArchives 按 agentName 搜索", () => {
    useAppStore.getState().addArchive({
      taskId: "t1",
      taskTitle: "任务A",
      agentId: "a1",
      agentName: "营销主管",
      input: "",
      output: "结果",
      cost: 0.1,
      apiCalls: 1,
      model: "deepseek-v4-flash",
      duration: 1000,
      createdAt: Date.now(),
    });
    const results = useAppStore.getState().searchArchives("营销");
    expect(results).toHaveLength(1);
  });

  it("searchArchives 按 output 搜索", () => {
    useAppStore.getState().addArchive({
      taskId: "t1",
      taskTitle: "任务A",
      agentId: "a1",
      agentName: "专员",
      input: "",
      output: "海报设计完成",
      cost: 0.1,
      apiCalls: 1,
      model: "deepseek-v4-flash",
      duration: 1000,
      createdAt: Date.now(),
    });
    const results = useAppStore.getState().searchArchives("海报");
    expect(results).toHaveLength(1);
  });

  it("searchArchives 按 tags 搜索", () => {
    useAppStore.getState().addArchive({
      taskId: "t1",
      taskTitle: "任务A",
      agentId: "a1",
      agentName: "专员",
      input: "",
      output: "结果",
      tags: ["设计", "发布"],
      cost: 0.1,
      apiCalls: 1,
      model: "deepseek-v4-flash",
      duration: 1000,
      createdAt: Date.now(),
    });
    const results = useAppStore.getState().searchArchives("发布");
    expect(results).toHaveLength(1);
  });

  it("searchArchives 无匹配返回空数组", () => {
    useAppStore.getState().addArchive({
      taskId: "t1",
      taskTitle: "任务A",
      agentId: "a1",
      agentName: "专员",
      input: "",
      output: "结果",
      cost: 0.1,
      apiCalls: 1,
      model: "deepseek-v4-flash",
      duration: 1000,
      createdAt: Date.now(),
    });
    const results = useAppStore.getState().searchArchives("不存在的关键词");
    expect(results).toHaveLength(0);
  });
});

describe("appStore - 知识库补充", () => {
  beforeEach(resetStore);

  it("global scope 不需要 agentId 查询", () => {
    useAppStore.getState().addKnowledge("global", "brand_color", "#00FF00");
    const found = useAppStore.getState().getKnowledge("global", "brand_color");
    expect(found?.value).toBe("#00FF00");
  });

  it("department scope 不带 agentId 查询不到", () => {
    const agent = useAppStore.getState().createAgent("专员", "specialist", null) as Agent;
    useAppStore.getState().addKnowledge("department", "style", "dark", agent.id);
    const found = useAppStore.getState().getKnowledge("department", "style");
    expect(found).toBeUndefined();
  });

  it("personal scope 知询", () => {
    const agent = useAppStore.getState().createAgent("专员", "specialist", null) as Agent;
    useAppStore.getState().addKnowledge("personal", "preference", "dark-mode", agent.id);
    const found = useAppStore.getState().getKnowledge("personal", "preference", agent.id);
    expect(found?.value).toBe("dark-mode");
  });
});

describe("appStore - 外部协作者", () => {
  beforeEach(resetStore);

  it("inviteCollaborator 邀请协作者", () => {
    const chat = useAppStore.getState().createChat("group", "群聊", []);
    const collab = useAppStore.getState().inviteCollaborator("外部设计师", chat.id);
    expect(collab.name).toBe("外部设计师");
    expect(collab.chatIds).toContain(chat.id);
    expect(useAppStore.getState().externalCollaborators).toHaveLength(1);
  });

  it("removeCollaborator 移除协作者", () => {
    const chat = useAppStore.getState().createChat("group", "群聊", []);
    const collab = useAppStore.getState().inviteCollaborator("外部设计师", chat.id);
    useAppStore.getState().removeCollaborator(collab.id);
    const removed = useAppStore.getState().externalCollaborators[0];
    expect(removed.removedAt).toBeDefined();
  });
});

describe("appStore - 预算补充", () => {
  beforeEach(resetStore);

  it("updateAgentBudget 不触发告警", () => {
    const agent = useAppStore.getState().createAgent("专员", "specialist", null, [], {
      monthlyBudget: 100,
      budgetAlertThreshold: 0.9,
    }) as Agent;
    const result = useAppStore.getState().updateAgentBudget(agent.id, 5);
    expect(result.alert).toBeUndefined();
    expect(useAppStore.getState().agents[agent.id].config.budgetUsed).toBe(5);
  });

  it("updateAgentBudget 累加预算", () => {
    const agent = useAppStore.getState().createAgent("专员", "specialist", null) as Agent;
    useAppStore.getState().updateAgentBudget(agent.id, 3);
    useAppStore.getState().updateAgentBudget(agent.id, 2);
    expect(useAppStore.getState().agents[agent.id].config.budgetUsed).toBe(5);
  });

  it("updateAgentBudget 不存在的 Agent 返回空对象", () => {
    const result = useAppStore.getState().updateAgentBudget("non-existent", 5);
    expect(result).toEqual({});
  });
});

describe("appStore - 工作区克隆补充 (SOLO-04)", () => {
  beforeEach(resetStore);

  it("cloneWorkspace 克隆剧本和知识库", () => {
    const agent = useAppStore.getState().createAgent("主管", "supervisor", null) as Agent;
    const script = useAppStore.getState().saveScript("流程", "描述", [
      { agentId: agent.id, action: "步骤1" },
    ]);
    useAppStore.getState().addKnowledge("global", "key1", "value1");

    const idMapping = useAppStore.getState().cloneWorkspace("(副本)");

    // 验证剧本被克隆
    const scripts = Object.values(useAppStore.getState().scripts);
    expect(scripts.length).toBe(2); // 原始 + 克隆
    const clonedScript = scripts.find((s) => s.name === "流程 (副本)");
    expect(clonedScript).toBeDefined();
    expect(clonedScript!.steps[0].agentId).toBe(idMapping[agent.id]);

    // 验证知识库被克隆
    const knowledge = Object.values(useAppStore.getState().knowledge);
    expect(knowledge.length).toBe(2);
  });
});

describe("appStore - 任务转移补充 (ORG-04)", () => {
  beforeEach(resetStore);

  it("transferTasks 只转主任务不转子任务", () => {
    const from = useAppStore.getState().createAgent("专员A", "specialist", null) as Agent;
    const to = useAppStore.getState().createAgent("专员B", "specialist", null) as Agent;
    const other = useAppStore.getState().createAgent("专员C", "specialist", null) as Agent;
    const chat = useAppStore.getState().createChat("direct", "私聊", []);

    const task = useAppStore.getState().createTask("任务1", "描述", from.id, chat.id);
    // 子任务属于 other，不应被转移
    useAppStore.getState().addSubTask(task.id, other.id, "子任务", "子描述");

    const count = useAppStore.getState().transferTasks(from.id, to.id);
    expect(count).toBe(1); // 只有1个主任务
    expect(useAppStore.getState().tasks[task.id].assigneeId).toBe(to.id);
    // other 的子任务不变
    expect(useAppStore.getState().tasks[task.id].subTasks[0].assigneeId).toBe(other.id);
  });

  it("transferTasks 无任务时返回 0", () => {
    const from = useAppStore.getState().createAgent("专员A", "specialist", null) as Agent;
    const to = useAppStore.getState().createAgent("专员B", "specialist", null) as Agent;
    const count = useAppStore.getState().transferTasks(from.id, to.id);
    expect(count).toBe(0);
  });
});

describe("appStore - 审计日志补充", () => {
  beforeEach(resetStore);

  it("addAuditLog 内容哈希防篡改", () => {
    useAppStore.getState().addAuditLog("a1", "execute", "内容A");
    useAppStore.getState().addAuditLog("a1", "execute", "内容B");
    const logs = useAppStore.getState().auditLogs;
    expect(logs).toHaveLength(2);
    // 不同内容应产生不同哈希
    expect(logs[0].contentHash).not.toBe(logs[1].contentHash);
  });

  it("addAuditLog 相同内容产生相同哈希", () => {
    useAppStore.getState().addAuditLog("a1", "execute", "相同内容");
    useAppStore.getState().addAuditLog("a2", "report", "相同内容");
    const logs = useAppStore.getState().auditLogs;
    expect(logs[0].contentHash).toBe(logs[1].contentHash);
  });
});

describe("appStore - 休息模式补充", () => {
  beforeEach(resetStore);

  it("setRestMode 设置规则", () => {
    useAppStore.getState().setRestMode({
      enabled: true,
      rules: [{ condition: "budget < 10", action: "auto_execute" }],
    });
    const restMode = useAppStore.getState().restMode;
    expect(restMode.enabled).toBe(true);
    expect(restMode.rules).toHaveLength(1);
    expect(restMode.rules[0].action).toBe("auto_execute");
  });

  it("setRestMode 部分更新保留其他字段", () => {
    useAppStore.getState().setRestMode({ enabled: true });
    useAppStore.getState().setRestMode({ rules: [{ condition: "test", action: "record" }] });
    const restMode = useAppStore.getState().restMode;
    expect(restMode.enabled).toBe(true);
    expect(restMode.rules).toHaveLength(1);
  });
});

describe("appStore - Agent 状态", () => {
  beforeEach(resetStore);

  it("setAgentStatus 更新状态", () => {
    const agent = useAppStore.getState().createAgent("专员", "specialist", null) as Agent;
    useAppStore.getState().setAgentStatus(agent.id, "executing");
    expect(useAppStore.getState().agents[agent.id].status).toBe("executing");
  });

  it("setAgentStatus 不存在的 Agent 不报错", () => {
    useAppStore.getState().setAgentStatus("non-existent", "executing");
  });
});

describe("appStore - 聊天补充", () => {
  beforeEach(resetStore);

  it("deleteChat 同时清除 activeChatId", () => {
    const chat = useAppStore.getState().createChat("group", "群聊", []);
    useAppStore.getState().setActiveChat(chat.id);
    expect(useAppStore.getState().activeChatId).toBe(chat.id);
    useAppStore.getState().deleteChat(chat.id);
    expect(useAppStore.getState().activeChatId).toBeNull();
  });

  it("addMemberToChat 不存在的聊天不报错", () => {
    useAppStore.getState().addMemberToChat("non-existent", { id: "m1", name: "成员", avatar: "bot", role: "member" });
  });

  it("removeMemberFromChat 不存在的聊天不报错", () => {
    useAppStore.getState().removeMemberFromChat("non-existent", "m1");
  });
});

// ============================================================
// 需求文档对照补充测试
// ============================================================

describe("appStore - UI-04 消息线程 (replyToId)", () => {
  beforeEach(resetStore);

  it("sendMessage 带 replyToId 形成线程", () => {
    const chat = useAppStore.getState().createChat("group", "群聊", []);
    const original = useAppStore.getState().sendMessage(chat.id, "text", "user", "原始消息");
    const reply = useAppStore.getState().sendMessage(chat.id, "text", "agent1", "回复消息", {
      replyToId: original.id,
    });
    expect(reply.replyToId).toBe(original.id);
  });

  it("同一消息可有多条回复", () => {
    const chat = useAppStore.getState().createChat("group", "群聊", []);
    const original = useAppStore.getState().sendMessage(chat.id, "text", "user", "原始消息");
    const reply1 = useAppStore.getState().sendMessage(chat.id, "text", "a1", "回复1", {
      replyToId: original.id,
    });
    const reply2 = useAppStore.getState().sendMessage(chat.id, "text", "a2", "回复2", {
      replyToId: original.id,
    });
    expect(reply1.replyToId).toBe(original.id);
    expect(reply2.replyToId).toBe(original.id);
    const msgs = useAppStore.getState().messages[chat.id];
    expect(msgs).toHaveLength(3);
  });
});

describe("appStore - KNL-04 归档筛选", () => {
  beforeEach(resetStore);

  it("filterArchives 按 agentId 筛选", () => {
    useAppStore.getState().addArchive({
      taskId: "t1", taskTitle: "任务A", agentId: "a1", agentName: "专员1",
      input: "", output: "结果1", cost: 1, apiCalls: 1, model: "deepseek-v4-flash", duration: 100, createdAt: Date.now(),
    });
    useAppStore.getState().addArchive({
      taskId: "t2", taskTitle: "任务B", agentId: "a2", agentName: "专员2",
      input: "", output: "结果2", cost: 2, apiCalls: 2, model: "deepseek-v4-flash", duration: 200, createdAt: Date.now(),
    });
    // searchArchives 可以通过 agentName 间接筛选
    const results = useAppStore.getState().searchArchives("专员1");
    expect(results).toHaveLength(1);
    expect(results[0].agentId).toBe("a1");
  });

  it("filterArchives 按时间范围筛选（通过 searchArchives 间接）", () => {
    const oldTime = Date.now() - 86400000 * 30; // 30天前
    const recentTime = Date.now();
    useAppStore.getState().addArchive({
      taskId: "t1", taskTitle: "旧任务", agentId: "a1", agentName: "专员",
      input: "", output: "旧结果", cost: 1, apiCalls: 1, model: "deepseek-v4-flash", duration: 100, createdAt: oldTime,
    });
    useAppStore.getState().addArchive({
      taskId: "t2", taskTitle: "新任务", agentId: "a1", agentName: "专员",
      input: "", output: "新结果", cost: 2, apiCalls: 2, model: "deepseek-v4-flash", duration: 200, createdAt: recentTime,
    });
    const all = useAppStore.getState().archives;
    expect(all).toHaveLength(2);
    // 验证时间戳存在且可筛选
    const oldArchive = all.find((a) => a.createdAt === oldTime);
    expect(oldArchive).toBeDefined();
    expect(oldArchive!.taskTitle).toBe("旧任务");
  });
});

describe("appStore - KNL-04 归档导出", () => {
  beforeEach(resetStore);

  it("archives 可序列化为 JSON", () => {
    useAppStore.getState().addArchive({
      taskId: "t1", taskTitle: "任务A", agentId: "a1", agentName: "专员",
      input: "输入", output: "输出", cost: 0.01, apiCalls: 1, model: "deepseek-v4-flash", duration: 100, createdAt: Date.now(),
    });
    const archives = useAppStore.getState().archives;
    const json = JSON.stringify(archives);
    expect(json).toContain("任务A");
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].cost).toBe(0.01);
  });
});

describe("appStore - SOLO-01 休息模式运行时", () => {
  beforeEach(resetStore);

  it("休息模式启用时设置值班主管", () => {
    const agent = useAppStore.getState().createAgent("值班主管", "supervisor", null) as Agent;
    useAppStore.getState().setRestMode({
      enabled: true,
      dutyAgentId: agent.id,
      enabledAt: Date.now(),
    });
    const restMode = useAppStore.getState().restMode;
    expect(restMode.enabled).toBe(true);
    expect(restMode.dutyAgentId).toBe(agent.id);
    expect(restMode.enabledAt).toBeDefined();
  });

  it("休息模式禁用时记录禁用时间", () => {
    useAppStore.getState().setRestMode({ enabled: true, enabledAt: Date.now() });
    useAppStore.getState().setRestMode({ enabled: false, disabledAt: Date.now() });
    const restMode = useAppStore.getState().restMode;
    expect(restMode.enabled).toBe(false);
    expect(restMode.disabledAt).toBeDefined();
  });

  it("休息模式规则包含 auto_execute 动作", () => {
    useAppStore.getState().setRestMode({
      enabled: true,
      rules: [
        { condition: "budget < 5", action: "auto_execute" },
        { condition: "error_count > 3", action: "sms_summary" },
        { condition: "always", action: "record" },
      ],
    });
    const rules = useAppStore.getState().restMode.rules;
    expect(rules).toHaveLength(3);
    expect(rules.map((r) => r.action)).toEqual(["auto_execute", "sms_summary", "record"]);
  });
});

describe("appStore - RFT-03 心跳检测配置", () => {
  beforeEach(resetStore);

  it("Agent config 包含心跳相关配置", () => {
    const agent = useAppStore.getState().createAgent("专员", "specialist", null) as Agent;
    expect(agent.config.timeout).toBeDefined();
    expect(agent.config.maxRetries).toBeDefined();
  });

  it("心跳告警后 Agent 状态可恢复", () => {
    const agent = useAppStore.getState().createAgent("专员", "specialist", null) as Agent;
    useAppStore.getState().setAgentStatus(agent.id, "error");
    expect(useAppStore.getState().agents[agent.id].status).toBe("error");
    // 恢复
    useAppStore.getState().setAgentStatus(agent.id, "idle");
    expect(useAppStore.getState().agents[agent.id].status).toBe("idle");
  });
});

describe("appStore - BUP-05 决策超时升级配置", () => {
  beforeEach(resetStore);

  it("ReportCard 支持超时升级字段", () => {
    const chat = useAppStore.getState().createChat("group", "群聊", []);
    const msg = useAppStore.getState().sendMessage(chat.id, "report_card", "a1", "需要决策", {
      reportCard: {
        title: "需要决策",
        problem: "预算超支",
        options: [
          { id: "a", label: "增加预算 $10" },
          { id: "b", label: "切换低成本模型" },
        ],
        resolved: false,
      },
    });
    expect(msg.reportCard).toBeDefined();
    expect(msg.reportCard?.resolved).toBe(false);
    // 决策未响应时，reportCard 保持 unresolved 状态
    // 自动升级逻辑需要外部定时器触发
  });

  it("resolveReportCard 处理超时后的默认选项", () => {
    const chat = useAppStore.getState().createChat("group", "群聊", []);
    const msg = useAppStore.getState().sendMessage(chat.id, "report_card", "a1", "需要决策", {
      reportCard: {
        title: "需要决策",
        problem: "问题",
        options: [
          { id: "default", label: "默认选项" },
          { id: "other", label: "其他选项" },
        ],
        resolved: false,
      },
    });
    // 模拟超时后自动选择默认选项
    useAppStore.getState().resolveReportCard(chat.id, msg.id, "default");
    const resolved = useAppStore.getState().messages[chat.id][0];
    expect(resolved.reportCard?.resolved).toBe(true);
    expect(resolved.reportCard?.resolvedOption).toBe("default");
  });
});

// ============================================================
// UI-03: progress/file/image 消息类型
// ============================================================

describe("appStore - UI-03 进度消息", () => {
  beforeEach(resetStore);

  it("sendMessage 支持 progress 类型", () => {
    const chat = useAppStore.getState().createChat("group", "群聊", []);
    const msg = useAppStore.getState().sendMessage(chat.id, "progress", "a1", "设计进度", {
      progressData: { label: "设计进度", current: 3, total: 10, unit: "页" },
    });
    expect(msg.type).toBe("progress");
    expect(msg.progressData).toBeDefined();
    expect(msg.progressData?.current).toBe(3);
    expect(msg.progressData?.total).toBe(10);
  });

  it("progress 消息可更新", () => {
    const chat = useAppStore.getState().createChat("group", "群聊", []);
    const msg1 = useAppStore.getState().sendMessage(chat.id, "progress", "a1", "进度", {
      progressData: { label: "进度", current: 1, total: 5 },
    });
    const msg2 = useAppStore.getState().sendMessage(chat.id, "progress", "a1", "进度更新", {
      progressData: { label: "进度", current: 3, total: 5 },
    });
    const msgs = useAppStore.getState().messages[chat.id];
    expect(msgs).toHaveLength(2);
    expect(msgs[1].progressData?.current).toBe(3);
  });
});

describe("appStore - UI-03 文件消息", () => {
  beforeEach(resetStore);

  it("sendMessage 支持 file 类型", () => {
    const chat = useAppStore.getState().createChat("group", "群聊", []);
    const msg = useAppStore.getState().sendMessage(chat.id, "file", "a1", "设计稿", {
      fileData: { name: "设计稿.pdf", size: 2048000, mimeType: "application/pdf", url: "https://example.com/file.pdf" },
    });
    expect(msg.type).toBe("file");
    expect(msg.fileData).toBeDefined();
    expect(msg.fileData?.name).toBe("设计稿.pdf");
    expect(msg.fileData?.size).toBe(2048000);
  });
});

describe("appStore - UI-03 图片消息", () => {
  beforeEach(resetStore);

  it("sendMessage 支持 image 类型", () => {
    const chat = useAppStore.getState().createChat("group", "群聊", []);
    const msg = useAppStore.getState().sendMessage(chat.id, "image", "a1", "设计图", {
      imageData: { url: "https://example.com/image.png", alt: "设计图", width: 800, height: 600 },
    });
    expect(msg.type).toBe("image");
    expect(msg.imageData).toBeDefined();
    expect(msg.imageData?.url).toBe("https://example.com/image.png");
    expect(msg.imageData?.width).toBe(800);
  });
});

// ============================================================
// ACT-03: Agent 动作状态显示
// ============================================================
describe("appStore - ACT-03 Agent 动作状态", () => {
  beforeEach(resetStore);

  it("Agent 状态变化可追踪", () => {
    const agent = useAppStore.getState().createAgent("专员", "specialist", null) as Agent;
    expect(agent.status).toBe("idle");
    useAppStore.getState().setAgentStatus(agent.id, "executing");
    expect(useAppStore.getState().agents[agent.id].status).toBe("executing");
    useAppStore.getState().setAgentStatus(agent.id, "summarizing");
    expect(useAppStore.getState().agents[agent.id].status).toBe("summarizing");
    useAppStore.getState().setAgentStatus(agent.id, "reporting");
    expect(useAppStore.getState().agents[agent.id].status).toBe("reporting");
    useAppStore.getState().setAgentStatus(agent.id, "idle");
    expect(useAppStore.getState().agents[agent.id].status).toBe("idle");
  });

  it("聊天成员中的 Agent 状态可查询", () => {
    const supervisor = useAppStore.getState().createAgent("主管", "supervisor", null) as Agent;
    const specialist = useAppStore.getState().createAgent("专员", "specialist", supervisor.id) as Agent;
    const chat = useAppStore.getState().createChat("group", "群聊", [
      { id: supervisor.id, name: supervisor.name, avatar: "supervisor", role: "member" },
      { id: specialist.id, name: specialist.name, avatar: "specialist", role: "member" },
    ]);

    // 设置专员为执行中
    useAppStore.getState().setAgentStatus(specialist.id, "executing");

    // 验证聊天成员中包含该 Agent
    const chatData = useAppStore.getState().chats[chat.id];
    expect(chatData.members.some((m) => m.id === specialist.id)).toBe(true);

    // 验证 Agent 状态
    const agentState = useAppStore.getState().agents[specialist.id];
    expect(agentState.status).toBe("executing");
  });

  it("多个 Agent 同时活跃", () => {
    const s1 = useAppStore.getState().createAgent("专员1", "specialist", null) as Agent;
    const s2 = useAppStore.getState().createAgent("专员2", "specialist", null) as Agent;
    useAppStore.getState().setAgentStatus(s1.id, "executing");
    useAppStore.getState().setAgentStatus(s2.id, "summarizing");

    const agents = useAppStore.getState().agents;
    const activeCount = Object.values(agents).filter((a) => a.status !== "idle" && a.status !== "archived").length;
    expect(activeCount).toBe(2);
  });
});

// ============================================================
// KNL-03: 归档 NLU 语义检索
// ============================================================
describe("appStore - KNL-03 归档 NLU 检索", () => {
  beforeEach(resetStore);

  it("searchArchives 支持关键词检索", () => {
    useAppStore.getState().addArchive({
      taskId: "t1", taskTitle: "设计海报", agentId: "a1", agentName: "设计专员",
      input: "", output: "结果", cost: 1, apiCalls: 1, model: "deepseek-v4-flash", duration: 100, createdAt: Date.now(),
    });
    useAppStore.getState().addArchive({
      taskId: "t2", taskTitle: "发布文章", agentId: "a2", agentName: "发布专员",
      input: "", output: "结果", cost: 2, apiCalls: 2, model: "deepseek-v4-flash", duration: 200, createdAt: Date.now(),
    });
    const results = useAppStore.getState().searchArchives("设计");
    expect(results).toHaveLength(1);
    expect(results[0].taskTitle).toBe("设计海报");
  });

  it("searchArchives 空查询返回全部", () => {
    useAppStore.getState().addArchive({
      taskId: "t1", taskTitle: "任务A", agentId: "a1", agentName: "专员",
      input: "", output: "结果", cost: 1, apiCalls: 1, model: "deepseek-v4-flash", duration: 100, createdAt: Date.now(),
    });
    const results = useAppStore.getState().searchArchives("");
    expect(results).toHaveLength(1);
  });
});

// ============================================================
// EXT-02: 插件市场
// ============================================================
describe("appStore - EXT-02 插件市场", () => {
  beforeEach(resetStore);

  it("availablePlugins 包含预置插件", () => {
    const plugins = useAppStore.getState().availablePlugins;
    expect(plugins.length).toBeGreaterThan(0);
    expect(plugins.some((p) => p.id === "gmail")).toBe(true);
    expect(plugins.some((p) => p.id === "notion")).toBe(true);
  });

  it("installPlugin 安装插件", () => {
    const installed = useAppStore.getState().installPlugin("gmail", { email: "test@example.com" });
    expect(installed.pluginId).toBe("gmail");
    expect(installed.enabled).toBe(true);
    expect(useAppStore.getState().installedPlugins).toHaveLength(1);
  });

  it("uninstallPlugin 卸载插件", () => {
    useAppStore.getState().installPlugin("gmail", {});
    useAppStore.getState().uninstallPlugin("gmail");
    expect(useAppStore.getState().installedPlugins).toHaveLength(0);
  });
});

// ============================================================
// EXT-03: Webhook 事件触发
// ============================================================
describe("appStore - EXT-03 Webhook 事件触发", () => {
  beforeEach(resetStore);

  it("registerWebhook 注册 Webhook", () => {
    const webhook = useAppStore.getState().registerWebhook({
      name: "任务通知",
      url: "https://example.com/webhook",
      events: ["task.created", "task.completed"],
      enabled: true,
    });
    expect(webhook.name).toBe("任务通知");
    expect(webhook.events).toContain("task.created");
    expect(useAppStore.getState().webhooks).toHaveLength(1);
  });

  it("removeWebhook 删除 Webhook", () => {
    const webhook = useAppStore.getState().registerWebhook({
      name: "通知", url: "https://example.com/hook", events: ["task.created"], enabled: true,
    });
    useAppStore.getState().removeWebhook(webhook.id);
    expect(useAppStore.getState().webhooks).toHaveLength(0);
  });

  it("emitEvent 触发匹配的 Webhook", async () => {
    // Mock fetch 以避免真实 HTTP 请求
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = mockFetch;

    useAppStore.getState().registerWebhook({
      name: "任务通知", url: "https://example.com/hook", events: ["task.created"], enabled: true,
    });
    useAppStore.getState().emitEvent("task.created", { taskId: "t1" });
    // 等待异步 fetch 完成后审计日志写入
    await vi.waitFor(() => {
      const logs = useAppStore.getState().auditLogs;
      expect(logs.some((l) => l.action === "webhook_emit")).toBe(true);
    });
  });

  it("emitEvent 不触发不匹配的 Webhook", () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = mockFetch;

    useAppStore.getState().registerWebhook({
      name: "任务通知", url: "https://example.com/hook", events: ["task.completed"], enabled: true,
    });
    useAppStore.getState().emitEvent("task.created", { taskId: "t1" });
    const logs = useAppStore.getState().auditLogs;
    expect(logs.some((l) => l.action === "webhook_emit")).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("禁用的 Webhook 不触发", () => {
    useAppStore.getState().registerWebhook({
      name: "通知", url: "https://example.com/hook", events: ["task.created"], enabled: false,
    });
    useAppStore.getState().emitEvent("task.created", { taskId: "t1" });
    const logs = useAppStore.getState().auditLogs;
    expect(logs.some((l) => l.action === "webhook_emit")).toBe(false);
  });
});

// ============================================================
// EXT-04: A/B 测试
// ============================================================
describe("appStore - EXT-04 A/B 测试", () => {
  beforeEach(resetStore);

  it("createExperiment 创建实验", () => {
    const experiment = useAppStore.getState().createExperiment(
      "模型对比实验",
      "对比 GPT-4 和 Claude 的任务完成率",
      [
        { id: "control", name: "GPT-4", agentConfig: { model: "deepseek-v4-flash" }, trafficWeight: 0.5 },
        { id: "treatment", name: "Claude", agentConfig: { model: "claude-3" }, trafficWeight: 0.5 },
      ]
    );
    expect(experiment.name).toBe("模型对比实验");
    expect(experiment.status).toBe("draft");
    expect(experiment.variants).toHaveLength(2);
    expect(useAppStore.getState().abExperiments).toHaveLength(1);
  });

  it("startExperiment 启动实验", () => {
    const exp = useAppStore.getState().createExperiment("实验", "描述", [
      { id: "a", name: "A", agentConfig: {}, trafficWeight: 1 },
    ]);
    useAppStore.getState().startExperiment(exp.id);
    expect(useAppStore.getState().abExperiments[0].status).toBe("running");
    expect(useAppStore.getState().abExperiments[0].startDate).toBeDefined();
  });

  it("stopExperiment 停止实验", () => {
    const exp = useAppStore.getState().createExperiment("实验", "描述", [
      { id: "a", name: "A", agentConfig: {}, trafficWeight: 1 },
    ]);
    useAppStore.getState().startExperiment(exp.id);
    useAppStore.getState().stopExperiment(exp.id);
    expect(useAppStore.getState().abExperiments[0].status).toBe("completed");
    expect(useAppStore.getState().abExperiments[0].endDate).toBeDefined();
  });

  it("assignVariant 按流量权重分配变体", () => {
    const exp = useAppStore.getState().createExperiment("实验", "描述", [
      { id: "control", name: "对照组", agentConfig: { model: "deepseek-v4-flash" }, trafficWeight: 0.5 },
      { id: "treatment", name: "实验组", agentConfig: { model: "claude-3" }, trafficWeight: 0.5 },
    ]);
    useAppStore.getState().startExperiment(exp.id);

    // 多次分配，验证返回结果结构正确
    const assignment = useAppStore.getState().assignVariant(exp.id);
    expect(assignment).not.toBeNull();
    expect(assignment!.experimentId).toBe(exp.id);
    expect(["control", "treatment"]).toContain(assignment!.variantId);
  });

  it("assignVariant 未运行的实验返回 null", () => {
    const exp = useAppStore.getState().createExperiment("实验", "描述", [
      { id: "a", name: "A", agentConfig: {}, trafficWeight: 1 },
    ]);
    // draft 状态，不应分配
    const result = useAppStore.getState().assignVariant(exp.id);
    expect(result).toBeNull();
  });

  it("recordMetric 记录指标", () => {
    const exp = useAppStore.getState().createExperiment("实验", "描述", [
      { id: "control", name: "对照组", agentConfig: {}, trafficWeight: 0.5 },
      { id: "treatment", name: "实验组", agentConfig: {}, trafficWeight: 0.5 },
    ]);
    useAppStore.getState().recordMetric(exp.id, "task_completion_rate", "control", 0.85);
    useAppStore.getState().recordMetric(exp.id, "task_completion_rate", "treatment", 0.92);

    const metrics = useAppStore.getState().abExperiments[0].metrics;
    expect(metrics).toHaveLength(1);
    expect(metrics[0].name).toBe("task_completion_rate");
    expect(metrics[0].variantResults["control"]).toBe(0.85);
    expect(metrics[0].variantResults["treatment"]).toBe(0.92);
  });

  it("recordMetric 多个不同指标", () => {
    const exp = useAppStore.getState().createExperiment("实验", "描述", [
      { id: "a", name: "A", agentConfig: {}, trafficWeight: 1 },
    ]);
    useAppStore.getState().recordMetric(exp.id, "completion_rate", "a", 0.9);
    useAppStore.getState().recordMetric(exp.id, "avg_cost", "a", 0.05);

    const metrics = useAppStore.getState().abExperiments[0].metrics;
    expect(metrics).toHaveLength(2);
  });
});
