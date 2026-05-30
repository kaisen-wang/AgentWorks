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
  model: string;           // 使用的 LLM 模型，如 "deepseek-v4-flash", "gpt-3.5-turbo"
  temperature: number;     // 生成温度
  timeout: number;         // 动作超时时间（毫秒），默认 30000
  maxRetries: number;      // 最大重试次数，默认 3
  decisionThreshold: number; // 决策阈值（元），低于此值自动批准
  monthlyBudget: number;   // 月度预算（人民币）
  budgetUsed: number;      // 已用预算
  budgetAlertThreshold: number; // 预算告警阈值（百分比），默认 0.9
  reportFrequency?: "on_completion" | "daily" | "weekly"; // BUP-03: 上报频率，默认 on_completion
  llmEndpoint?: string;    // LLM API 端点（OpenAI 兼容接口）
  llmApiKey?: string;      // LLM API Key
  skillsConfig?: {
    autoDiscover: boolean;       // 自动发现 Skills
    maxConcurrency: number;      // 最大并发执行数
  };
  toolsConfig?: {
    autoDiscover: boolean;       // 自动发现 Tools
    maxConcurrency: number;      // 最大并发执行数
  };
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
  description: string;     // Agent 描述
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
  skillIds?: SkillId[];    // 绑定的 Skill ID 列表
  toolIds?: ToolId[];      // 绑定的 Tool ID 列表
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
  priority: TaskPriority;  // TDN-06: 继承父任务优先级
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
  crossDeptReplyType?: "consulted_superior" | "direct_reply"; // BUP-07/UI-07: 跨部门回复类型
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
  cost: number;            // 费用（人民币）
  apiCalls: number;        // API 调用次数
  model: string;           // 使用的模型
  duration: number;        // 耗时（毫秒）
  tags?: string[];         // 标签
  projectId?: string;      // 所属项目 ID (KNL-06)
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
  projectId?: string;      // 所属项目 ID (KNL-06)
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
  permissions: {           // SOLO-05: 访问控制
    canViewOrgChart: boolean;   // 查看组织架构
    canViewGlobalArchives: boolean; // 查看全局归档
    canViewAuditLogs: boolean;  // 查看审计日志
  };
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

// ============================================================
// Skills 和 Tools 相关类型定义
// ============================================================

// --- 基础类型 ---
export type SkillId = string;
export type ToolId = string;

// --- Skill 相关类型 ---

/** Skill 元数据 */
export interface SkillMeta {
  id: SkillId;
  name: string;
  description: string;
  version: string;
  author?: string;
  tags?: string[];
  category?: string;
}

/** Tool 依赖声明 */
export interface ToolDependency {
  toolId: ToolId;
  required: boolean;
  alias?: string;
}

/** Skill 定义 */
export interface SkillDefinition {
  meta: SkillMeta;
  inputSchema: JSONSchema;        // 输入参数的 JSON Schema
  outputSchema: JSONSchema;       // 输出结果的 JSON Schema
  dependencies: ToolDependency[]; // 依赖的 Tools
  executor: SkillExecutor;        // 执行函数
  config?: Record<string, any>;   // Skill 配置
}

/** Skill 执行函数 */
export type SkillExecutor = (context: SkillContext, params: Record<string, any>) => Promise<SkillResult>;

/** Skill 执行上下文 */
export interface SkillContext {
  agentId: AgentId;
  agentConfig: AgentConfig;
  tools: Map<ToolId, ITool>;
  logger: Logger;
  memory: MemoryStore;
}

/** Skill 执行结果 */
export interface SkillResult {
  success: boolean;
  data?: any;
  error?: SkillError;
  metadata?: Record<string, any>;
}

/** Skill 错误 */
export interface SkillError {
  code: string;
  message: string;
  details?: any;
}

/** 已加载的 Skill */
export interface LoadedSkill {
  definition: SkillDefinition;
  tools: Map<ToolId, ITool>;
  status: 'loaded' | 'initialized' | 'error';
  loadedAt: number;
}

// --- Tool 相关类型 ---

/** Tool 元数据 */
export interface ToolMeta {
  id: ToolId;
  name: string;
  description: string;
  version: string;
  category?: string;
  tags?: string[];
}

