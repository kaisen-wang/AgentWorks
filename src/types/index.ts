// ============================================================
// AgentWorks - 核心类型定义
// ============================================================

// --- 基础类型 ---
export type AgentId = string;
export type TaskId = string;
export type MessageId = string;
export type ChatId = string;
export type ArchiveId = string;
export type KnowledgeId = string;
export type ScriptId = string;

// --- Agent 相关 ---

/** Agent 动作状态 */
export type ActionStatus = "idle" | "executing" | "summarizing" | "reporting" | "archived" | "error";

/** Agent 角色 */
export type AgentRole = "supervisor" | "specialist" | "general";

/** Agent 配置 */
export interface AgentConfig {
  model: string;           // 使用的 LLM 模型，如 "gpt-4", "gpt-3.5-turbo"
  temperature: number;     // 生成温度
  timeout: number;         // 动作超时时间（毫秒），默认 30000
  maxRetries: number;      // 最大重试次数，默认 3
  decisionThreshold: number; // 决策阈值（元），低于此值自动批准
  monthlyBudget: number;   // 月度预算（美元）
  budgetUsed: number;      // 已用预算
  budgetAlertThreshold: number; // 预算告警阈值（百分比），默认 0.9
  llmEndpoint?: string;    // LLM API 端点（OpenAI 兼容接口）
  llmApiKey?: string;      // LLM API Key
}

/** Agent 能力标签 */
export interface AgentCapability {
  name: string;            // 如 "design", "publish", "analytics"
  description: string;     // 自然语言描述
  tools?: string[];        // 所需外部工具/API
}

/** Agent 实体 */
export interface Agent {
  id: AgentId;
  name: string;            // 显示名称，如 "营销主管"
  role: AgentRole;
  parentId: AgentId | null; // 直接上级，null 表示直属老板
  childIds: AgentId[];     // 直接下属列表
  maxChildren: number;     // 管理幅度上限，默认 5
  spanExemption: boolean;  // 管理幅度临时豁免状态 (ORG-07)
  spanExemptionReason?: string; // 豁免原因
  capabilities: AgentCapability[];
  config: AgentConfig;
  status: ActionStatus;    // 当前动作状态
  avatar: string;          // 头像标识符: "bot" | "user" | "supervisor" | "specialist" | "group" | "collaborator"
  createdAt: number;       // 创建时间戳
  updatedAt: number;       // 更新时间戳
}

// --- 组织架构 ---

/** 组织架构树 */
export interface OrgChart {
  rootAgentIds: AgentId[]; // 直属老板的 Agent（parentId === null）
  agents: Record<AgentId, Agent>;
}

// --- 任务相关 ---

/** 任务状态 */
export type TaskStatus = "pending" | "in_progress" | "completed" | "failed" | "cancelled";

/** 任务优先级 */
export type TaskPriority = "low" | "medium" | "high" | "urgent";

/** 子任务 */
export interface SubTask {
  id: TaskId;
  parentTaskId: TaskId;
  assigneeId: AgentId;     // 负责的 Agent
  title: string;
  description: string;
  status: TaskStatus;
  result?: string;         // 执行结果
  deadline?: number;       // 截止时间戳
  createdAt: number;
  completedAt?: number;
}

