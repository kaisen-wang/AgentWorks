import { describe, it, expect, beforeEach } from "vitest";
import { WorkflowEngine, startDecisionTimeout, clearDecisionTimeout, startHeartbeatMonitor, stopHeartbeatMonitor, updateHeartbeat, handleRestModeTask } from "./WorkflowEngine";
import { useAppStore } from "@/stores/appStore";
import type { AppState } from "@/stores/appStore";
import type { Agent, AgentId, Chat, Task, Message, BudgetAlert, HeartbeatAlert, DecisionOption } from "@/types";

// Helper: 重置 store
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
  });
}

// Helper: 创建基础测试环境
function setupBasicOrg() {
  const store = useAppStore.getState();
  const supervisor = store.createAgent("营销主管", "supervisor", null) as Agent;
  const specialist1 = store.createAgent("设计专员", "specialist", supervisor.id) as Agent;
  const specialist2 = store.createAgent("发布专员", "specialist", supervisor.id) as Agent;
  const chat = store.createChat("group", "营销群", [
    { id: supervisor.id, name: "营销主管", avatar: "supervisor", role: "owner" },
    { id: specialist1.id, name: "设计专员", avatar: "specialist", role: "member" },
    { id: specialist2.id, name: "发布专员", avatar: "specialist", role: "member" },
  ]);
  return { supervisor, specialist1, specialist2, chat };
}