/** Tool 类型 */
export type ToolType = 'mcp' | 'custom';

/** MCP Tool 定义 */
export interface MCPToolDefinition {
  type: 'mcp';
  meta: ToolMeta;
  endpoint: string;               // MCP 服务器端点
  toolName: string;               // MCP 工具名称
  inputSchema: JSONSchema;
  outputSchema: JSONSchema;
  authType?: 'bearer' | 'basic' | 'none';
  authConfig?: {
    token?: string;
    username?: string;
    password?: string;
  };
  timeout?: number;
}

/** Custom Tool 定义 */
export interface CustomToolDefinition {
  type: 'custom';
  meta: ToolMeta;
  inputSchema: JSONSchema;
  outputSchema: JSONSchema;
  executor: ToolExecutor;
  config?: Record<string, any>;
}

/** Tool 定义（联合类型） */
export type ToolDefinition = MCPToolDefinition | CustomToolDefinition;

/** Tool 执行函数 */
export type ToolExecutor = (params: Record<string, any>, context: ToolExecutionContext) => Promise<ToolResult>;

/** Tool 执行上下文 */
export interface ToolExecutionContext {
  agentId?: AgentId;
  logger?: Logger;
  timeout?: number;
}

/** Tool 执行结果 */
export interface ToolResult {
  success: boolean;
  data?: any;
  error?: ToolError;
  metadata?: Record<string, any>;
}

/** Tool 错误 */
export interface ToolError {
  code: string;
  message: string;
  details?: any;
}

/** Tool 接口 */
export interface ITool {
  definition: ToolDefinition;
  execute(params: Record<string, any>, context?: ToolExecutionContext): Promise<ToolResult>;
  healthCheck(): Promise<HealthStatus>;
}

// --- 资源池相关类型 ---

/** 资源范围 */
export type ResourceScope = 'global' | 'private';

/** 资源池接口 */
export interface IResourcePool<T extends { id: string }> {
  register(resource: T): Promise<void>;
  unregister(id: string): Promise<void>;
  find(id: string): Promise<T | undefined>;
  list(): Promise<T[]>;
  exists(id: string): Promise<boolean>;
}

/** 全局资源池 */
export interface GlobalPool<T extends { id: string }> extends IResourcePool<T> {
  cloneToPrivate(agentId: AgentId, resourceId: string): Promise<T>;
}

/** 私有资源池 */
export interface PrivatePool<T extends { id: string }> extends IResourcePool<T> {
  listByOwner(agentId: AgentId): Promise<T[]>;
  promoteToGlobal(resourceId: string): Promise<T>;
}

/** 资源管理器 */
export interface IResourceManager<T extends { id: string }> {
  registerGlobal(resource: T): Promise<void>;
  registerPrivate(agentId: AgentId, resource: T): Promise<void>;
  find(agentId: AgentId, resourceId: string): Promise<T | undefined>;
  listAccessible(agentId: AgentId): Promise<T[]>;
}

// --- 依赖解析相关类型 ---

/** 依赖节点 */
export interface DependencyNode {
  id: string;
  type: 'skill' | 'tool';
  required: boolean;
  status: 'resolved' | 'missing' | 'error';
}

/** 依赖图 */
export interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  edges: Array<{ from: string; to: string }>;
}

/** 依赖验证结果 */
export interface DependencyValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// --- 注册表相关类型 ---

/** Skill 注册表接口 */
export interface ISkillRegistry {
  register(definition: SkillDefinition, scope: ResourceScope, agentId?: AgentId): Promise<void>;
  unregister(skillId: SkillId, scope: ResourceScope, agentId?: AgentId): Promise<void>;
  find(agentId: AgentId, skillId: SkillId): Promise<SkillDefinition | undefined>;
  listAccessible(agentId: AgentId): Promise<SkillDefinition[]>;
  load(skillId: SkillId): Promise<LoadedSkill>;
  unload(skillId: SkillId): Promise<void>;
  healthCheck(skillId: SkillId): Promise<HealthStatus>;
}