/** 任务 */
export interface Task {
  id: TaskId;
  title: string;
  description: string;
  assigneeId: AgentId;     // 负责的主管 Agent
  subTasks: SubTask[];
  status: TaskStatus;
  priority: TaskPriority;
  projectId?: string;      // 所属项目 ID (ORG-08, SOLO-06)
  deadline?: number;
  chatId: ChatId;          // 关联的群聊
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

// --- 消息相关 ---

/** 消息类型 */
export type MessageType =
  | "text"           // 纯文本
  | "task_card"      // 任务卡片
  | "report_card"    // 上报卡片（带决策按钮）
  | "budget_alert"   // 预算告警
  | "heartbeat_alert" // 心跳告警
  | "progress"       // 进度条
  | "file"           // 文件
  | "image"          // 图片
  | "system";        // 系统消息

/** 决策选项 */
export interface DecisionOption {
  id: string;
  label: string;          // 如 "A) 缩短文案"
  selected?: boolean;
}

/** 上报卡片 */
export interface ReportCard {
  title: string;          // 如 "需要决策"
  problem: string;        // 问题描述
  attemptedSolutions?: string; // 已尝试方案
  options: DecisionOption[];
  isUrgent?: boolean;     // 紧急上报标记 (BUP-06)
  isCrossDepartment?: boolean; // 跨部门请求标记 (BUP-07)
  resolved?: boolean;
  resolvedOption?: string;
}

/** 任务卡片 */
export interface TaskCard {
  taskId: TaskId;
  title: string;
  assigneeName: string;
  deadline?: number;
  status: TaskStatus;
  subTaskCount: number;
  completedSubTaskCount: number;
  progress: number;       // 0-100
}

/** 预算告警 */
export interface BudgetAlert {
  agentId: AgentId;
  agentName: string;
  budgetUsed: number;
  budgetTotal: number;
  usagePercent: number;
  options: DecisionOption[];
}

/** 心跳告警 */
export interface HeartbeatAlert {
  agentId: AgentId;
  agentName: string;
  reason: string;
  retryCount: number;
  maxRetries: number;
  options: DecisionOption[];
}

/** 进度数据 (UI-03) */
export interface ProgressData {
  label: string;          // 进度描述
  current: number;        // 当前值
  total: number;          // 总值
  unit?: string;          // 单位（如 "%"、"步"、"页"）
}

/** 文件数据 (UI-03) */
export interface FileData {
  name: string;           // 文件名
  size: number;           // 文件大小（字节）
  mimeType: string;       // MIME 类型
  url?: string;           // 下载链接
}

/** 图片数据 (UI-03) */
export interface ImageData {
  url: string;            // 图片链接
  alt?: string;           // 替代文本
  width?: number;         // 宽度
  height?: number;        // 高度
}

/** 消息 */
export interface Message {
  id: MessageId;
  chatId: ChatId;
  type: MessageType;
  senderId: AgentId | "user" | "system"; // 发送者
  content: string;        // 文本内容
  taskCard?: TaskCard;
  reportCard?: ReportCard;
  budgetAlert?: BudgetAlert;
  heartbeatAlert?: HeartbeatAlert;
  progressData?: ProgressData;
  fileData?: FileData;
  imageData?: ImageData;
  replyToId?: MessageId;  // 回复的消息 ID（线程）
  mentions?: AgentId[];   // @提及的 Agent
  timestamp: number;
}

// --- 聊天相关 ---

/** 聊天类型 */
export type ChatType = "direct" | "group";

/** 聊天成员 */
export interface ChatMember {
  id: AgentId | "user";
  name: string;
  avatar: string;
  role: "owner" | "member" | "readonly" | "external"; // 外部协作者
}

/** 聊天/会话 */
export interface Chat {
  id: ChatId;
  type: ChatType;
  name: string;            // 群聊名称或单聊对方名称
  members: ChatMember[];
  lastMessage?: string;
  lastMessageTime?: number;
  createdAt: number;
}

// --- 归档相关 ---

/** 归档记录 */
export interface ArchiveRecord {
  id: ArchiveId;
  taskId: TaskId;
  agentId: AgentId;
  agentName: string;
  taskTitle: string;
  input: string;           // 任务输入
  output: string;          // 任务输出
  intermediateSteps?: string[]; // 中间状态
  cost: number;            // 费用（美元）
  apiCalls: number;        // API 调用次数
  model: string;           // 使用的模型
  duration: number;        // 耗时（毫秒）
  tags?: string[];         // 标签
  createdAt: number;
}

// --- 知识库相关 ---

/** 知识库层级 */
export type KnowledgeScope = "global" | "department" | "personal";

/** 知识条目 */
export interface KnowledgeEntry {
  id: KnowledgeId;
  scope: KnowledgeScope;
  agentId?: AgentId;       // personal/department 级别关联的 Agent
  key: string;             // 知识键，如 "brand_color"
  value: string;           // 知识值，如 "#00FF00"
  updatedAt: number;
}

// --- 剧本相关 ---

/** 剧本步骤 */
export interface ScriptStep {
  agentId: AgentId;
  action: string;          // 动作描述
  assignTo?: AgentId;      // 分配给哪个下属
}

/** 剧本 */
export interface Script {
  id: ScriptId;
  name: string;            // 如 "新品宣发_标准流程"
  description: string;
  steps: ScriptStep[];
  createdAt: number;
}

// --- 项目目录 (ORG-08, SOLO-06) ---

/** 项目 */
export interface Project {
  id: string;
  name: string;
  createdAt: number;
}

// --- 外部协作者 ---

/** 外部协作者 */
export interface ExternalCollaborator {
  id: string;
  name: string;
  chatIds: ChatId[];       // 可访问的群聊
  invitedAt: number;
  removedAt?: number;
}

// --- 审计日志 ---

/** 审计日志条目 */
export interface AuditLogEntry {
  id: string;
  agentId: AgentId;
  action: string;          // "execute" | "summarize" | "report" | "archive"
  content: string;
  contentHash: string;     // 内容哈希，防篡改
  timestamp: number;
}

// --- 老板休息模式 ---

/** 休息模式规则 */
export interface RestModeRule {
  condition: string;       // 如 "budget < 10"
  action: "auto_execute" | "sms_summary" | "record";
}

/** 休息模式配置 */
export interface RestModeConfig {
  enabled: boolean;
  dutyAgentId?: AgentId;   // 值班主管 Agent
  rules: RestModeRule[];
  enabledAt?: number;
  disabledAt?: number;
}

// --- 插件市场 (EXT-02) ---

/** 插件定义 */
export interface PluginDefinition {
  id: string;
  name: string;            // 如 "Gmail 连接器"
  description: string;
  category: string;        // 如 "email", "storage", "payment", "crm"
  icon?: string;
  configSchema?: Record<string, PluginConfigField>;  // 配置字段定义
}

/** 插件配置字段 */
export interface PluginConfigField {
  type: "string" | "number" | "boolean" | "select";
  label: string;
  required?: boolean;
  options?: string[];      // select 类型的选项
  defaultValue?: unknown;
}

/** 已安装的插件实例 */
export interface InstalledPlugin {
  id: string;
  pluginId: string;        // 关联 PluginDefinition.id
  name: string;
  config: Record<string, unknown>;
  enabled: boolean;
  installedAt: number;
}

// --- 外部事件触发 (EXT-03) ---

/** Webhook 定义 */
export interface WebhookDefinition {
  id: string;
  name: string;
  url: string;             // Webhook 接收 URL
  secret?: string;         // 签名密钥
  events: WebhookEventType[];
  targetAgentId?: AgentId; // 触发目标 Agent
  enabled: boolean;
  createdAt: number;
}

/** Webhook 事件类型 */
export type WebhookEventType =
  | "task.created"
  | "task.completed"
  | "task.failed"
  | "decision.required"
  | "decision.resolved"
  | "budget.alert"
  | "heartbeat.alert"
  | "agent.status_changed";

/** Webhook 事件载荷 */
export interface WebhookPayload {
  event: WebhookEventType;
  timestamp: number;
  data: Record<string, unknown>;
  source: string;
}

// --- A/B 测试 (EXT-04) ---

/** A/B 测试实验定义 */
export interface ABExperiment {
  id: string;
  name: string;              // 实验名称
  description: string;
  variants: ABVariant[];     // 变体列表
  status: "draft" | "running" | "completed";
  startDate?: number;
  endDate?: number;
  metrics: ABMetric[];       // 收集的指标
  createdAt: number;
}

/** A/B 测试变体 */
export interface ABVariant {
  id: string;
  name: string;              // 如 "control", "treatment_a"
  agentConfig: Partial<AgentConfig>;  // 该变体使用的 Agent 配置
  trafficWeight: number;     // 流量权重 (0-1, 所有变体之和为 1)
}

/** A/B 测试指标 */
export interface ABMetric {
  name: string;              // 如 "task_completion_rate", "avg_cost", "user_satisfaction"
  variantResults: Record<string, number>;  // variantId -> 指标值
}

/** A/B 测试分配结果 */
export interface ABAssignment {
  experimentId: string;
  variantId: string;
  variantName: string;
}
