import { create } from "zustand";
import { persist } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";
import type {
  Agent, AgentId, AgentConfig, AgentCapability, AgentRole, ActionStatus,
  OrgChart, Chat, ChatId, ChatType, ChatMember, Message, MessageId, MessageType,
  Task, TaskId, TaskStatus, SubTask, TaskPriority,
  TaskCard, ReportCard, BudgetAlert, HeartbeatAlert, DecisionOption,
  ArchiveRecord, ArchiveId, Script, ScriptId, ExternalCollaborator,
  KnowledgeEntry, KnowledgeId, KnowledgeScope, Project,
  AuditLogEntry, RestModeConfig,
  PluginDefinition, InstalledPlugin, WebhookDefinition, WebhookEventType, WebhookPayload,
  ABExperiment, ABVariant, ABMetric, ABAssignment,
} from "@/types";

// ============================================================
// 默认值工厂
// ============================================================

const defaultAgentConfig = (): AgentConfig => ({
  model: "deepseek-v4-flash",
  temperature: 0.7,
  timeout: 30000,
  maxRetries: 3,
  decisionThreshold: 5,
  monthlyBudget: 10,
  budgetUsed: 0,
  budgetAlertThreshold: 0.9,
});

const AVATAR_MAP: Record<string, string> = {
  supervisor: "supervisor",
  specialist: "specialist",
  general: "bot",
};

// ============================================================
// App Store 定义
// ============================================================

export interface AppState {
  // --- 组织架构 ---
  agents: Record<AgentId, Agent>;
  createAgent: (name: string, role: AgentRole, parentId: AgentId | null, capabilities?: AgentCapability[], config?: Partial<AgentConfig>, description?: string) => Agent | { error: string };
  deleteAgent: (id: AgentId) => void;
  updateAgent: (id: AgentId, updates: Partial<Agent>) => void;
  setParent: (agentId: AgentId, parentId: AgentId | null, force?: boolean) => { success: boolean; error?: string }; // RFT-05: force 跳过循环检测
  updateMaxChildren: (agentId: AgentId, max: number) => void;
  grantSpanExemption: (agentId: AgentId, reason: string) => { success: boolean; error?: string }; // ORG-07
  revokeSpanExemption: (agentId: AgentId) => void; // ORG-07
  getOrgChart: () => OrgChart;
  getSubordinates: (agentId: AgentId) => Agent[];
  getAncestors: (agentId: AgentId) => Agent[];
  detectCycle: (agentId: AgentId, targetParentId: AgentId) => boolean; // RFT-05

  // --- 项目目录 (ORG-08, SOLO-06) ---
  projects: Project[];
  currentProjectId: string | null;
  createProject: (name: string) => Project | { error: string };
  switchProject: (projectId: string) => void;
  deleteProject: (projectId: string) => void;
  getTasksByProject: (projectId: string | null) => Task[]; // 按项目过滤任务
  getArchivesByProject: (projectId: string | null) => ArchiveRecord[]; // 按项目过滤归档
  getScriptsByProject: (projectId: string | null) => Script[]; // 按项目过滤剧本 (KNL-06)

  // --- 聊天 ---
  chats: Record<ChatId, Chat>;
  activeChatId: ChatId | null;
  createChat: (type: ChatType, name: string, members: ChatMember[]) => Chat;
  deleteChat: (id: ChatId) => void;
  setActiveChat: (id: ChatId) => void;
  addMemberToChat: (chatId: ChatId, member: ChatMember) => void;
  removeMemberFromChat: (chatId: ChatId, memberId: string) => void;

  // --- 消息 ---
  messages: Record<ChatId, Message[]>;
  sendMessage: (chatId: ChatId, type: MessageType, senderId: AgentId | "user" | "system", content: string, extra?: Partial<Message>) => Message;
  resolveReportCard: (chatId: ChatId, messageId: MessageId, optionId: string) => void;
  resolveBudgetAlert: (chatId: ChatId, messageId: MessageId, optionId: string) => void; // SOLO-03

  // --- 任务 ---
  tasks: Record<TaskId, Task>;
  createTask: (title: string, description: string, assigneeId: AgentId, chatId: ChatId, priority?: TaskPriority, deadline?: number) => Task;
  addSubTask: (taskId: TaskId, assigneeId: AgentId, title: string, description: string, priority?: TaskPriority, deadline?: number) => SubTask;
  updateSubTaskStatus: (taskId: TaskId, subTaskId: TaskId, status: TaskStatus, result?: string) => void;
  updateTaskStatus: (taskId: TaskId, status: TaskStatus) => void;

  // --- 归档 ---
  archives: ArchiveRecord[];
  addArchive: (record: Omit<ArchiveRecord, "id">) => ArchiveRecord;
  searchArchives: (query: string) => ArchiveRecord[];

  // --- 剧本 ---
  scripts: Record<ScriptId, Script>;
  saveScript: (name: string, description: string, steps: Script["steps"]) => Script;

  // --- 知识库 ---
  knowledge: Record<KnowledgeId, KnowledgeEntry>;
  addKnowledge: (scope: KnowledgeScope, key: string, value: string, agentId?: AgentId) => KnowledgeEntry;
  getKnowledge: (scope: KnowledgeScope, key: string, agentId?: AgentId) => KnowledgeEntry | undefined;

  // --- 外部协作者 ---
  externalCollaborators: ExternalCollaborator[];
  inviteCollaborator: (name: string, chatId: ChatId) => ExternalCollaborator;
  removeCollaborator: (id: string) => void;

