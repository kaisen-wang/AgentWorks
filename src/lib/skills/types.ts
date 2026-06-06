// ============================================================
// Skills 核心接口定义
// ============================================================

import type {
  AgentId,
  SkillId,
  ToolId,
  ResourceScope,
  SkillDefinition,
  ToolDefinition,
  LoadedSkill,
  SkillResult,
  ToolResult,
  HealthStatus,
  DependencyGraph,
  DependencyValidationResult,
  CycleDetectionResult,
  ToolExecutionContext,
  JSONSchema,
} from '@/types';

// --- 注册表接口 ---

/** Skill 注册表接口 */
export interface ISkillRegistry {
  /**
   * 注册 Skill
   * @param definition Skill 定义
   * @param scope 资源范围（global 或 private）
   * @param agentId 私有范围时必须提供 Agent ID
   * @param skillPath skill 目录的持久化路径
   */
  register(definition: SkillDefinition, scope: ResourceScope, agentId?: AgentId, skillPath?: string): Promise<void>;

  /**
   * 注销 Skill
   * @param skillId Skill ID
   * @param scope 资源范围
   * @param agentId 私有范围时必须提供 Agent ID
   */
  unregister(skillId: SkillId, scope: ResourceScope, agentId?: AgentId): Promise<void>;

  /**
   * 查找 Skill（自动路由私有/全局）
   * @param agentId Agent ID
   * @param skillId Skill ID
   * @returns Skill 定义或 undefined
   */
  find(agentId: AgentId, skillId: SkillId): Promise<SkillDefinition | undefined>;

  /**
   * 列出 Agent 可访问的所有 Skills
   * @param agentId Agent ID
   * @returns Skill 定义列表
   */
  listAccessible(agentId: AgentId): Promise<SkillDefinition[]>;

  /**
   * 加载 Skill（解析依赖并注入 Tools）
   * @param skillId Skill ID
   * @returns 已加载的 Skill
   */
  load(skillId: SkillId): Promise<LoadedSkill>;

  /**
   * 卸载 Skill（清理资源）
   * @param skillId Skill ID
   */
  unload(skillId: SkillId): Promise<void>;

  /**
   * 健康检查
   * @param skillId Skill ID
   * @returns 健康状态
   */
  healthCheck(skillId: SkillId): Promise<HealthStatus>;
}

/** Tool 注册表接口 */
export interface IToolRegistry {
  /**
   * 注册 Tool
   * @param definition Tool 定义
   * @param scope 资源范围
   * @param agentId 私有范围时必须提供 Agent ID
   */
  register(definition: ToolDefinition, scope: ResourceScope, agentId?: AgentId): Promise<void>;

  /**
   * 注销 Tool
   * @param toolId Tool ID
   * @param scope 资源范围
   * @param agentId 私有范围时必须提供 Agent ID
   */
  unregister(toolId: ToolId, scope: ResourceScope, agentId?: AgentId): Promise<void>;

  /**
   * 查找 Tool（自动路由私有/全局）
   * @param agentId Agent ID
   * @param toolId Tool ID
   * @returns Tool 定义或 undefined
   */
  find(agentId: AgentId, toolId: ToolId): Promise<ToolDefinition | undefined>;

  /**
   * 列出 Agent 可访问的所有 Tools
   * @param agentId Agent ID
   * @returns Tool 定义列表
   */
  listAccessible(agentId: AgentId): Promise<ToolDefinition[]>;

  /**
   * 执行 Tool
   * @param toolId Tool ID
   * @param params 执行参数
   * @param context 执行上下文
   * @returns 执行结果
   */
  execute(toolId: ToolId, params: Record<string, any>, context?: ToolExecutionContext): Promise<ToolResult>;

  /**
   * 健康检查
   * @param toolId Tool ID
   * @returns 健康状态
   */
  healthCheck(toolId: ToolId): Promise<HealthStatus>;
}

// --- 资源池接口 ---

/** 资源池接口 */
export interface IResourcePool<T extends { id: string }> {
  /**
   * 注册资源
   * @param resource 资源对象
   */
  register(resource: T): Promise<void>;

  /**
   * 注销资源
   * @param id 资源 ID
   */
  unregister(id: string): Promise<void>;

  /**
   * 查找资源
   * @param id 资源 ID
   * @returns 资源对象或 undefined
   */
  find(id: string): Promise<T | undefined>;

  /**
   * 列出所有资源
   * @returns 资源列表
   */
  list(): Promise<T[]>;

  /**
   * 检查资源是否存在
   * @param id 资源 ID
   * @returns 是否存在
   */
  exists(id: string): Promise<boolean>;
}

/** 全局资源池接口 */
export interface IGlobalPool<T extends { id: string }> extends IResourcePool<T> {
  /**
   * 克隆资源到私有池
   * @param agentId Agent ID
   * @param resourceId 资源 ID
   * @returns 克隆的资源
   */
  cloneToPrivate(agentId: AgentId, resourceId: string): Promise<T>;
}

/** 私有资源池接口 */
export interface IPrivatePool<T extends { id: string }> extends IResourcePool<T> {
  /**
   * 列出所有者的所有资源
   * @param agentId Agent ID
   * @returns 资源列表
   */
  listByOwner(agentId: AgentId): Promise<T[]>;

  /**
   * 提升资源到全局池
   * @param resourceId 资源 ID
   * @returns 提升的资源
   */
  promoteToGlobal(resourceId: string): Promise<T>;
}

/** 资源管理器接口 */
export interface IResourceManager<T extends { id: string }> {
  /**
   * 注册全局资源
   * @param resource 资源对象
   */
  registerGlobal(resource: T): Promise<void>;

