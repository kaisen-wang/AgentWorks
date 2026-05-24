/**
 * WorkflowEngine - 双向工作流引擎
 *
 * 实现：
 * - TDN-01: 用户下达宏观任务
 * - TDN-02: 主管自动拆解并分配
 * - BUP-01: 下属异常自动上报
 * - BUP-02: 结构化上报 + 决策卡片
 * - BUP-04: 决策阈值（自动批准）
 * - RFT-01: 超时重试
 */

import { useAppStore } from "@/stores/appStore";
import { SupervisorAgent, SpecialistAgent } from "@/lib/agent";
import { sendSmsSummary } from "@/lib/notification/NotificationService";
import type {
  AgentId, TaskId, ChatId, MessageId, Agent, Task, SubTask, Message,
  ReportCard, DecisionOption, TaskCard, BudgetAlert, HeartbeatAlert,
} from "@/types";

/** 工作流执行结果 */
interface WorkflowResult {
  taskId: TaskId;
  status: "started" | "decomposed" | "completed" | "failed";
  message: string;
}

/** Dry-run 模拟执行结果 (RFT-02) */
interface DryRunResult {
  dryRun: true;
  operation: string;
  agentId: AgentId;
  agentName: string;
  preview: string;
  confirmed: false;
}

/**
 * WorkflowEngine - 工作流引擎
 *
 * 协调 Agent 之间的任务流转，包括：
 * 1. Top-down: 任务下达 → 拆解 → 分配
 * 2. Bottom-up: 执行 → 汇总 → 上报 → 决策
 */
export class WorkflowEngine {
  private agentInstances: Map<AgentId, SupervisorAgent | SpecialistAgent> = new Map();

  /** 获取或创建 Agent 实例 */
  private getAgentInstance(agent: Agent): SupervisorAgent | SpecialistAgent {
    if (this.agentInstances.has(agent.id)) {
      return this.agentInstances.get(agent.id)!;
    }

    let instance: SupervisorAgent | SpecialistAgent;
    if (agent.role === "supervisor") {
      instance = new SupervisorAgent(agent.id, agent.name, agent.config, agent.capabilities);
    } else {
      instance = new SpecialistAgent(agent.id, agent.name, agent.config, agent.capabilities);
    }
    this.agentInstances.set(agent.id, instance);
    return instance;
  }

  // ============================================================
  // Top-down: 从上到下
  // ============================================================

  /**
   * 下达宏观任务（TDN-01）
   *
   * 用户在群聊中向主管 Agent 下达任务，
   * 系统将消息标记为"任务"并触发拆解流程。
   */
  async assignTask(
    taskTitle: string,
    taskDescription: string,
    assigneeId: AgentId,
    chatId: ChatId,
    priority?: "low" | "medium" | "high" | "urgent",
    deadline?: number
  ): Promise<WorkflowResult> {
    const store = useAppStore.getState();
    const agent = store.agents[assigneeId];

    if (!agent) {
      return { taskId: "", status: "failed", message: `Agent ${assigneeId} 不存在` };
    }

    // 创建任务
    const task = store.createTask(taskTitle, taskDescription, assigneeId, chatId, priority, deadline);

    // 发送任务卡片消息
    const taskCard: TaskCard = {
      taskId: task.id,
      title: taskTitle,
      assigneeName: agent.name,
      deadline,
      status: "pending",
      subTaskCount: 0,
      completedSubTaskCount: 0,
      progress: 0,
    };

    store.sendMessage(chatId, "task_card", assigneeId, taskTitle, { taskCard, mentions: [assigneeId] });

    // 如果是主管，触发自动拆解
    if (agent.role === "supervisor") {
      await this.decomposeAndAssign(task.id, assigneeId, taskDescription, chatId);
    }

    return { taskId: task.id, status: "started", message: `任务已下达给 ${agent.name}` };
  }