  // --- 审计日志 ---
  auditLogs: AuditLogEntry[];
  addAuditLog: (agentId: AgentId, action: string, content: string) => void;

  // --- 休息模式 ---
  restMode: RestModeConfig;
  setRestMode: (config: Partial<RestModeConfig>) => void;

  // --- Agent 动作状态 ---
  setAgentStatus: (agentId: AgentId, status: ActionStatus) => void;
  updateAgentBudget: (agentId: AgentId, cost: number) => { alert?: BudgetAlert };

  // --- 工作区克隆 (SOLO-04) ---
  cloneWorkspace: (suffix: string) => Record<AgentId, AgentId>;

  // --- 插件市场 (EXT-02) ---
  availablePlugins: PluginDefinition[];
  installedPlugins: InstalledPlugin[];
  installPlugin: (pluginId: string, config: Record<string, unknown>) => InstalledPlugin;
  uninstallPlugin: (pluginId: string) => void;

  // --- Webhook 事件触发 (EXT-03) ---
  webhooks: WebhookDefinition[];
  registerWebhook: (webhook: Omit<WebhookDefinition, "id" | "createdAt">) => WebhookDefinition;
  removeWebhook: (webhookId: string) => void;
  emitEvent: (event: WebhookEventType, data: Record<string, unknown>) => void;

  // --- A/B 测试 (EXT-04) ---
  abExperiments: ABExperiment[];
  createExperiment: (name: string, description: string, variants: ABVariant[]) => ABExperiment;
  startExperiment: (experimentId: string) => void;
  stopExperiment: (experimentId: string) => void;
  assignVariant: (experimentId: string) => ABAssignment | null;
  recordMetric: (experimentId: string, metricName: string, variantId: string, value: number) => void;

  // --- 任务转移 (ORG-04) ---
  transferTasks: (fromAgentId: AgentId, toAgentId: AgentId) => number;

  // --- UI 状态 ---
  showCreateAgentPanel: boolean;
  createAgentInitialName: string;
  openCreateAgentPanel: (initialName?: string) => void;
  closeCreateAgentPanel: () => void;
  showAgentDetailId: AgentId | null;
  openAgentDetail: (agentId: AgentId) => void;
  closeAgentDetail: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
  // ============================================================
  // 组织架构
  // ============================================================
  agents: {},