  /**
   * 注册私有资源
   * @param agentId Agent ID
   * @param resource 资源对象
   */
  registerPrivate(agentId: AgentId, resource: T): Promise<void>;

  /**
   * 查找资源（私有优先）
   * @param agentId Agent ID
   * @param resourceId 资源 ID
   * @returns 资源对象或 undefined
   */
  find(agentId: AgentId, resourceId: string): Promise<T | undefined>;

  /**
   * 列出可访问的所有资源
   * @param agentId Agent ID
   * @returns 资源列表
   */
  listAccessible(agentId: AgentId): Promise<T[]>;
}

// --- 依赖解析器接口 ---

/** 依赖解析器接口 */
export interface IDependencyResolver {
  /**
   * 解析 Skill 的依赖关系
   * @param skill Skill 定义
   * @returns 依赖图
   */
  resolve(skill: SkillDefinition): Promise<DependencyGraph>;

  /**
   * 验证依赖可用性
   * @param graph 依赖图
   * @returns 验证结果
   */
  validate(graph: DependencyGraph): Promise<DependencyValidationResult>;

  /**
   * 检测循环依赖
   * @param graph 依赖图
   * @returns 检测结果
   */
  detectCycle(graph: DependencyGraph): CycleDetectionResult;

  /**
   * 拓扑排序
   * @param graph 依赖图
   * @returns 排序后的节点 ID 列表
   */
  topologicalSort(graph: DependencyGraph): string[];
}

// --- 执行器接口 ---

/** Skill 执行器接口 */
export interface ISkillExecutor {
  /**
   * 执行 Skill
   * @param agentId Agent ID
   * @param skillId Skill ID
   * @param params 执行参数
   * @returns 执行结果
   */
  execute(agentId: AgentId, skillId: SkillId, params: Record<string, any>): Promise<SkillResult>;
}

/** Tool 执行器接口 */
export interface IToolExecutor {
  /**
   * 执行 Tool
   * @param toolId Tool ID
   * @param params 执行参数
   * @param context 执行上下文
   * @returns 执行结果
   */
  execute(toolId: ToolId, params: Record<string, any>, context?: ToolExecutionContext): Promise<ToolResult>;

  /**
   * 批量执行 Tools
   * @param tasks 任务列表
   * @param context 执行上下文
   * @returns 执行结果列表
   */
  executeBatch(
    tasks: Array<{ toolId: ToolId; params: Record<string, any> }>,
    context?: ToolExecutionContext
  ): Promise<ToolResult[]>;
}

// --- 数据访问层接口 ---

/** 通用数据访问接口 */
export interface IRepo<T> {
  insert(entity: T): void;
  update(entity: T): void;
  delete(id: string): void;
  findById(id: string): T | undefined;
  findAll(): T[];
}

/** Skill 数据访问接口 */
export interface ISkillRepo extends IRepo<SkillRecord> {
  findByScope(scope: ResourceScope): SkillRecord[];
  findByOwner(ownerId: AgentId): SkillRecord[];
}

/** Tool 数据访问接口 */
export interface IToolRepo extends IRepo<ToolRecord> {
  findByScope(scope: ResourceScope): ToolRecord[];
  findByOwner(ownerId: AgentId): ToolRecord[];
}

// --- 数据库记录类型 ---

/** Skill 数据库记录 */
export interface SkillRecord {
  id: SkillId;
  name: string;
  description: string;
  version: string;
  author?: string;
  tags?: string;
  category?: string;
  inputSchema: string;           // JSON 字符串
  outputSchema: string;          // JSON 字符串
  dependencies: string;          // JSON 字符串
  scope: ResourceScope;
  ownerId?: AgentId;
  config?: string;               // JSON 字符串
  executorType: 'function' | 'file';
  executorData?: string;         // 函数代码或文件路径
  path?: string;                 // skill 目录路径，如 data/skills/my-skill
  status: 'active' | 'inactive' | 'error';
  healthStatus: string;          // JSON 字符串
  createdAt: number;
  updatedAt: number;
}

/** Tool 数据库记录 */
export interface ToolRecord {
  id: ToolId;
  name: string;
  description: string;
  version: string;
  category?: string;
  tags?: string;
  type: 'mcp' | 'custom';
  inputSchema: string;           // JSON 字符串
  outputSchema: string;          // JSON 字符串
  scope: ResourceScope;
  ownerId?: AgentId;
  config?: string;               // JSON 字符串
  endpoint?: string;             // MCP 端点
  toolName?: string;             // MCP 工具名称
  authType?: string;
  authConfig?: string;           // JSON 字符串
  timeout?: number;
  executorData?: string;         // Custom Tool 执行代码
  status: 'active' | 'inactive' | 'error';
  healthStatus: string;          // JSON 字符串
  createdAt: number;
  updatedAt: number;
}

/** Agent-Skill 绑定记录 */
export interface AgentSkillBindingRecord {
  id: string;
  agentId: AgentId;
  skillId: SkillId;
  autoDiscover: boolean;
  createdAt: number;
}

/** Agent-Tool 绑定记录 */
export interface AgentToolBindingRecord {
  id: string;
  agentId: AgentId;
  toolId: ToolId;
  autoDiscover: boolean;
  createdAt: number;
}

/** 执行日志记录 */
export interface ExecutionLogRecord {
  id: string;
  resourceType: 'skill' | 'tool';
  resourceId: string;
  agentId: AgentId;
  action: 'execute' | 'health_check' | 'load' | 'unload';
  input?: string;                // JSON 字符串
  output?: string;               // JSON 字符串
  success: boolean;
  error?: string;
  duration: number;
  timestamp: number;
}