describe("WorkflowEngine - 工作流引擎", () => {
  let engine: WorkflowEngine;

  beforeEach(() => {
    resetStore();
    engine = new WorkflowEngine();
  });

  // ============================================================
  // assignTask - 任务下达 (TDN-01)
  // ============================================================
  describe("assignTask 任务下达", () => {
    it("向专员下达任务", async () => {
      const { specialist1, chat } = setupBasicOrg();
      const result = await engine.assignTask("设计海报", "设计一张新品海报", specialist1.id, chat.id);
      expect(result.status).toBe("started");
      expect(result.taskId).toBeTruthy();
      expect(result.message).toContain("设计专员");
    });

    it("向主管下达任务触发自动拆解", async () => {
      const { supervisor, chat } = setupBasicOrg();
      const result = await engine.assignTask("新品宣发", "执行新品宣发全流程", supervisor.id, chat.id);
      expect(result.status).toBe("started");
      // 验证任务已创建
      const tasks = Object.values(useAppStore.getState().tasks);
      expect(tasks.length).toBeGreaterThan(0);
    });

    it("向不存在的 Agent 下达任务返回失败", async () => {
      const { chat } = setupBasicOrg();
      const result = await engine.assignTask("任务", "描述", "non-existent", chat.id);
      expect(result.status).toBe("failed");
      expect(result.taskId).toBe("");
    });

    it("下达任务时发送任务卡片消息", async () => {
      const { specialist1, chat } = setupBasicOrg();
      await engine.assignTask("设计海报", "设计一张新品海报", specialist1.id, chat.id);
      const messages = useAppStore.getState().messages[chat.id];
      expect(messages.length).toBeGreaterThan(0);
      expect(messages.some((m) => m.type === "task_card")).toBe(true);
    });

    it("下达任务时支持优先级和截止时间", async () => {
      const { specialist1, chat } = setupBasicOrg();
      const deadline = Date.now() + 86400000;
      const result = await engine.assignTask("紧急任务", "描述", specialist1.id, chat.id, "urgent", deadline);
      expect(result.status).toBe("started");
      const task = useAppStore.getState().tasks[result.taskId];
      expect(task.priority).toBe("urgent");
      expect(task.deadline).toBe(deadline);
    });
  });

  // ============================================================
  // decomposeAndAssign - 拆解分配 (TDN-02)
  // ============================================================
  describe("decomposeAndAssign 拆解分配", () => {
    it("主管拆解任务并创建子任务", async () => {
      const { supervisor, specialist1, specialist2, chat } = setupBasicOrg();
      const task = useAppStore.getState().createTask("新品宣发", "执行全流程", supervisor.id, chat.id);
      await engine.decomposeAndAssign(task.id, supervisor.id, "执行全流程", chat.id);

      const updatedTask = useAppStore.getState().tasks[task.id];
      expect(updatedTask.subTasks.length).toBeGreaterThan(0);
      expect(updatedTask.status).toBe("in_progress");
    });

    it("拆解后发送拆解结果消息", async () => {
      const { supervisor, chat } = setupBasicOrg();
      const task = useAppStore.getState().createTask("任务", "描述", supervisor.id, chat.id);
      await engine.decomposeAndAssign(task.id, supervisor.id, "描述", chat.id);

      const messages = useAppStore.getState().messages[chat.id];
      expect(messages.length).toBeGreaterThan(0);
    });

    it("拆解后添加审计日志", async () => {
      const { supervisor, chat } = setupBasicOrg();
      const task = useAppStore.getState().createTask("任务", "描述", supervisor.id, chat.id);
      await engine.decomposeAndAssign(task.id, supervisor.id, "描述", chat.id);

      const auditLogs = useAppStore.getState().auditLogs;
      expect(auditLogs.length).toBeGreaterThan(0);
      expect(auditLogs.some((log) => log.action === "execute")).toBe(true);
    });

    it("不存在的 supervisor 不报错", async () => {
      const { chat } = setupBasicOrg();
      // 不应抛异常
      await engine.decomposeAndAssign("fake-task", "non-existent", "描述", chat.id);
    });
  });

  // ============================================================
  // reportCompletion - 完成上报 (BUP-01, BUP-03)
  // ============================================================
  describe("reportCompletion 完成上报", () => {
    it("专员完成上报后归档", async () => {
      const { supervisor, specialist1, chat } = setupBasicOrg();
      const task = useAppStore.getState().createTask("任务", "描述", specialist1.id, chat.id);
      await engine.reportCompletion(specialist1.id, task.id, "设计完成", chat.id);

      const archives = useAppStore.getState().archives;
      expect(archives.length).toBeGreaterThan(0);
      expect(archives[0].output).toBe("设计完成");
    });

    it("有上级时发送上报消息", async () => {
      const { supervisor, specialist1, chat } = setupBasicOrg();
      const task = useAppStore.getState().createTask("任务", "描述", specialist1.id, chat.id);
      await engine.reportCompletion(specialist1.id, task.id, "完成结果", chat.id);

      const messages = useAppStore.getState().messages[chat.id];
      const reportMsg = messages.find((m) => m.content.includes("上报"));
      expect(reportMsg).toBeDefined();
    });

    it("添加审计日志", async () => {
      const { specialist1, chat } = setupBasicOrg();
      const task = useAppStore.getState().createTask("任务", "描述", specialist1.id, chat.id);
      await engine.reportCompletion(specialist1.id, task.id, "结果", chat.id);

      const auditLogs = useAppStore.getState().auditLogs;
      expect(auditLogs.some((log) => log.action === "report")).toBe(true);
    });

    it("不存在的 Agent 不报错", async () => {
      const { chat } = setupBasicOrg();
      await engine.reportCompletion("non-existent", "t1", "结果", chat.id);
    });
  });

  // ============================================================
  // reportDecision - 决策上报 (BUP-01, BUP-02, BUP-04)
  // ============================================================
  describe("reportDecision 决策上报", () => {
    it("上报决策卡片消息", async () => {
      const { specialist1, chat } = setupBasicOrg();
      const options: DecisionOption[] = [
        { id: "a", label: "选项A" },
        { id: "b", label: "选项B" },
      ];
      const msg = await engine.reportDecision(
        specialist1.id, chat.id, "需要决策", "预算超支", "已尝试降级", options
      );
      expect(msg.type).toBe("report_card");
      expect(msg.reportCard).toBeDefined();
      expect(msg.reportCard?.resolved).toBe(false);
    });

    it("BUP-04: 费用低于阈值自动批准", async () => {
      const { supervisor, specialist1, chat } = setupBasicOrg();
      // 设置主管的决策阈值为 10
      useAppStore.getState().updateAgent(supervisor.id, {
        config: { ...supervisor.config, decisionThreshold: 10 },
      });

      const options: DecisionOption[] = [
        { id: "a", label: "增加预算 $5" },  // $5 <= $10 阈值
        { id: "b", label: "切换模型" },
      ];
      const msg = await engine.reportDecision(
        specialist1.id, chat.id, "需要决策", "预算不足", "已尝试优化", options
      );
      // 应自动批准
      expect(msg.reportCard?.resolved).toBe(true);
      expect(msg.reportCard?.resolvedOption).toBe("a");
    });

    it("BUP-04: 费用高于阈值不自动批准", async () => {
      const { supervisor, specialist1, chat } = setupBasicOrg();
      useAppStore.getState().updateAgent(supervisor.id, {
        config: { ...supervisor.config, decisionThreshold: 3 },
      });

      const options: DecisionOption[] = [
        { id: "a", label: "增加预算 $5" },  // $5 > $3 阈值
        { id: "b", label: "切换模型" },
      ];
      const msg = await engine.reportDecision(
        specialist1.id, chat.id, "需要决策", "预算不足", "已尝试优化", options
      );
      expect(msg.reportCard?.resolved).toBe(false);
    });

    it("不存在的 Agent 返回系统消息", async () => {
      const { chat } = setupBasicOrg();
      const msg = await engine.reportDecision(
        "non-existent", chat.id, "标题", "问题", "方案", [{ id: "a", label: "A" }]
      );
      expect(msg.content).toContain("Agent 不存在");
    });
  });

  // ============================================================
  // reportBudgetAlert - 预算告警 (SOLO-03)
  // ============================================================
  describe("reportBudgetAlert 预算告警", () => {
    it("发送预算告警消息", async () => {
      const { specialist1, chat } = setupBasicOrg();
      const alert: BudgetAlert = {
        agentId: specialist1.id,
        agentName: "设计专员",
        budgetUsed: 9,
        budgetTotal: 10,
        usagePercent: 0.9,
        options: [{ id: "increase", label: "增加额度" }],
      };
      const msg = await engine.reportBudgetAlert(specialist1.id, chat.id, alert);
      expect(msg.type).toBe("budget_alert");
      expect(msg.budgetAlert).toBeDefined();
      expect(msg.content).toContain("预算告警");
    });

    it("添加审计日志", async () => {
      const { specialist1, chat } = setupBasicOrg();
      const alert: BudgetAlert = {
        agentId: specialist1.id,
        agentName: "设计专员",
        budgetUsed: 9,
        budgetTotal: 10,
        usagePercent: 0.9,
        options: [],
      };
      await engine.reportBudgetAlert(specialist1.id, chat.id, alert);
      const auditLogs = useAppStore.getState().auditLogs;
      expect(auditLogs.some((log) => log.content.includes("预算告警"))).toBe(true);
    });
  });

  // ============================================================
  // reportHeartbeatAlert - 心跳告警 (RFT-03)
  // ============================================================
  describe("reportHeartbeatAlert 心跳告警", () => {
    it("发送心跳告警消息", async () => {
      const { specialist1, chat } = setupBasicOrg();
      const alert: HeartbeatAlert = {
        agentId: specialist1.id,
        agentName: "设计专员",
        reason: "无响应超过30秒",
        retryCount: 2,
        maxRetries: 3,
        options: [{ id: "restart", label: "重启Agent" }],
      };
      const msg = await engine.reportHeartbeatAlert(specialist1.id, chat.id, alert);
      expect(msg.type).toBe("heartbeat_alert");
      expect(msg.heartbeatAlert).toBeDefined();
      expect(msg.content).toContain("Agent 故障");
    });

    it("添加审计日志", async () => {
      const { specialist1, chat } = setupBasicOrg();
      const alert: HeartbeatAlert = {
        agentId: specialist1.id,
        agentName: "设计专员",
        reason: "超时",
        retryCount: 1,
        maxRetries: 3,
        options: [],
      };
      await engine.reportHeartbeatAlert(specialist1.id, chat.id, alert);
      const auditLogs = useAppStore.getState().auditLogs;
      expect(auditLogs.some((log) => log.content.includes("心跳告警"))).toBe(true);
    });
  });

  // ============================================================
  // resolveDecision - 决策响应
  // ============================================================
  describe("resolveDecision 决策响应", () => {
    it("解析决策卡片", async () => {
      const { specialist1, chat } = setupBasicOrg();
      const options: DecisionOption[] = [
        { id: "opt1", label: "选项1" },
        { id: "opt2", label: "选项2" },
      ];
      const msg = await engine.reportDecision(
        specialist1.id, chat.id, "决策", "问题", "方案", options
      );
      await engine.resolveDecision(chat.id, msg.id, "opt1");

      const messages = useAppStore.getState().messages[chat.id];
      const resolved = messages.find((m) => m.id === msg.id);
      expect(resolved?.reportCard?.resolved).toBe(true);
      expect(resolved?.reportCard?.resolvedOption).toBe("opt1");
    });
  });

  // ============================================================
  // directOrder - 跨级指令 (TDN-04)
  // ============================================================
  describe("directOrder 跨级指令", () => {
    it("直接向专员下达指令", async () => {
      const { supervisor, specialist1, chat } = setupBasicOrg();
      await engine.directOrder(specialist1.id, "立即修改配色", chat.id);

      const messages = useAppStore.getState().messages[chat.id];
      expect(messages.some((m) => m.content.includes("立即修改配色"))).toBe(true);
    });

    it("通知主管被绕过", async () => {
      const { supervisor, specialist1, chat } = setupBasicOrg();
      await engine.directOrder(specialist1.id, "指令", chat.id, true);

      const messages = useAppStore.getState().messages[chat.id];
      expect(messages.some((m) => m.content.includes("绕过"))).toBe(true);
    });

    it("不通知主管时无绕过消息", async () => {
      const { supervisor, specialist1, chat } = setupBasicOrg();
      await engine.directOrder(specialist1.id, "指令", chat.id, false);

      const messages = useAppStore.getState().messages[chat.id];
      expect(messages.some((m) => m.content.includes("绕过"))).toBe(false);
    });

    it("向有下属的 Agent 下达指令时级联更新子任务", async () => {
      const { supervisor, specialist1, specialist2, chat } = setupBasicOrg();
      const task = useAppStore.getState().createTask("任务", "描述", supervisor.id, chat.id);
      useAppStore.getState().addSubTask(task.id, specialist1.id, "子任务1", "子描述1");
      useAppStore.getState().addSubTask(task.id, specialist2.id, "子任务2", "子描述2");
      useAppStore.getState().updateTaskStatus(task.id, "in_progress");

      await engine.directOrder(supervisor.id, "覆盖指令", chat.id);

      const messages = useAppStore.getState().messages[chat.id];
      expect(messages.some((m) => m.content.includes("向下传递"))).toBe(true);
    });

    it("添加审计日志", async () => {
      const { specialist1, chat } = setupBasicOrg();
      await engine.directOrder(specialist1.id, "指令", chat.id);
      const auditLogs = useAppStore.getState().auditLogs;
      expect(auditLogs.some((log) => log.content.includes("跨级指令"))).toBe(true);
    });

    it("不存在的 Agent 不报错", async () => {
      const { chat } = setupBasicOrg();
      await engine.directOrder("non-existent", "指令", chat.id);
    });
  });

  // ============================================================
  // runScript - 剧本执行 (TDN-05)
  // ============================================================
  describe("runScript 剧本执行", () => {
    it("执行剧本中的步骤", async () => {
      const { supervisor, specialist1, chat } = setupBasicOrg();
      const script = useAppStore.getState().saveScript("测试剧本", "描述", [
        { agentId: specialist1.id, action: "设计海报" },
        { agentId: supervisor.id, action: "审核设计" },
      ]);

      await engine.runScript(script.id, chat.id);

      const messages = useAppStore.getState().messages[chat.id];
      expect(messages.some((m) => m.content.includes("开始执行剧本"))).toBe(true);
      expect(messages.some((m) => m.content.includes("执行完成"))).toBe(true);
    });

    it("剧本不存在时发送提示", async () => {
      const { chat } = setupBasicOrg();
      await engine.runScript("non-existent", chat.id);

      const messages = useAppStore.getState().messages[chat.id];
      expect(messages.some((m) => m.content.includes("剧本不存在"))).toBe(true);
    });

    it("支持变量替换", async () => {
      const { specialist1, chat } = setupBasicOrg();
      const script = useAppStore.getState().saveScript("替换剧本", "描述", [
        { agentId: specialist1.id, action: "为产品名设计海报" },
      ]);

      await engine.runScript(script.id, chat.id, "产品名为'赛博山水'");

      const messages = useAppStore.getState().messages[chat.id];
      // 验证剧本执行了（变量替换在 action 中进行）
      expect(messages.some((m) => m.content.includes("赛博山水"))).toBe(true);
    });

    it("步骤中 Agent 不存在时跳过", async () => {
      const { chat } = setupBasicOrg();
      const script = useAppStore.getState().saveScript("剧本", "描述", [
        { agentId: "non-existent", action: "步骤1" },
      ]);

      await engine.runScript(script.id, chat.id);

      const messages = useAppStore.getState().messages[chat.id];
      expect(messages.some((m) => m.content.includes("Agent 不存在，跳过"))).toBe(true);
    });

    it("步骤有 assignTo 时触发任务分配", async () => {
      const { supervisor, specialist1, chat } = setupBasicOrg();
      const script = useAppStore.getState().saveScript("分配剧本", "描述", [
        { agentId: supervisor.id, action: "执行任务", assignTo: specialist1.id },
      ]);

      await engine.runScript(script.id, chat.id);

      // 验证任务被创建
      const tasks = Object.values(useAppStore.getState().tasks);
      expect(tasks.length).toBeGreaterThan(0);
    });
  });

  // ============================================================
  // generateScriptFromTask - 剧本生成 (TDN-05)
  // ============================================================
  describe("generateScriptFromTask 剧本生成", () => {
    it("从任务生成剧本", () => {
      const { supervisor, specialist1, chat } = setupBasicOrg();
      const task = useAppStore.getState().createTask("任务", "描述", supervisor.id, chat.id);
      useAppStore.getState().addSubTask(task.id, specialist1.id, "子任务1", "设计海报");

      const scriptId = engine.generateScriptFromTask(task.id, "生成剧本", "从任务生成");
      expect(scriptId).toBeTruthy();

      const scripts = useAppStore.getState().scripts;
      expect(Object.values(scripts).some((s) => s.id === scriptId)).toBe(true);
    });

    it("任务不存在时返回 null", () => {
      const result = engine.generateScriptFromTask("non-existent", "剧本", "描述");
      expect(result).toBeNull();
    });
  });

  // ============================================================
  // executeWithDryRun - Dry-run 模式 (RFT-02)
  // ============================================================
  describe("executeWithDryRun Dry-run 模式", () => {
    it("敏感操作未确认时返回 dry-run 结果", async () => {
      const { specialist1, chat } = setupBasicOrg();
      const result = await engine.executeWithDryRun(
        specialist1.id, "publish", "发布到小红书", chat.id
      );
      expect("dryRun" in result && result.dryRun).toBe(true);
      if ("dryRun" in result) {
        expect(result.operation).toBe("publish");
        expect(result.confirmed).toBe(false);
        expect(result.preview).toContain("publish");
      }
    });

    it("敏感操作发送 Dry-run 提示消息", async () => {
      const { specialist1, chat } = setupBasicOrg();
      await engine.executeWithDryRun(
        specialist1.id, "send_email", "发送营销邮件", chat.id
      );
      const messages = useAppStore.getState().messages[chat.id];
      expect(messages.some((m) => m.content.includes("Dry-run"))).toBe(true);
    });

    it("敏感操作确认后实际执行", async () => {
      const { specialist1, chat } = setupBasicOrg();
      const result = await engine.executeWithDryRun(
        specialist1.id, "publish", "发布内容", chat.id, { confirmed: true }
      );
      expect("status" in result && result.status).toBe("started");
    });

    it("非敏感操作直接执行", async () => {
      const { specialist1, chat } = setupBasicOrg();
      const result = await engine.executeWithDryRun(
        specialist1.id, "design", "设计海报", chat.id
      );
      expect("status" in result && result.status).toBe("started");
    });

    it("不存在的 Agent 返回失败", async () => {
      const { chat } = setupBasicOrg();
      const result = await engine.executeWithDryRun(
        "non-existent", "publish", "任务", chat.id
      );
      expect("status" in result && result.status).toBe("failed");
    });

    it("SENSITIVE_OPERATIONS 包含预期操作类型", () => {
      expect(WorkflowEngine.SENSITIVE_OPERATIONS).toContain("publish");
      expect(WorkflowEngine.SENSITIVE_OPERATIONS).toContain("send_email");
      expect(WorkflowEngine.SENSITIVE_OPERATIONS).toContain("deploy");
      expect(WorkflowEngine.SENSITIVE_OPERATIONS).toContain("payment");
      expect(WorkflowEngine.SENSITIVE_OPERATIONS).toContain("delete");
    });
  });
});