  createAgent: (name, role, parentId, capabilities = [], config, description = "") => {
    const state = get();
    const id = uuidv4();

    // ORG-03: 管理幅度限制检查
    if (parentId && state.agents[parentId]) {
      const parent = state.agents[parentId];
      if (parent.childIds.length >= parent.maxChildren) {
        return { error: `${parent.name}的管理幅度已达上限 ${parent.maxChildren}，请先调整架构或提升上限。` };
      }
    }

    const agent: Agent = {
      id,
      name,
      description,
      role,
      parentId,
      childIds: [],
      maxChildren: 5,
      spanExemption: false,
      capabilities,
      config: { ...defaultAgentConfig(), ...config },
      status: "idle",
      avatar: AVATAR_MAP[role] || "bot",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    set((s: AppState) => {
      const agents = { ...s.agents, [id]: agent };
      if (parentId && agents[parentId]) {
        agents[parentId] = {
          ...agents[parentId],
          childIds: [...agents[parentId].childIds, id],
          updatedAt: Date.now(),
        };
      }
      return { agents };
    });

    // 已移除SmartSync，数据直接存储到SQLite

    return agent;
  },

  deleteAgent: (id) => {
    set((s: AppState) => {
      const agent = s.agents[id];
      if (!agent) return s;

      // ORG-04: 删除前将任务转移给上级（保留历史任务）
      const parentId = agent.parentId;
      if (parentId && s.agents[parentId]) {
        // 转移该 Agent 的任务到上级
        const updatedTasks = { ...s.tasks };
        for (const [taskId, task] of Object.entries(updatedTasks)) {
          if (task.assigneeId === id) {
            updatedTasks[taskId] = { ...task, assigneeId: parentId, updatedAt: Date.now() };
          }
          const updatedSubTasks = task.subTasks.map((sub) =>
            sub.assigneeId === id ? { ...sub, assigneeId: parentId } : sub
          );
          if (updatedSubTasks !== task.subTasks) {
            updatedTasks[taskId] = { ...updatedTasks[taskId], subTasks: updatedSubTasks, updatedAt: Date.now() };
          }
        }
        s = { ...s, tasks: updatedTasks };
      }

      const agents = { ...s.agents };
      // 从父级移除
      if (agent.parentId && agents[agent.parentId]) {
        agents[agent.parentId] = {
          ...agents[agent.parentId],
          childIds: agents[agent.parentId].childIds.filter((cid) => cid !== id),
        };
      }
      // 递归删除下属
      const removeRecursive = (agentId: string) => {
        const a = agents[agentId];
        if (a) {
          a.childIds.forEach(removeRecursive);
          delete agents[agentId];
        }
      };
      removeRecursive(id);

      return { agents, tasks: s.tasks };
    });

    // 已移除SmartSync，数据直接存储到SQLite
  },

  updateAgent: (id, updates) => {
    set((s: AppState) => {
      if (!s.agents[id]) return s;
      return {
        agents: {
          ...s.agents,
          [id]: { ...s.agents[id], ...updates, updatedAt: Date.now() },
        },
      };
    });

    // 已移除SmartSync，数据直接存储到SQLite
    const agent = get().agents[id];
    // 已移除SmartSync，数据直接存储到SQLite
  },

  setParent: (agentId, newParentId, force) => {
    const state = get();
    const agent = state.agents[agentId];
    if (!agent) return { success: false, error: "Agent 不存在" };

    // RFT-05: 循环引用检测（force=true 时跳过）
    if (!force && newParentId && state.detectCycle(agentId, newParentId)) {
      return { success: false, error: `检测到循环引用，不能将 ${agent.name} 设为该上级的下属。如需强制指定，请使用"强制指定上级"` };
    }

    // ORG-03: 检查新父级的管理幅度
    if (newParentId && state.agents[newParentId]) {
      const newParent = state.agents[newParentId];
      // 如果不是已经在该父级下，需要检查幅度
      if (agent.parentId !== newParentId) {
        const effectiveLimit = newParent.spanExemption ? newParent.maxChildren + 1 : newParent.maxChildren;
        if (newParent.childIds.length >= effectiveLimit) {
          return { success: false, error: `${newParent.name}的管理幅度已达上限 ${newParent.maxChildren}，请先调整架构、提升上限或申请临时豁免。` };
        }
      }
    }

    set((s: AppState) => {
      const agents = { ...s.agents };
      // 从旧父级移除
      if (agent.parentId && agents[agent.parentId]) {
        agents[agent.parentId] = {
          ...agents[agent.parentId],
          childIds: agents[agent.parentId].childIds.filter((cid) => cid !== agentId),
        };
      }
      // 添加到新父级
      if (newParentId && agents[newParentId]) {
        agents[newParentId] = {
          ...agents[newParentId],
          childIds: [...agents[newParentId].childIds, agentId],
        };
      }
      // 更新 agent
      agents[agentId] = { ...agents[agentId], parentId: newParentId, updatedAt: Date.now() };

      return { agents };
    });

    return { success: true };
  },

  updateMaxChildren: (agentId, max) => {
    set((s: AppState) => {
      if (!s.agents[agentId]) return s;
      return {
        agents: {
          ...s.agents,
          [agentId]: { ...s.agents[agentId], maxChildren: max, updatedAt: Date.now() },
        },
      };
    });
  },

  getOrgChart: () => {
    const { agents } = get();
    const rootAgentIds = Object.values(agents)
      .filter((a) => a.parentId === null)
      .map((a) => a.id);
    return { rootAgentIds, agents };
  },

  getSubordinates: (agentId) => {
    const { agents } = get();
    const agent = agents[agentId];
    if (!agent) return [];
    return agent.childIds.map((id) => agents[id]).filter(Boolean);
  },

  getAncestors: (agentId) => {
    const { agents } = get();
    const result: Agent[] = [];
    let current = agents[agentId];
    while (current?.parentId) {
      const parent = agents[current.parentId];
      if (parent) result.push(parent);
      current = parent;
    }
    return result;
  },

  // RFT-05: 循环引用检测
  detectCycle: (agentId, targetParentId) => {
    const { agents } = get();
    // 沿 targetParentId 向上遍历，如果遇到 agentId 则形成循环
    let current: Agent | undefined = agents[targetParentId];
    const visited = new Set<AgentId>();
    while (current) {
      if (current.id === agentId) return true;
      if (visited.has(current.id)) return true; // 防止无限循环
      visited.add(current.id);
      current = current.parentId ? agents[current.parentId] : undefined;
    }
    return false;
  },

  // ORG-07: 管理幅度临时豁免
  grantSpanExemption: (agentId, reason) => {
    const state = get();
    const agent = state.agents[agentId];
    if (!agent) return { success: false, error: "Agent 不存在" };
    if (agent.spanExemption) return { success: false, error: "该 Agent 已处于豁免状态" };

    set((s: AppState) => ({
      agents: {
        ...s.agents,
        [agentId]: { ...s.agents[agentId], spanExemption: true, spanExemptionReason: reason, updatedAt: Date.now() },
      },
    }));
    return { success: true };
  },

  revokeSpanExemption: (agentId) => {
    set((s: AppState) => {
      if (!s.agents[agentId]) return s;
      return {
        agents: {
          ...s.agents,
          [agentId]: { ...s.agents[agentId], spanExemption: false, spanExemptionReason: undefined, updatedAt: Date.now() },
        },
      };
    });
  },

  // ============================================================
  // 项目目录 (ORG-08, SOLO-06)
  // ============================================================
  projects: [],
  currentProjectId: null,

  createProject: (name) => {
    const state = get();
    if (state.projects.some((p) => p.name === name)) {
      return { error: `项目"${name}"已存在` };
    }
    const project: Project = { id: uuidv4(), name, createdAt: Date.now() };
    set((s: AppState) => ({ projects: [...s.projects, project] }));
    return project;
  },

  switchProject: (projectId) => {
    set({ currentProjectId: projectId });
  },

  deleteProject: (projectId) => {
    set((s: AppState) => ({
      projects: s.projects.filter((p) => p.id !== projectId),
      currentProjectId: s.currentProjectId === projectId ? null : s.currentProjectId,
    }));
  },

  getTasksByProject: (projectId) => {
    const { tasks } = get();
    const allTasks = Object.values(tasks) as Task[];
    if (projectId === null) return allTasks;
    return allTasks.filter((t) => t.projectId === projectId);
  },

  getArchivesByProject: (projectId) => {
    const { archives } = get();
    if (projectId === null) return archives;
    // KNL-06: 优先使用 ArchiveRecord 自身的 projectId，回退到通过 task 关联
    return archives.filter((a) => {
      if (a.projectId) return a.projectId === projectId;
      // 回退：通过 task 关联查找
      const { tasks } = get();
      const task = (Object.values(tasks) as Task[]).find((t) => t.id === a.taskId);
      return task?.projectId === projectId;
    });
  },

  getScriptsByProject: (projectId) => {
    const { scripts } = get();
    const allScripts = Object.values(scripts) as Script[];
    if (projectId === null) return allScripts;
    return allScripts.filter((s) => s.projectId === projectId);
  },

  // ============================================================
  // 聊天
  // ============================================================
  chats: {},
  activeChatId: null,

  createChat: (type, name, members) => {
    const id = uuidv4();
    const chat: Chat = { id, type, name, members, createdAt: Date.now() };
    set((s: AppState) => ({ chats: { ...s.chats, [id]: chat } }));
    return chat;
  },

  deleteChat: (id) => {
    set((s: AppState) => {
      const { [id]: _, ...rest } = s.chats;
      return { chats: rest, activeChatId: s.activeChatId === id ? null : s.activeChatId };
    });
  },

  setActiveChat: (id) => set({ activeChatId: id }),

  addMemberToChat: (chatId, member) => {
    set((s: AppState) => {
      const chat = s.chats[chatId];
      if (!chat) return s;
      return {
        chats: {
          ...s.chats,
          [chatId]: { ...chat, members: [...chat.members, member] },
        },
      };
    });
  },

  removeMemberFromChat: (chatId, memberId) => {
    set((s: AppState) => {
      const chat = s.chats[chatId];
      if (!chat) return s;
      return {
        chats: {
          ...s.chats,
          [chatId]: { ...chat, members: chat.members.filter((m) => m.id !== memberId) },
        },
      };
    });
  },

  // ============================================================
  // 消息
  // ============================================================
  messages: {},

  sendMessage: (chatId, type, senderId, content, extra) => {
    const id = uuidv4();
    const msg: Message = {
      id,
      chatId,
      type,
      senderId,
      content,
      timestamp: Date.now(),
      ...extra,
    };
    set((s: AppState) => ({
      messages: {
        ...s.messages,
        [chatId]: [...(s.messages[chatId] || []), msg],
      },
      chats: s.chats[chatId]
        ? {
            ...s.chats,
            [chatId]: {
              ...s.chats[chatId],
              lastMessage: content.slice(0, 50),
              lastMessageTime: Date.now(),
            },
          }
        : s.chats,
    }));
    return msg;
  },

  resolveReportCard: (chatId, messageId, optionId) => {
    set((s: AppState) => {
      const msgs = s.messages[chatId];
      if (!msgs) return s;
      return {
        messages: {
          ...s.messages,
          [chatId]: msgs.map((m) => {
            if (m.id !== messageId || !m.reportCard) return m;
            return {
              ...m,
              reportCard: {
                ...m.reportCard,
                resolved: true,
                resolvedOption: optionId,
                options: m.reportCard.options.map((o) => ({
                  ...o,
                  selected: o.id === optionId,
                })),
              },
            };
          }),
        },
      };
    });
  },

  // SOLO-03: 预算告警选项处理
  resolveBudgetAlert: (chatId, messageId, optionId) => {
    const state = get();
    const msg = state.messages[chatId]?.find((m) => m.id === messageId);
    if (!msg?.budgetAlert) return;

    const alert = msg.budgetAlert;
    const agentId = alert.agentId;
    const agent = state.agents[agentId];
    if (!agent) return;

    switch (optionId) {
      case "increase": {
        // 增加额度至 1.5 倍
        const newBudget = Math.round(alert.budgetTotal * 1.5);
        set((s: AppState) => ({
          agents: {
            ...s.agents,
            [agentId]: {
              ...s.agents[agentId],
              config: { ...s.agents[agentId].config, monthlyBudget: newBudget },
              updatedAt: Date.now(),
            },
          },
        }));
        break;
      }
      case "downgrade": {
        // 切换至低成本模型
        const lowCostModel = "gpt-3.5-turbo";
        set((s: AppState) => ({
          agents: {
            ...s.agents,
            [agentId]: {
              ...s.agents[agentId],
              config: { ...s.agents[agentId].config, model: lowCostModel },
              updatedAt: Date.now(),
            },
          },
        }));
        break;
      }
      case "auto_downgrade": {
        // 标记超额后自动降级（在 config 中记录标记）
        set((s: AppState) => ({
          agents: {
            ...s.agents,
            [agentId]: {
              ...s.agents[agentId],
              config: { ...s.agents[agentId].config, budgetAlertThreshold: 1.0 }, // 超额后才触发
              updatedAt: Date.now(),
            },
          },
        }));
        break;
      }
    }

    // 标记该告警已处理
    set((s: AppState) => {
      const msgs = s.messages[chatId];
      if (!msgs) return s;
      return {
        messages: {
          ...s.messages,
          [chatId]: msgs.map((m) => {
            if (m.id !== messageId || !m.budgetAlert) return m;
            return {
              ...m,
              budgetAlert: {
                ...m.budgetAlert,
                options: m.budgetAlert.options.map((o) => ({
                  ...o,
                  selected: o.id === optionId,
                })),
              },
            };
          }),
        },
      };
    });
  },

  // ============================================================
  // 任务
  // ============================================================
  tasks: {},

  createTask: (title, description, assigneeId, chatId, priority = "medium", deadline) => {
    const id = uuidv4();
    const state = get();
    const task: Task = {
      id,
      title,
      description,
      assigneeId,
      subTasks: [],
      status: "pending",
      priority,
      projectId: state.currentProjectId ?? undefined, // ORG-08: 自动关联当前项目
      deadline,
      chatId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set((s: AppState) => ({ tasks: { ...s.tasks, [id]: task } }));
    return task;
  },

  addSubTask: (taskId, assigneeId, title, description, priority, deadline) => {
    const id = uuidv4();
    const state = get();
    // TDN-06: 子任务继承父任务优先级
    const parentTask = state.tasks[taskId];
    const inheritedPriority = priority || parentTask?.priority || "medium";
    const subTask: SubTask = {
      id,
      parentTaskId: taskId,
      assigneeId,
      title,
      description,
      status: "pending",
      priority: inheritedPriority,
      deadline,
      createdAt: Date.now(),
    };
    set((s: AppState) => {
      const task = s.tasks[taskId];
      if (!task) return s;
      return {
        tasks: {
          ...s.tasks,
          [taskId]: {
            ...task,
            subTasks: [...task.subTasks, subTask],
            updatedAt: Date.now(),
          },
        },
      };
    });
    return subTask;
  },

  updateSubTaskStatus: (taskId, subTaskId, status, result) => {
    set((s: AppState) => {
      const task = s.tasks[taskId];
      if (!task) return s;
      return {
        tasks: {
          ...s.tasks,
          [taskId]: {
            ...task,
            subTasks: task.subTasks.map((st) =>
              st.id === subTaskId
                ? { ...st, status, result: result ?? st.result, completedAt: status === "completed" ? Date.now() : st.completedAt }
                : st
            ),
            updatedAt: Date.now(),
          },
        },
      };
    });
  },

  updateTaskStatus: (taskId, status) => {
    set((s: AppState) => {
      const task = s.tasks[taskId];
      if (!task) return s;
      return {
        tasks: {
          ...s.tasks,
          [taskId]: {
            ...task,
            status,
            updatedAt: Date.now(),
            completedAt: status === "completed" ? Date.now() : task.completedAt,
          },
        },
      };
    });
  },

  // ============================================================
  // 归档
  // ============================================================
  archives: [],

  addArchive: (record) => {
    const id = uuidv4();
    const state = get();
    // KNL-06: 自动关联当前项目（如果 record 未指定 projectId）
    const archive: ArchiveRecord = { ...record, id, projectId: record.projectId ?? state.currentProjectId ?? undefined };
    set((s: AppState) => ({ archives: [...s.archives, archive] }));
    return archive;
  },

  searchArchives: (query) => {
    const { archives } = get();
    const q = query.toLowerCase();
    return archives.filter(
      (a) =>
        a.taskTitle.toLowerCase().includes(q) ||
        a.agentName.toLowerCase().includes(q) ||
        a.input.toLowerCase().includes(q) ||
        a.output.toLowerCase().includes(q) ||
        a.tags?.some((t) => t.toLowerCase().includes(q))
    );
  },

  // ============================================================
  // 剧本
  // ============================================================
  scripts: {},

  saveScript: (name, description, steps) => {
    const id = uuidv4();
    const state = get();
    const script: Script = { id, name, description, steps, projectId: state.currentProjectId ?? undefined, createdAt: Date.now() };
    set((s: AppState) => ({ scripts: { ...s.scripts, [id]: script } }));
    return script;
  },

  // ============================================================
  // 知识库
  // ============================================================
  knowledge: {},

  addKnowledge: (scope, key, value, agentId) => {
    const id = uuidv4();
    const entry: KnowledgeEntry = { id, scope, agentId, key, value, updatedAt: Date.now() };
    set((s: AppState) => ({ knowledge: { ...s.knowledge, [id]: entry } }));
    return entry;
  },

  getKnowledge: (scope, key, agentId) => {
    const { knowledge } = get();
    return Object.values(knowledge).find(
      (e) => e.scope === scope && e.key === key && (scope === "global" || e.agentId === agentId)
    );
  },

  // ============================================================
  // 外部协作者
  // ============================================================
  externalCollaborators: [],

  inviteCollaborator: (name, chatId) => {
    const collab: ExternalCollaborator = {
      id: uuidv4(),
      name,
      chatIds: [chatId],
      // SOLO-05: 外部协作者默认不可查看组织架构、全局归档、审计日志
      permissions: {
        canViewOrgChart: false,
        canViewGlobalArchives: false,
        canViewAuditLogs: false,
      },
      invitedAt: Date.now(),
    };
    set((s: AppState) => ({ externalCollaborators: [...s.externalCollaborators, collab] }));
    return collab;
  },

  removeCollaborator: (id) => {
    set((s: AppState) => ({
      externalCollaborators: s.externalCollaborators.map((c) =>
        c.id === id ? { ...c, removedAt: Date.now() } : c
      ),
    }));
  },

  // ============================================================
  // 审计日志
  // ============================================================
  auditLogs: [],

  addAuditLog: (agentId, action, content) => {
    // SHA-256 哈希（RFT-01: 审计日志完整性）
    let contentHash: string;
    try {
      const { createHash } = require("crypto");
      contentHash = createHash("sha256").update(content).digest("hex");
    } catch {
      // 浏览器环境 fallback
      contentHash = content.split("").reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0).toString(36);
    }
    const entry: AuditLogEntry = {
      id: uuidv4(),
      agentId,
      action,
      content,
      contentHash,
      timestamp: Date.now(),
    };
    set((s: AppState) => ({ auditLogs: [...s.auditLogs, entry] }));
  },

  // ============================================================
  // 休息模式
  // ============================================================
  restMode: { enabled: false, rules: [] },

  setRestMode: (config) => {
    set((s: AppState) => ({ restMode: { ...s.restMode, ...config } }));
  },

  // ============================================================
  // Agent 动作状态 & 预算
  // ============================================================
  setAgentStatus: (agentId, status) => {
    set((s: AppState) => {
      if (!s.agents[agentId]) return s;
      return {
        agents: {
          ...s.agents,
          [agentId]: { ...s.agents[agentId], status, updatedAt: Date.now() },
        },
      };
    });
  },

  updateAgentBudget: (agentId, cost) => {
    const state = get();
    const agent = state.agents[agentId];
    if (!agent) return {};

    const newBudgetUsed = agent.config.budgetUsed + cost;
    const usagePercent = newBudgetUsed / agent.config.monthlyBudget;

    set((s: AppState) => ({
      agents: {
        ...s.agents,
        [agentId]: {
          ...s.agents[agentId],
          config: { ...s.agents[agentId].config, budgetUsed: newBudgetUsed },
          updatedAt: Date.now(),
        },
      },
    }));

    // SOLO-03: 预算告警
    if (usagePercent >= agent.config.budgetAlertThreshold) {
      const alert: BudgetAlert = {
        agentId,
        agentName: agent.name,
        budgetUsed: newBudgetUsed,
        budgetTotal: agent.config.monthlyBudget,
        usagePercent,
        options: [
          { id: "increase", label: `增加额度至 ¥${agent.config.monthlyBudget * 1.5}` },
          { id: "downgrade", label: "切换至低精度模型" },
          { id: "auto_downgrade", label: "超额后自动降级" },
        ],
      };
      return { alert };
    }

    return {};
  },

  // ============================================================
  // 工作区克隆 (SOLO-04)
  // ============================================================
  cloneWorkspace: (suffix) => {
    const state = get();
    const idMapping: Record<AgentId, AgentId> = {};

    // 1. 深拷贝所有 Agent，建立新旧 ID 映射
    const newAgents: Record<AgentId, Agent> = {};
    for (const [oldId, agent] of Object.entries(state.agents)) {
      const newId = uuidv4();
      idMapping[oldId] = newId;
      newAgents[newId] = {
        ...agent,
        id: newId,
        name: `${agent.name} ${suffix}`,
        parentId: agent.parentId ? idMapping[agent.parentId] : null,
        childIds: [], // 稍后填充
        config: { ...agent.config, budgetUsed: 0 },
        status: "idle",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    }
    // 填充 childIds
    for (const [oldId, agent] of Object.entries(state.agents)) {
      const newId = idMapping[oldId];
      newAgents[newId].childIds = agent.childIds.map((cid) => idMapping[cid]).filter(Boolean);
    }

    // 2. 深拷贝剧本
    const newScripts: Record<ScriptId, Script> = {};
    for (const script of Object.values(state.scripts)) {
      const newScriptId = uuidv4();
      newScripts[newScriptId] = {
        ...script,
        id: newScriptId,
        name: `${script.name} ${suffix}`,
        steps: script.steps.map((step) => ({
          ...step,
          agentId: idMapping[step.agentId] || step.agentId,
          assignTo: step.assignTo ? (idMapping[step.assignTo] || step.assignTo) : undefined,
        })),
        createdAt: Date.now(),
      };
    }

    // 3. 深拷贝知识库
    const newKnowledge: Record<KnowledgeId, KnowledgeEntry> = {};
    for (const entry of Object.values(state.knowledge)) {
      const newEntryId = uuidv4();
      newKnowledge[newEntryId] = {
        ...entry,
        id: newEntryId,
        agentId: entry.agentId ? (idMapping[entry.agentId] || entry.agentId) : undefined,
        updatedAt: Date.now(),
      };
    }

    set((s: AppState) => ({
      agents: { ...s.agents, ...newAgents },
      scripts: { ...s.scripts, ...newScripts },
      knowledge: { ...s.knowledge, ...newKnowledge },
    }));

    return idMapping;
  },

  // ============================================================
  // 任务转移 (ORG-04) - 含能力标签校验
  // ============================================================
  transferTasks: (fromAgentId, toAgentId) => {
    const state = get();
    const toAgent = state.agents[toAgentId];
    if (!toAgent) return 0;

    // 能力标签校验：检查目标 Agent 是否具备原 Agent 的能力
    const fromAgent = state.agents[fromAgentId];
    const capabilityWarnings: string[] = [];
    if (fromAgent && fromAgent.capabilities.length > 0) {
      const toCapNames = new Set(toAgent.capabilities.map((c) => c.name));
      const missingCaps = fromAgent.capabilities.filter((c) => !toCapNames.has(c.name));
      if (missingCaps.length > 0) {
        capabilityWarnings.push(
          `目标 Agent "${toAgent.name}" 缺少能力: ${missingCaps.map((c) => c.name).join(", ")}`
        );
      }
    }

    let count = 0;
    set((s: AppState) => {
      const updatedTasks = { ...s.tasks };
      for (const [taskId, task] of Object.entries(s.tasks)) {
        // 转移主任务
        if (task.assigneeId === fromAgentId) {
          updatedTasks[taskId] = { ...task, assigneeId: toAgentId, updatedAt: Date.now() };
          count++;
        }
        // 转移子任务
        const updatedSubTasks = task.subTasks.map((sub) => {
          if (sub.assigneeId === fromAgentId) {
            count++;
            return { ...sub, assigneeId: toAgentId };
          }
          return sub;
        });
        if (updatedSubTasks !== task.subTasks) {
          updatedTasks[taskId] = { ...updatedTasks[taskId] || task, subTasks: updatedSubTasks, updatedAt: Date.now() };
        }
      }
      return { tasks: updatedTasks };
    });

    // 记录审计日志（含能力校验结果）
    if (capabilityWarnings.length > 0) {
      get().addAuditLog(toAgentId, "execute", `任务重分配警告: ${capabilityWarnings.join("; ")}`);
    }
    if (count > 0) {
      get().addAuditLog(fromAgentId, "execute", `转移 ${count} 个任务到 ${toAgent.name}`);
    }

    return count;
  },

  // ============================================================
  // UI 状态
  // ============================================================
  showCreateAgentPanel: false,
  createAgentInitialName: "",
  openCreateAgentPanel: (initialName = "") => set({ showCreateAgentPanel: true, createAgentInitialName: initialName }),
  closeCreateAgentPanel: () => set({ showCreateAgentPanel: false, createAgentInitialName: "" }),
  showAgentDetailId: null,
  openAgentDetail: (agentId) => set({ showAgentDetailId: agentId }),
  closeAgentDetail: () => set({ showAgentDetailId: null }),

  // ============================================================
  // 插件市场 (EXT-02)
  // ============================================================
  availablePlugins: [
    { id: "gmail", name: "Gmail 连接器", description: "发送和读取 Gmail 邮件", category: "email" },
    { id: "notion", name: "Notion 连接器", description: "读写 Notion 页面和数据库", category: "storage" },
    { id: "stripe", name: "Stripe 连接器", description: "处理支付和订阅", category: "payment" },
    { id: "slack", name: "Slack 连接器", description: "发送消息到 Slack 频道", category: "communication" },
  ],

  installedPlugins: [],

  installPlugin: (pluginId, config) => {
    const plugin = useAppStore.getState().availablePlugins.find((p: PluginDefinition) => p.id === pluginId);
    const installed: InstalledPlugin = {
      id: uuidv4(),
      pluginId,
      name: plugin?.name || pluginId,
      config,
      enabled: true,
      installedAt: Date.now(),
    };
    set((s: AppState) => ({ installedPlugins: [...s.installedPlugins, installed] }));
    return installed;
  },

  uninstallPlugin: (pluginId) => {
    set((s: AppState) => ({
      installedPlugins: s.installedPlugins.filter((p) => p.pluginId !== pluginId),
    }));
  },

  // ============================================================
  // Webhook 事件触发 (EXT-03)
  // ============================================================
  webhooks: [],

  registerWebhook: (webhook) => {
    const newWebhook: WebhookDefinition = {
      ...webhook,
      id: uuidv4(),
      createdAt: Date.now(),
    };
    set((s: AppState) => ({ webhooks: [...s.webhooks, newWebhook] }));
    return newWebhook;
  },

  removeWebhook: (webhookId) => {
    set((s: AppState) => ({
      webhooks: s.webhooks.filter((w) => w.id !== webhookId),
    }));
  },

  emitEvent: (event, data) => {
    const state = useAppStore.getState();
    const payload: WebhookPayload = {
      event,
      timestamp: Date.now(),
      data,
      source: "agentworks",
    };

    // 触发匹配的 Webhook，真正发送 HTTP 请求
    for (const webhook of state.webhooks) {
      if (webhook.enabled && webhook.events.includes(event)) {
        // 异步发送 Webhook HTTP 请求，不阻塞主流程
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        // 如果配置了签名密钥，生成 HMAC-SHA256 签名放在头部
        if (webhook.secret) {
          try {
            const crypto = require("crypto");
            const signature = crypto
              .createHmac("sha256", webhook.secret)
              .update(JSON.stringify(payload))
              .digest("hex");
            headers["X-Webhook-Signature"] = signature;
          } catch {
            // crypto 不可用时跳过签名
          }
        }

        fetch(webhook.url, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        }).then((res) => {
          state.addAuditLog(
            webhook.targetAgentId || "system",
            "webhook_emit",
            `Webhook ${webhook.name}: ${event} -> ${res.status}`
          );
        }).catch((err) => {
          state.addAuditLog(
            webhook.targetAgentId || "system",
            "webhook_emit_error",
            `Webhook ${webhook.name}: ${event} -> ERROR: ${err instanceof Error ? err.message : String(err)}`
          );
        });
      }
    }
  },

  // ============================================================
  // A/B 测试 (EXT-04)
  // ============================================================
  abExperiments: [],

  createExperiment: (name, description, variants) => {
    const experiment: ABExperiment = {
      id: uuidv4(),
      name,
      description,
      variants,
      status: "draft",
      metrics: [],
      createdAt: Date.now(),
    };
    set((s: AppState) => ({ abExperiments: [...s.abExperiments, experiment] }));
    return experiment;
  },

  startExperiment: (experimentId) => {
    set((s: AppState) => ({
      abExperiments: s.abExperiments.map((e) =>
        e.id === experimentId ? { ...e, status: "running" as const, startDate: Date.now() } : e
      ),
    }));
  },

  stopExperiment: (experimentId) => {
    set((s: AppState) => ({
      abExperiments: s.abExperiments.map((e) =>
        e.id === experimentId ? { ...e, status: "completed" as const, endDate: Date.now() } : e
      ),
    }));
  },

  assignVariant: (experimentId): ABAssignment | null => {
    const experiment = useAppStore.getState().abExperiments.find((e: ABExperiment) => e.id === experimentId);
    if (!experiment || experiment.status !== "running") return null;

    // 按流量权重分配变体
    const rand = Math.random();
    let cumulative = 0;
    for (const variant of experiment.variants) {
      cumulative += variant.trafficWeight;
      if (rand <= cumulative) {
        return {
          experimentId,
          variantId: variant.id,
          variantName: variant.name,
        };
      }
    }
    // 兜底返回最后一个变体
    const last = experiment.variants[experiment.variants.length - 1];
    return { experimentId, variantId: last.id, variantName: last.name };
  },

  recordMetric: (experimentId, metricName, variantId, value) => {
    set((s: AppState) => ({
      abExperiments: s.abExperiments.map((e) => {
        if (e.id !== experimentId) return e;
        const existingMetric = e.metrics.find((m) => m.name === metricName);
        if (existingMetric) {
          return {
            ...e,
            metrics: e.metrics.map((m) =>
              m.name === metricName
                ? { ...m, variantResults: { ...m.variantResults, [variantId]: value } }
                : m
            ),
          };
        }
        return {
          ...e,
          metrics: [...e.metrics, { name: metricName, variantResults: { [variantId]: value } }],
        };
      }),
    }));
  },
}),
    {
      name: "agentworks-store",
      partialize: (state: AppState) => ({
        agents: state.agents,
        projects: state.projects,
        currentProjectId: state.currentProjectId,
        chats: state.chats,
        activeChatId: state.activeChatId,
        messages: state.messages,
        tasks: state.tasks,
        archives: state.archives,
        scripts: state.scripts,
        knowledge: state.knowledge,
        externalCollaborators: state.externalCollaborators,
        auditLogs: state.auditLogs,
        restMode: state.restMode,
        installedPlugins: state.installedPlugins,
        webhooks: state.webhooks,
        abExperiments: state.abExperiments,
      }),
      storage: {
        getItem: (name: string) => {
          try {
            const str = localStorage.getItem(name);
            return str ? JSON.parse(str) : null;
          } catch {
            return null;
          }
        },
        setItem: (name: string, value: unknown) => {
          try {
            localStorage.setItem(name, JSON.stringify(value));
          } catch {
            console.warn("[AgentWorks] localStorage 容量不足，清除旧数据");
            try {
              localStorage.removeItem(name);
              localStorage.setItem(name, JSON.stringify(value));
            } catch {
              console.error("[AgentWorks] localStorage 持久化失败");
            }
          }
        },
        removeItem: (name: string) => localStorage.removeItem(name),
      },
    }
  )
);