  /**
   * 主管自动拆解并分配（TDN-02）
   */
  async decomposeAndAssign(
    taskId: TaskId,
    supervisorId: AgentId,
    taskDescription: string,
    chatId: ChatId
  ): Promise<void> {
    const store = useAppStore.getState();
    const supervisor = store.agents[supervisorId];
    if (!supervisor) return;

    const instance = this.getAgentInstance(supervisor) as SupervisorAgent;
    store.setAgentStatus(supervisorId, "executing");

    // 获取下属列表
    const subordinates = store.getSubordinates(supervisorId);

    // 执行拆解（传入 LLM 配置，如果有的话）
    const decomposition = await instance.decomposeTask(taskDescription, {
      subordinates: subordinates.map((s: Agent) => s.id),
      subordinateCapabilities: subordinates.map((s: Agent) => ({
        id: s.id,
        name: s.name,
        capabilities: s.capabilities,
      })),
      llmConfig: supervisor.config.llmEndpoint ? {
        endpoint: supervisor.config.llmEndpoint,
        apiKey: supervisor.config.llmApiKey || "",
        model: supervisor.config.model,
      } : undefined,
    });

    // 创建子任务（TDN-06: 继承父任务优先级）
    const task = store.tasks[taskId];
    const taskPriority = task?.priority || "medium";
    for (const sub of decomposition.subTasks) {
      store.addSubTask(taskId, sub.assigneeId, sub.title, sub.description, taskPriority);
    }

    // 处理无法匹配下属的子任务 - 上报给上级
    if (decomposition.unmatchedTasks && decomposition.unmatchedTasks.length > 0) {
      const unmatchedSummary = decomposition.unmatchedTasks.join("\n");
      store.sendMessage(
        chatId,
        "system",
        "system",
        `⚠️ 以下子任务无法匹配到合适的下属:\n${unmatchedSummary}\n请手动分配或添加具备相关能力的 Agent。`
      );
      store.addAuditLog(supervisorId, "report", `拆解中有 ${decomposition.unmatchedTasks.length} 个子任务无法匹配下属`);
    }

    // 更新任务状态
    store.updateTaskStatus(taskId, "in_progress");

    // 上报拆解结果
    store.sendMessage(chatId, "text", supervisorId, decomposition.summary);

    store.setAgentStatus(supervisorId, "idle");
    store.addAuditLog(supervisorId, "execute", `拆解任务: ${taskDescription} → ${decomposition.subTasks.length} 个子任务`);

    // 自动驱动子任务执行（执行-上报闭环）
    const currentTask = store.tasks[taskId];
    if (currentTask) {
      for (const subTask of currentTask.subTasks) {
        if (subTask.status === "pending") {
          // 异步执行，不阻塞拆解流程
          this.executeSubTask(subTask.id, taskId, chatId).catch((err) => {
            console.error(`[WorkflowEngine] 子任务 ${subTask.id} 执行失败:`, err);
          });
        }
      }
    }
  }

  // ============================================================
  // Bottom-up: 从下到上
  // ============================================================