/** Tool 注册表接口 */
export interface IToolRegistry {
  register(definition: ToolDefinition, scope: ResourceScope, agentId?: AgentId): Promise<void>;
  unregister(toolId: ToolId, scope: ResourceScope, agentId?: AgentId): Promise<void>;
  find(agentId: AgentId, toolId: ToolId): Promise<ToolDefinition | undefined>;
  listAccessible(agentId: AgentId): Promise<ToolDefinition[]>;
  execute(toolId: ToolId, params: Record<string, any>, context?: ToolExecutionContext): Promise<ToolResult>;
  healthCheck(toolId: ToolId): Promise<HealthStatus>;
}

/** 依赖解析器接口 */
export interface IDependencyResolver {
  resolve(skill: SkillDefinition): Promise<DependencyGraph>;
  validate(graph: DependencyGraph): Promise<DependencyValidationResult>;
  detectCycle(graph: DependencyGraph): CycleDetectionResult;
  topologicalSort(graph: DependencyGraph): string[];
}

// --- 执行引擎相关类型 ---

/** Skill 执行器接口 */
export interface ISkillExecutor {
  execute(agentId: AgentId, skillId: SkillId, params: Record<string, any>): Promise<SkillResult>;
}

/** Tool 执行器接口 */
export interface IToolExecutor {
  execute(toolId: ToolId, params: Record<string, any>, context?: ToolExecutionContext): Promise<ToolResult>;
  executeBatch(tasks: Array<{ toolId: ToolId; params: Record<string, any> }>, context?: ToolExecutionContext): Promise<ToolResult[]>;
}

/** MCP 适配器接口 */
export interface IMCPAdapter {
  connect(config: MCPConfig): Promise<void>;
  disconnect(): Promise<void>;
  listTools(): Promise<MCPToolInfo[]>;
  callTool(toolName: string, params: Record<string, any>): Promise<any>;
  listResources(): Promise<MCPResourceInfo[]>;
  readResource(uri: string): Promise<any>;
}

/** MCP 配置 */
export interface MCPConfig {
  endpoint: string;
  authType?: 'bearer' | 'basic' | 'none';
  authConfig?: {
    token?: string;
    username?: string;
    password?: string;
  };
  timeout?: number;
  retryConfig?: {
    maxRetries: number;
    retryDelay: number;
  };
}

/** MCP 工具信息 */
export interface MCPToolInfo {
  name: string;
  description: string;
  inputSchema: JSONSchema;
}

/** MCP 资源信息 */
export interface MCPResourceInfo {
  uri: string;
  name: string;
  description?: string;
}

// --- 健康检查相关类型 ---

/** 健康状态 */
export interface HealthStatus {
  healthy: boolean;
  status: 'ok' | 'warning' | 'error';
  message?: string;
  details?: Record<string, any>;
  lastCheck: number;
}

/** 循环检测结果 */
export interface CycleDetectionResult {
  hasCycle: boolean;
  cycle?: string[];
}

// --- 执行日志相关类型 ---

/** 执行日志 */
export interface ExecutionLog {
  id: string;
  resourceType: 'skill' | 'tool';
  resourceId: string;
  agentId: AgentId;
  action: 'execute' | 'health_check' | 'load' | 'unload';
  input?: any;
  output?: any;
  success: boolean;
  error?: string;
  duration: number;
  timestamp: number;
}

// --- 辅助类型 ---

/** JSON Schema */
export interface JSONSchema {
  type: string;
  properties?: Record<string, any>;
  required?: string[];
  additionalProperties?: boolean;
  [key: string]: any;
}

/** Logger 接口 */
export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