// ============================================================
// BUP-05: 决策超时自动升级定时器
// ============================================================
describe("BUP-05 决策超时自动升级", () => {
  beforeEach(resetStore);

  it("超时后自动选择默认选项", async () => {
    const { specialist1, chat } = setupBasicOrg();
    const msg = useAppStore.getState().sendMessage(chat.id, "report_card", specialist1.id, "需要决策", {
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

    // 启动 100ms 超时定时器
    startDecisionTimeout(chat.id, msg.id, 100, "default");

    // 等待超时触发
    await new Promise((r) => setTimeout(r, 150));

    const messages = useAppStore.getState().messages[chat.id];
    const resolved = messages.find((m) => m.id === msg.id);
    expect(resolved?.reportCard?.resolved).toBe(true);
    expect(resolved?.reportCard?.resolvedOption).toBe("default");

    // 应有超时通知
    expect(messages.some((m) => m.content.includes("决策超时"))).toBe(true);
  });

  it("超时后升级到上级", async () => {
    const { supervisor, specialist1, chat } = setupBasicOrg();
    const msg = useAppStore.getState().sendMessage(chat.id, "report_card", specialist1.id, "需要决策", {
      reportCard: {
        title: "需要决策",
        problem: "问题",
        options: [{ id: "a", label: "选项A" }],
        resolved: false,
      },
    });

    startDecisionTimeout(chat.id, msg.id, 100, "a", supervisor.id);

    await new Promise((r) => setTimeout(r, 150));

    const messages = useAppStore.getState().messages[chat.id];
    expect(messages.some((m) => m.content.includes("升级"))).toBe(true);
  });

  it("手动决策后清除定时器", async () => {
    const { specialist1, chat } = setupBasicOrg();
    const msg = useAppStore.getState().sendMessage(chat.id, "report_card", specialist1.id, "需要决策", {
      reportCard: {
        title: "需要决策",
        problem: "问题",
        options: [{ id: "a", label: "选项A" }, { id: "b", label: "选项B" }],
        resolved: false,
      },
    });

    startDecisionTimeout(chat.id, msg.id, 200, "b");

    // 在超时前手动决策
    useAppStore.getState().resolveReportCard(chat.id, msg.id, "a");
    clearDecisionTimeout(chat.id, msg.id);

    await new Promise((r) => setTimeout(r, 250));

    // 不应有超时通知（因为已手动决策并清除定时器）
    const messages = useAppStore.getState().messages[chat.id];
    expect(messages.some((m) => m.content.includes("决策超时"))).toBe(false);
  });
});

// ============================================================
// RFT-03: 心跳检测定时器
// ============================================================
describe("RFT-03 心跳检测", () => {
  beforeEach(resetStore);

  it("updateHeartbeat 更新心跳时间", () => {
    const { specialist1 } = setupBasicOrg();
    updateHeartbeat(specialist1.id);
    // 不抛异常即通过
    expect(true).toBe(true);
  });

  it("stopHeartbeatMonitor 清理定时器", () => {
    const { specialist1, chat } = setupBasicOrg();
    startHeartbeatMonitor(specialist1.id, chat.id, 5000);
    stopHeartbeatMonitor(specialist1.id);
    // 不抛异常即通过
    expect(true).toBe(true);
  });

  it("心跳超时触发告警", async () => {
    const { specialist1, chat } = setupBasicOrg();
    // 启动 100ms 间隔的心跳检测
    startHeartbeatMonitor(specialist1.id, chat.id, 100, 3);

    // 不更新心跳，等待超时
    await new Promise((r) => setTimeout(r, 250));

    const messages = useAppStore.getState().messages[chat.id];
    expect(messages.some((m) => m.type === "heartbeat_alert")) .toBe(true);

    // 清理
    stopHeartbeatMonitor(specialist1.id);
  });

  it("定期更新心跳不会触发告警", async () => {
    const { specialist1, chat } = setupBasicOrg();
    startHeartbeatMonitor(specialist1.id, chat.id, 200, 3);

    // 在检测间隔内更新心跳
    const interval = setInterval(() => updateHeartbeat(specialist1.id), 50);

    await new Promise((r) => setTimeout(r, 500));

    const messages = useAppStore.getState().messages[chat.id] || [];
    expect(messages.some((m) => m.type === "heartbeat_alert")).toBe(false);

    clearInterval(interval);
    stopHeartbeatMonitor(specialist1.id);
  });
});

// ============================================================
// SOLO-01: 休息模式运行时执行引擎
// ============================================================
describe("SOLO-01 休息模式执行引擎", () => {
  beforeEach(resetStore);

  it("休息模式未启用时不处理", () => {
    const { chat } = setupBasicOrg();
    const result = handleRestModeTask("任务", "描述", chat.id);
    expect(result.handled).toBe(false);
    expect(result.action).toBe("none");
  });

  it("auto_execute 规则由值班主管处理", () => {
    const { supervisor, chat } = setupBasicOrg();
    useAppStore.getState().setRestMode({
      enabled: true,
      dutyAgentId: supervisor.id,
      rules: [{ condition: "always", action: "auto_execute" }],
    });
    const result = handleRestModeTask("紧急任务", "需要立即处理", chat.id);
    expect(result.handled).toBe(true);
    expect(result.action).toBe("auto_execute");
    expect(result.dutyAgentId).toBe(supervisor.id);
    expect(result.message).toContain("营销主管");
  });

  it("sms_summary 规则发送短信摘要", async () => {
    const { chat } = setupBasicOrg();
    useAppStore.getState().setRestMode({
      enabled: true,
      rules: [{ condition: "always", action: "sms_summary" }],
    });
    const result = handleRestModeTask("任务", "描述内容", chat.id);
    expect(result.handled).toBe(true);
    expect(result.action).toBe("sms_summary");
    // sendSmsSummary 是异步的，未配置网关时降级为系统消息
    await vi.waitFor(() => {
      const messages = useAppStore.getState().messages[chat.id];
      expect(messages?.some((m) => m.content.includes("短信摘要") || m.content.includes("短信已发送"))).toBe(true);
    });
  });

  it("record 规则仅记录", () => {
    const { chat } = setupBasicOrg();
    useAppStore.getState().setRestMode({
      enabled: true,
      rules: [{ condition: "always", action: "record" }],
    });
    const result = handleRestModeTask("任务", "描述", chat.id);
    expect(result.handled).toBe(true);
    expect(result.action).toBe("record");
  });

  it("条件匹配任务标题", () => {
    const { supervisor, chat } = setupBasicOrg();
    useAppStore.getState().setRestMode({
      enabled: true,
      dutyAgentId: supervisor.id,
      rules: [{ condition: "紧急", action: "auto_execute" }],
    });
    const result = handleRestModeTask("紧急修复", "修复线上问题", chat.id);
    expect(result.handled).toBe(true);
    expect(result.action).toBe("auto_execute");
  });

  it("无匹配规则时默认记录", () => {
    const { chat } = setupBasicOrg();
    useAppStore.getState().setRestMode({
      enabled: true,
      rules: [{ condition: "紧急", action: "auto_execute" }],
    });
    const result = handleRestModeTask("普通任务", "日常任务", chat.id);
    expect(result.handled).toBe(true);
    expect(result.action).toBe("record");
  });

  it("无值班主管时 auto_execute 降级为记录", () => {
    const { chat } = setupBasicOrg();
    useAppStore.getState().setRestMode({
      enabled: true,
      rules: [{ condition: "always", action: "auto_execute" }],
    });
    const result = handleRestModeTask("任务", "描述", chat.id);
    expect(result.handled).toBe(true);
    expect(result.action).toBe("auto_execute");
    expect(result.message).toContain("无值班主管");
  });
});