  /**
   * 执行子任务并自动触发上报闭环
   *
   * 流程：执行 → 归档 → 上报上级 → 检查父任务是否全部完成
   */
  async executeSubTask(
    subTaskId: TaskId,
    parentTaskId: TaskId,
    chatId: ChatId
  ): Promise<void> {
    const store = useAppStore.getState();
    const task = store.tasks[parentTaskId];
    if (!task) return;

    const subTask = task.subTasks.find((s: SubTask) => s.id === subTaskId);
    if (!subTask || subTask.status !== "pending") return;

    const agent = store.agents[subTask.assigneeId];
    if (!agent) return;

    // 更新子任务状态为执行中
    store.updateSubTaskStatus(parentTaskId, subTaskId, "in_progress");
    store.setAgentStatus(subTask.assigneeId, "executing");

    // 获取 Agent 实例并执行
    const instance = this.getAgentInstance(agent);
    const startTime = Date.now();

    try {
      const result = await instance.executeWithRetry(subTask.description, {
        llmConfig: agent.config.llmEndpoint ? {
          endpoint: agent.config.llmEndpoint,
          apiKey: agent.config.llmApiKey || "",
          model: agent.config.model,
        } : undefined,
      });

      const duration = Date.now() - startTime;

      if (result.success) {
        // 更新子任务结果
        store.updateSubTaskStatus(parentTaskId, subTaskId, "completed", result.data);

        // 归档
        store.addArchive({
          taskId: subTaskId,
          agentId: subTask.assigneeId,
          agentName: agent.name,
          taskTitle: subTask.title,
          input: subTask.description,
          output: result.data,
          cost: result.cost || 0,
          apiCalls: result.apiCalls || 0,
          model: result.model || agent.config.model,
          duration,
          createdAt: Date.now(),
        });

        // 更新预算
        if (result.cost && result.cost > 0) {
          store.updateAgentBudget(subTask.assigneeId, result.cost);
        }

        // 上报完成
        await this.reportCompletion(subTask.assigneeId, parentTaskId, result.data, chatId);

        // 发送进度消息
        store.sendMessage(chatId, "text", subTask.assigneeId, `子任务「${subTask.title}」已完成: ${result.data.slice(0, 100)}`);
      } else {
        // 执行失败
        store.updateSubTaskStatus(parentTaskId, subTaskId, "failed", result.error);

        // 异常上报
        if (agent.parentId) {
          await this.reportDecision(
            subTask.assigneeId,
            chatId,
            "子任务执行失败",
            result.error || "未知错误",
            `任务: ${subTask.description}`,
            [
              { id: "retry", label: "重试" },
              { id: "skip", label: "跳过" },
              { id: "reassign", label: "重新分配" },
            ]
          );
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      store.updateSubTaskStatus(parentTaskId, subTaskId, "failed", errorMsg);
    } finally {
      store.setAgentStatus(subTask.assigneeId, "idle");
    }

    // 检查父任务是否全部完成
    this.checkParentTaskCompletion(parentTaskId, chatId);
  }

  /**
   * 检查父任务的所有子任务是否完成，若全部完成则汇总上报
   */
  private checkParentTaskCompletion(parentTaskId: TaskId, chatId: ChatId): void {
    const store = useAppStore.getState();
    const task = store.tasks[parentTaskId];
    if (!task || task.status !== "in_progress") return;

    const allCompleted = task.subTasks.every(
      (s: SubTask) => s.status === "completed" || s.status === "failed" || s.status === "cancelled"
    );

    if (allCompleted) {
      const completedCount = task.subTasks.filter((s: SubTask) => s.status === "completed").length;
      const failedCount = task.subTasks.filter((s: SubTask) => s.status === "failed").length;

      store.updateTaskStatus(parentTaskId, failedCount === 0 ? "completed" : "failed");

      // 主管汇总
      const supervisor = store.agents[task.assigneeId];
      if (supervisor) {
        const summary = `任务「${task.title}」执行完毕: ${completedCount} 成功, ${failedCount} 失败`;
        store.sendMessage(chatId, "text", task.assigneeId, summary);
        store.addAuditLog(task.assigneeId, "summarize", summary);
      }
    }
  }

  /**
   * 下属完成执行后上报（BUP-01, BUP-03）
   */
  async reportCompletion(
    agentId: AgentId,
    taskId: TaskId,
    result: string,
    chatId: ChatId
  ): Promise<void> {
    const store = useAppStore.getState();
    const agent = store.agents[agentId];
    if (!agent) return;

    store.setAgentStatus(agentId, "reporting");

    // 归档
    store.setAgentStatus(agentId, "archived");
    store.addArchive({
      taskId,
      agentId,
      agentName: agent.name,
      taskTitle: result.slice(0, 50),
      input: "",
      output: result,
      cost: 0.01,
      apiCalls: 1,
      model: agent.config.model,
      duration: 0,
      createdAt: Date.now(),
    });

    // 上报给上级
    if (agent.parentId) {
      const parent = store.agents[agent.parentId];
      if (parent) {
        store.sendMessage(chatId, "text", agentId, `上报: ${result}`);
      }
    }

    store.setAgentStatus(agentId, "idle");
    store.addAuditLog(agentId, "report", result);
  }

  /**
   * 异常上报 - 需要决策（BUP-01, BUP-02）
   *
   * 上报内容结构化：问题描述 + 已尝试方案 + 建议决策选项
   */
  async reportDecision(
    agentId: AgentId,
    chatId: ChatId,
    title: string,
    problem: string,
    attemptedSolutions: string,
    options: DecisionOption[],
    isUrgent: boolean = false // BUP-06
  ): Promise<Message> {
    const store = useAppStore.getState();
    const agent = store.agents[agentId];
    if (!agent) {
      return store.sendMessage(chatId, "text", "system", "Agent 不存在");
    }

    // BUP-04: 决策阈值检查
    // 如果问题涉及的费用低于阈值，主管可自行批准
    if (agent.parentId) {
      const parent = store.agents[agent.parentId];
      if (parent && parent.config.decisionThreshold > 0) {
        // 从选项标签中提取费用信息
        const costPattern = /[$￥]\s*(\d+(?:\.\d+)?)/;
        for (const option of options) {
          const costMatch = option.label.match(costPattern);
          if (costMatch) {
            const cost = parseFloat(costMatch[1]);
            if (cost <= parent.config.decisionThreshold) {
              // 费用低于阈值，自动批准该选项
              store.sendMessage(
                chatId,
                "system",
                "system",
                `${parent.name} 自动批准: ${option.label}（费用 ${cost} ≤ 阈值 ${parent.config.decisionThreshold}）`
              );
              store.addAuditLog(parent.id, "execute", `自动批准决策: ${option.label}，费用 ${cost}`);
              // 返回一条已自动解决的消息
              const autoReportCard: ReportCard = {
                title,
                problem,
                attemptedSolutions,
                options: options.map((o) => ({ ...o, selected: o.id === option.id })),
                resolved: true,
                resolvedOption: option.id,
              };
              return store.sendMessage(chatId, "report_card", agentId, `${problem}（已自动批准: ${option.label}）`, { reportCard: autoReportCard });
            }
          }
        }
      }
    }

    const reportCard: ReportCard = {
      title,
      problem,
      attemptedSolutions,
      options,
      isUrgent,
      resolved: false,
    };

    // BUP-06: 紧急上报 - 直接推送给老板并高亮
    if (isUrgent) {
      // 发送给老板（user）
      const msg = store.sendMessage(chatId, "report_card", agentId, `【紧急】${problem}`, { reportCard });
      // 同时抄送直接上级
      if (agent.parentId) {
        const parent = store.agents[agent.parentId];
        if (parent) {
          store.sendMessage(chatId, "system", "system", `紧急上报已抄送 ${parent.name}，请立即处理`);
        }
      }
      store.addAuditLog(agentId, "report", `紧急决策上报: ${problem}`);
      return msg;
    }

    const msg = store.sendMessage(chatId, "report_card", agentId, problem, { reportCard });
    store.addAuditLog(agentId, "report", `决策上报: ${problem}`);

    return msg;
  }

  /**
   * 跨部门直接请求（BUP-07）
   *
   * Agent 可 @ 非直属 Agent 提出请求。
   * 被请求方可选择：接受、拒绝、请示上级后回复。
   * 所有跨部门请求记录审计日志。
   */
  async crossDepartmentRequest(
    fromAgentId: AgentId,
    toAgentId: AgentId,
    chatId: ChatId,
    request: string
  ): Promise<Message> {
    const store = useAppStore.getState();
    const fromAgent = store.agents[fromAgentId];
    const toAgent = store.agents[toAgentId];

    if (!fromAgent || !toAgent) {
      return store.sendMessage(chatId, "text", "system", "Agent 不存在");
    }

    // 检查是否为跨部门（非直属关系）
    const isDirectSubordinate = fromAgent.parentId === toAgentId || toAgent.parentId === fromAgentId;
    const isCrossDept = !isDirectSubordinate;

    const reportCard: ReportCard = {
      title: "跨部门请求",
      problem: request,
      attemptedSolutions: undefined,
      isCrossDepartment: isCrossDept,
      options: [
        { id: "accept", label: "接受并直接回复" },
        { id: "reject", label: "拒绝" },
        { id: "escalate", label: "请示上级后回复" },
      ],
      resolved: false,
    };

    const msg = store.sendMessage(
      chatId,
      "report_card",
      fromAgentId,
      `@${toAgent.name} ${request}`,
      { reportCard, mentions: [toAgentId] }
    );

    // 审计日志
    store.addAuditLog(fromAgentId, "report", `跨部门请求 → ${toAgent.name}: ${request}`);
    store.addAuditLog(toAgentId, "report", `收到跨部门请求 ← ${fromAgent.name}: ${request}`);

    return msg;
  }

  /**
   * 预算告警上报（SOLO-03）
   */
  async reportBudgetAlert(
    agentId: AgentId,
    chatId: ChatId,
    alert: BudgetAlert
  ): Promise<Message> {
    const store = useAppStore.getState();
    const msg = store.sendMessage(chatId, "budget_alert", agentId, `预算告警: ${alert.agentName} 已用 ${alert.usagePercent}%`, { budgetAlert: alert });
    store.addAuditLog(agentId, "report", `预算告警: ${alert.usagePercent}%`);
    return msg;
  }

  /**
   * 心跳告警上报（RFT-03）
   */
  async reportHeartbeatAlert(
    agentId: AgentId,
    chatId: ChatId,
    alert: HeartbeatAlert
  ): Promise<Message> {
    const store = useAppStore.getState();
    const msg = store.sendMessage(chatId, "heartbeat_alert", agentId, `Agent 故障: ${alert.agentName}`, { heartbeatAlert: alert });
    store.addAuditLog(agentId, "report", `心跳告警: ${alert.reason}`);
    return msg;
  }

  /**
   * 处理决策响应
   *
   * 用户点击决策按钮后调用
   */
  async resolveDecision(
    chatId: ChatId,
    messageId: string,
    optionId: string
  ): Promise<void> {
    const store = useAppStore.getState();
    store.resolveReportCard(chatId, messageId, optionId);
  }

  // ============================================================
  // 跨层级干预
  // ============================================================

  /**
   * 老板跨级直接给下属下达指令
   *
   * 系统提示是否通知主管
   */
  async directOrder(
    agentId: AgentId,
    instruction: string,
    chatId: ChatId,
    notifySupervisor: boolean = true
  ): Promise<void> {
    const store = useAppStore.getState();
    const agent = store.agents[agentId];
    if (!agent) return;

    // 执行指令
    store.setAgentStatus(agentId, "executing");
    store.sendMessage(chatId, "text", "user", instruction, { mentions: [agentId] });

    // TDN-04: 指令向下传递覆盖 — 如果该 Agent 有下属，级联更新子任务
    const subordinates = store.getSubordinates(agentId);
    if (subordinates.length > 0) {
      // 查找该 Agent 关联的进行中任务
      const relatedTasks = (Object.values(store.tasks) as Task[]).filter(
        (t: Task) => t.assigneeId === agentId && t.status === "in_progress"
      );
      for (const task of relatedTasks) {
        // 更新所有子任务的描述，追加覆盖指令
        for (const subTask of task.subTasks) {
          if (subTask.status === "pending" || subTask.status === "in_progress") {
            store.updateSubTaskStatus(
              task.id,
              subTask.id,
              subTask.status,
              `${subTask.result || ""}\n[上级覆盖指令] ${instruction}`
            );
          }
        }
        store.sendMessage(
          chatId,
          "system",
          "system",
          `指令已向下传递至 ${subordinates.length} 个下属的进行中子任务`
        );
      }
    }

    // 通知主管
    if (notifySupervisor && agent.parentId) {
      const parent = store.agents[agent.parentId];
      if (parent) {
        store.sendMessage(
          chatId,
          "system",
          "system",
          `老板绕过 ${parent.name} 直接向 ${agent.name} 下达了指令`
        );
      }
    }

    store.addAuditLog(agentId, "execute", `跨级指令: ${instruction}`);
    store.setAgentStatus(agentId, "idle");
  }

  // ============================================================
  // 剧本执行引擎 (TDN-05)
  // ============================================================

  /**
   * 运行剧本
   *
   * 按步骤依次执行剧本中定义的 Agent 动作，
   * 支持变量替换（如将产品名替换为新值）。
   */
  async runScript(
    scriptId: string,
    chatId: ChatId,
    replacements?: string
  ): Promise<void> {
    const store = useAppStore.getState();
    const script = store.scripts[scriptId];
    if (!script) {
      store.sendMessage(chatId, "system", "system", `剧本不存在`);
      return;
    }

    // 解析替换变量（格式："产品名为'赛博山水'"）
    const replaceMap: Record<string, string> = {};
    if (replacements) {
      const pairs = replacements.match(/(\S+?)(?:为|改成?|换成?)['"「」](.+?)['"「」]/g);
      if (pairs) {
        for (const pair of pairs) {
          const m = pair.match(/(\S+?)(?:为|改成?|换成?)['"「」](.+?)['"「」]/);
          if (m) replaceMap[m[1]] = m[2];
        }
      }
    }

    store.sendMessage(chatId, "system", "system", `开始执行剧本「${script.name}」，共 ${script.steps.length} 步`);

    for (let i = 0; i < script.steps.length; i++) {
      const step = script.steps[i];
      const agent = store.agents[step.agentId];

      if (!agent) {
        store.sendMessage(chatId, "system", "system", `步骤 ${i + 1}: Agent 不存在，跳过`);
        continue;
      }

      // 变量替换
      let action = step.action;
      for (const [key, value] of Object.entries(replaceMap)) {
        action = action.replace(new RegExp(key, "g"), value);
      }

      store.setAgentStatus(step.agentId, "executing");
      store.sendMessage(
        chatId,
        "text",
        step.agentId,
        `[剧本步骤 ${i + 1}/${script.steps.length}] ${action}`
      );

      // 如果步骤有分配目标，触发任务分配
      if (step.assignTo) {
        const assignToAgent = store.agents[step.assignTo];
        if (assignToAgent) {
          await this.assignTask(action.slice(0, 30), action, step.assignTo, chatId);
        }
      }

      store.setAgentStatus(step.agentId, "idle");
      store.addAuditLog(step.agentId, "execute", `剧本步骤: ${action}`);
    }

    store.sendMessage(chatId, "system", "system", `剧本「${script.name}」执行完成`);
  }

  /**
   * 从已完成的任务流程自动生成剧本 (TDN-05)
   */
  generateScriptFromTask(
    taskId: TaskId,
    scriptName: string,
    scriptDescription: string
  ): string | null {
    const store = useAppStore.getState();
    const task = store.tasks[taskId];
    if (!task) return null;

    const steps = task.subTasks.map((sub: SubTask) => ({
      agentId: sub.assigneeId,
      action: sub.description,
      assignTo: sub.assigneeId as AgentId | undefined,
    }));

    const script = store.saveScript(scriptName, scriptDescription, steps);
    return script.id;
  }

  // ============================================================
  // Dry-run 模式 (RFT-02)
  // ============================================================

  /** 敏感操作类型 */
  static readonly SENSITIVE_OPERATIONS = [
    "publish",      // 发布操作
    "send_email",   // 发送邮件
    "deploy",       // 部署操作
    "payment",      // 支付操作
    "delete",       // 删除操作
  ] as const;

  /**
   * Dry-run 模式执行 (RFT-02)
   *
   * 敏感操作先模拟执行，返回预览结果，用户确认后才真正执行。
   * 非敏感操作直接执行。
   */
  async executeWithDryRun(
    agentId: AgentId,
    operation: string,
    task: string,
    chatId: ChatId,
    context?: Record<string, unknown>
  ): Promise<WorkflowResult | DryRunResult> {
    const store = useAppStore.getState();
    const agent = store.agents[agentId];

    if (!agent) {
      return { taskId: "", status: "failed", message: `Agent ${agentId} 不存在` };
    }

    // 检查是否为敏感操作
    const isSensitive = WorkflowEngine.SENSITIVE_OPERATIONS.some(
      (op) => operation.toLowerCase().includes(op)
    );

    if (isSensitive && !context?.confirmed) {
      // Dry-run: 返回模拟结果，不实际执行
      store.sendMessage(
        chatId,
        "system",
        "system",
        `[Dry-run] ${agent.name} 将执行敏感操作「${operation}」，任务: ${task}。请确认后执行。`
      );
      return {
        dryRun: true,
        operation,
        agentId,
        agentName: agent.name,
        preview: `模拟执行: ${operation} - ${task}`,
        confirmed: false,
      };
    }

    // 非敏感操作或已确认：实际执行
    return this.assignTask(task.slice(0, 30), task, agentId, chatId);
  }
}

// 单例
export const workflowEngine = new WorkflowEngine();

// ============================================================
// BUP-05: 决策超时自动升级定时器
// ============================================================

/** 决策超时定时器映射 */
const decisionTimers = new Map<string, NodeJS.Timeout>();

/**
 * 启动决策超时定时器 (BUP-05)
 *
 * 当决策卡片在 timeoutMs 内未被响应时，自动选择默认选项。
 * 如果指定了 escalateTo，则升级到上级主管。
 */
export function startDecisionTimeout(
  chatId: ChatId,
  messageId: MessageId,
  timeoutMs: number,
  defaultOptionId: string,
  escalateTo?: AgentId
): void {
  // 清除已有定时器
  clearDecisionTimeout(chatId, messageId);

  const timer = setTimeout(() => {
    const store = useAppStore.getState();
    const messages = store.messages[chatId];
    const msg = messages?.find((m: Message) => m.id === messageId);

    if (msg?.reportCard && !msg.reportCard.resolved) {
      // 自动选择默认选项
      store.resolveReportCard(chatId, messageId, defaultOptionId);

      // 发送超时通知
      store.sendMessage(
        chatId,
        "system",
        "system",
        `决策超时，已自动选择默认选项「${defaultOptionId}」${escalateTo ? `，并升级至上级` : ""}`
      );

      // 如果有升级目标，通知上级
      if (escalateTo) {
        const agent = store.agents[escalateTo];
        if (agent) {
          store.sendMessage(
            chatId,
            "system",
            "system",
            `已升级至 ${agent.name} 处理`
          );
        }
      }
    }

    decisionTimers.delete(`${chatId}:${messageId}`);
  }, timeoutMs);

  decisionTimers.set(`${chatId}:${messageId}`, timer);
}

/** 清除决策超时定时器 */
export function clearDecisionTimeout(chatId: ChatId, messageId: MessageId): void {
  const key = `${chatId}:${messageId}`;
  const timer = decisionTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    decisionTimers.delete(key);
  }
}

// ============================================================
// RFT-03: 心跳检测定时器
// ============================================================

/** 心跳检测定时器映射 */
const heartbeatTimers = new Map<AgentId, NodeJS.Timeout>();

/** Agent 最后心跳时间 */
const lastHeartbeat = new Map<AgentId, number>();

/**
 * 启动心跳检测定时器 (RFT-03)
 *
 * 定期检查 Agent 是否在 intervalMs 内发送心跳。
 * 超时则触发心跳告警。
 */
export function startHeartbeatMonitor(
  agentId: AgentId,
  chatId: ChatId,
  intervalMs: number,
  maxRetries: number = 3
): void {
  stopHeartbeatMonitor(agentId);
  lastHeartbeat.set(agentId, Date.now());

  const timer = setInterval(() => {
    const store = useAppStore.getState();
    const agent = store.agents[agentId];

    if (!agent || agent.status === "archived") {
      stopHeartbeatMonitor(agentId);
      return;
    }

    const now = Date.now();
    const last = lastHeartbeat.get(agentId) || now;
    const elapsed = now - last;

    if (elapsed > intervalMs) {
      // 心跳超时，触发告警
      const alert: HeartbeatAlert = {
        agentId,
        agentName: agent.name,
        reason: `心跳超时 ${Math.round(elapsed / 1000)}s`,
        retryCount: 0,
        maxRetries,
        options: [
          { id: "restart", label: "重启Agent" },
          { id: "skip", label: "跳过" },
        ],
      };

      store.sendMessage(chatId, "heartbeat_alert", agentId, `Agent ${agent.name} 心跳超时`, {
        heartbeatAlert: alert,
      });

      // 更新最后心跳时间，避免重复告警
      lastHeartbeat.set(agentId, now);
    }
  }, intervalMs);

  heartbeatTimers.set(agentId, timer);
}

/** 停止心跳检测定时器 */
export function stopHeartbeatMonitor(agentId: AgentId): void {
  const timer = heartbeatTimers.get(agentId);
  if (timer) {
    clearInterval(timer);
    heartbeatTimers.delete(agentId);
  }
  lastHeartbeat.delete(agentId);
}

/** 更新 Agent 心跳时间 */
export function updateHeartbeat(agentId: AgentId): void {
  lastHeartbeat.set(agentId, Date.now());
}

// ============================================================
// SOLO-01: 休息模式运行时执行引擎
// ============================================================

/** 休息模式执行结果 */
export interface RestModeExecutionResult {
  handled: boolean;
  action: string;
  dutyAgentId?: AgentId;
  message: string;
}

/**
 * 休息模式任务处理 (SOLO-01)
 *
 * 当休息模式启用时，根据规则自动处理任务：
 * - auto_execute: 值班主管自动执行
 * - sms_summary: 发送短信摘要
 * - record: 仅记录不执行
 */
export function handleRestModeTask(
  taskTitle: string,
  taskDescription: string,
  chatId: ChatId
): RestModeExecutionResult {
  const store = useAppStore.getState();
  const restMode = store.restMode;

  if (!restMode.enabled) {
    return { handled: false, action: "none", message: "休息模式未启用" };
  }

  // 查找匹配的规则
  for (const rule of restMode.rules) {
    // 简单条件匹配：检查 condition 是否为 "always" 或匹配任务关键词
    const conditionMet = rule.condition === "always" ||
      taskTitle.includes(rule.condition) ||
      taskDescription.includes(rule.condition);

    if (conditionMet) {
      switch (rule.action) {
        case "auto_execute": {
          // 值班主管自动执行
          const dutyAgentId = restMode.dutyAgentId;
          if (dutyAgentId) {
            const agent = store.agents[dutyAgentId];
            store.sendMessage(
              chatId,
              "system",
              "system",
              `[休息模式] 值班主管 ${agent?.name || "未知"} 自动处理任务: ${taskTitle}`
            );
            return {
              handled: true,
              action: "auto_execute",
              dutyAgentId,
              message: `值班主管 ${agent?.name || "未知"} 已自动处理`,
            };
          }
          // 无值班主管，仅记录
          store.sendMessage(chatId, "system", "system", `[休息模式] 无值班主管，任务已记录: ${taskTitle}`);
          return { handled: true, action: "auto_execute", message: "无值班主管，任务已记录" };
        }

        case "sms_summary": {
          // 真正发送短信摘要，未配置网关时降级为系统消息
          sendSmsSummary({
            title: `[休息模式] ${taskTitle}`,
            body: taskDescription.slice(0, 200),
            urgency: "normal",
          }).then((result) => {
            if (result.fallback || !result.success) {
              // 降级：发送系统消息
              store.sendMessage(chatId, "system", "system", `[休息模式] 短信摘要: ${taskTitle} - ${taskDescription.slice(0, 50)}`);
            } else {
              store.sendMessage(chatId, "system", "system", `[休息模式] 短信已发送 (ID: ${result.messageId}): ${taskTitle}`);
            }
          });
          return { handled: true, action: "sms_summary", message: "短信摘要发送中" };
        }

        case "record": {
          // 仅记录
          store.sendMessage(chatId, "system", "system", `[休息模式] 任务已记录: ${taskTitle}`);
          return { handled: true, action: "record", message: "任务已记录" };
        }
      }
    }
  }

  // 无匹配规则，默认记录
  store.sendMessage(chatId, "system", "system", `[休息模式] 无匹配规则，任务已记录: ${taskTitle}`);
  return { handled: true, action: "record", message: "无匹配规则，任务已记录" };
}