/** Memory Store 接口 */
export interface MemoryStore {
  get(key: string): Promise<any>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

// ============================================================
// Skill 安装相关类型定义
// ============================================================

/** 安装日志 */
export interface InstallLog {
  installId: string;
  resourceType: 'skill' | 'tool';
  resourceId: string;
  agentId: AgentId;
  sourceUrl: string;
  scope: ResourceScope;
  status: 'in_progress' | 'completed' | 'failed' | 'rolled_back';
  step: string;
  errorMessage?: string;
  errorDetails?: string;
  durationMs: number;
  createdAt: number;
  updatedAt: number;
}

/** 安装请求 */
export interface InstallSkillRequest {
  url: string;
  scope?: ResourceScope;
  agentId: AgentId;
  options?: InstallOptions;
}

/** 安装选项 */
export interface InstallOptions {
  autoInstallDependencies?: boolean;
  downloadTimeout?: number;
  maxRetries?: number;
  skipValidation?: boolean;
}

/** 安装结果 */
export interface InstallResult {
  success: boolean;
  installId: string;
  skillId?: string;
  error?: InstallError;
}

/** 安装错误 */
export interface InstallError {
  code: InstallErrorCode;
  message: string;
  details?: unknown;
}

/** 安装错误码 */
export enum InstallErrorCode {
  INVALID_URL = 'INVALID_URL',
  URL_NOT_ACCESSIBLE = 'URL_NOT_ACCESSIBLE',
  SSRF_BLOCKED = 'SSRF_BLOCKED',
  DOWNLOAD_FAILED = 'DOWNLOAD_FAILED',
  DOWNLOAD_TIMEOUT = 'DOWNLOAD_TIMEOUT',
  DOWNLOAD_SIZE_EXCEEDED = 'DOWNLOAD_SIZE_EXCEEDED',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  INVALID_PACKAGE_STRUCTURE = 'INVALID_PACKAGE_STRUCTURE',
  SECURITY_CHECK_FAILED = 'SECURITY_CHECK_FAILED',
  PARSE_FAILED = 'PARSE_FAILED',
  INVALID_SCHEMA = 'INVALID_SCHEMA',
  DEPENDENCY_MISSING = 'DEPENDENCY_MISSING',
  CIRCULAR_DEPENDENCY = 'CIRCULAR_DEPENDENCY',
  REGISTRATION_FAILED = 'REGISTRATION_FAILED',
  DUPLICATE_SKILL_ID = 'DUPLICATE_SKILL_ID',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
}

/** 安装进度 */
export interface InstallProgress {
  installId: string;
  status: InstallLog['status'];
  progress: {
    step: string;
    percentage: number;
    message: string;
  };
  result?: {
    skillId: string;
    skillName: string;
    scope: ResourceScope;
  };
  error?: {
    code: string;
    message: string;
  };
  duration: number;
}

/** 安装上下文 */
export interface InstallContext {
  installId: string;
  agentId: AgentId;
  scope: ResourceScope;
  sourceUrl: string;
  options: InstallOptions;
  tempDir: string;
  startTime: number;
  steps: InstallStep[];
}

/** 安装步骤 */
export interface InstallStep {
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startTime?: number;
  endTime?: number;
  error?: Error;
}

/** URL 验证结果 */
export interface UrlValidationResult {
  valid: boolean;
  type?: 'http' | 'https' | 'file' | 'git';
  error?: string;
}

/** 下载选项 */
export interface DownloadOptions {
  timeout?: number;
  maxRetries?: number;
  onProgress?: (progress: DownloadProgress) => void;
}

/** 下载进度 */
export interface DownloadProgress {
  total: number;
  downloaded: number;
  percentage: number;
}

/** 下载结果 */
export interface DownloadResult {
  success: boolean;
  packagePath?: string;
  checksum?: string;
  size?: number;
  error?: Error;
}

/** 验证结果 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  metadata?: PackageMetadata;
}

/** 验证错误 */
export interface ValidationError {
  code: string;
  message: string;
  path?: string;
}

/** 验证警告 */
export interface ValidationWarning {
  code: string;
  message: string;
  path?: string;
}

/** 包元数据 */
export interface PackageMetadata {
  name: string;
  version: string;
  description: string;
  author?: string;
}

/** 依赖解析结果 */
export interface DependencyResolution {
  resolved: Map<ToolId, ToolDefinition>;
  missing: ToolDependency[];
  hasCircular: boolean;
}

/** 自动安装结果 */
export interface AutoInstallResult {
  success: boolean;
  installed: ToolId[];
  failed: Array<{ toolId: ToolId; error: string }>;
}

/** 安装配置 */
export interface InstallConfig {
  tempDir: string;
  maxPackageSize: number;
  downloadTimeout: number;
  maxRetries: number;
  maxConcurrentInstalls: number;
  enableCache: boolean;
  cacheDir: string;
}