// ============================================================
// 服务端数据同步（/api/sync 集成）
// ============================================================

let syncTimer: ReturnType<typeof setInterval> | null = null;
const SYNC_INTERVAL = 30_000; // 30 秒同步一次
const SYNC_ENDPOINT = "/api/sync";

/** 同步数据到服务端 SQLite */
export async function syncToServer(): Promise<{ synced: boolean; error?: string }> {
  try {
    const state = useAppStore.getState();
    const payload = {
      agents: Object.values(state.agents),
      projects: state.projects,
      tasks: Object.values(state.tasks),
    };

    const res = await fetch(SYNC_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      return { synced: false, error: `HTTP ${res.status}` };
    }

    const data = await res.json();
    return { synced: data.synced !== false };
  } catch (err) {
    return { synced: false, error: err instanceof Error ? err.message : "未知错误" };
  }
}

/** 从服务端加载数据 */
export async function loadFromServer(): Promise<boolean> {
  try {
    const res = await fetch(SYNC_ENDPOINT);
    if (!res.ok) return false;
    const data = await res.json();

    // 只有当服务端有数据时才合并
    if (data.agents && Array.isArray(data.agents) && data.agents.length > 0) {
      useAppStore.setState((state: AppState) => {
        // 使用智能合并策略，根据 name+role 去重
        const mergedAgents = mergeAgentsWithDedup(state.agents, data.agents);

        return {
          ...state,
          agents: mergedAgents,
        };
      });
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * 合并 Agent 数据并去重
 * 根据 name + role 进行去重，服务端数据优先
 */
function mergeAgentsWithDedup(
  localAgents: Record<AgentId, Agent>,
  serverAgents: Agent[]
): Record<AgentId, Agent> {
  const merged: Record<AgentId, Agent> = {};

  // 创建服务端数据的映射（按 name+role）
  const serverAgentMap = new Map<string, Agent>();
  for (const agent of serverAgents) {
    const key = `${agent.name}_${agent.role}`;
    serverAgentMap.set(key, agent);
  }

  // 创建本地数据的映射（按 name+role）
  const localAgentMap = new Map<string, Agent>();
  for (const agent of Object.values(localAgents)) {
    const key = `${agent.name}_${agent.role}`;
    localAgentMap.set(key, agent);
  }

  // 合并策略：服务端数据优先
  // 1. 先添加所有服务端数据
  for (const agent of serverAgents) {
    merged[agent.id] = agent;
  }

  // 2. 添加本地独有的数据（服务端没有的 name+role 组合）
  for (const [key, agent] of localAgentMap) {
    if (!serverAgentMap.has(key)) {
      merged[agent.id] = agent;
    }
  }

  return merged;
}

/** 启动定时同步 */
export function startAutoSync(): void {
  if (syncTimer) return;
  // 首次加载时从服务端拉取
  loadFromServer().catch(() => {});
  syncTimer = setInterval(() => {
    syncToServer().catch(() => {});
  }, SYNC_INTERVAL);
}

/** 停止定时同步 */
export function stopAutoSync(): void {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
}
