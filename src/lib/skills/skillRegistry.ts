/**
 * Skill 注册表实现
 */

import type {
  AgentId,
  SkillId,
  ResourceScope,
  SkillDefinition,
  LoadedSkill,
  HealthStatus,
  JSONSchema,
} from '@/types';
import type { ISkillRegistry, IToolRegistry } from '@/lib/skills/types';
import { ResourceManager } from './resourcePool';
import { DependencyResolver } from './dependencyResolver';
import { SkillRepo } from '@/lib/db/skillRepo';
import { ExecutionLogRepo } from '@/lib/db/executionLogRepo';

/**
 * Skill 注册表
 * 管理 Skill 的注册、查找、加载和执行
 */
export class SkillRegistry implements ISkillRegistry {
  private resourceManager: ResourceManager<any>;
  private dependencyResolver: DependencyResolver;
  private loadedSkills: Map<SkillId, LoadedSkill> = new Map();
  private executionLogRepo: ExecutionLogRepo;

  constructor(
    private skillRepo: SkillRepo,
    private toolRegistry: IToolRegistry,
    executionLogRepo: ExecutionLogRepo
  ) {
    this.executionLogRepo = executionLogRepo;

    // 初始化资源管理器
    this.resourceManager = new ResourceManager(
      skillRepo,
      skillRepo,
      { maxCacheSize: 100 }
    );

    // 初始化依赖解析器
    this.dependencyResolver = new DependencyResolver(toolRegistry);
  }

  /**
   * 注册 Skill
   */
  async register(
    definition: SkillDefinition,
    scope: ResourceScope,
    agentId?: AgentId,
    skillPath?: string
  ): Promise<void> {
    // 验证定义
    this.validateDefinition(definition);

    // 解析和验证依赖
    const graph = await this.dependencyResolver.resolve(definition);
    const validation = await this.dependencyResolver.validate(graph);

    if (!validation.valid) {
      throw new Error(
        `Dependency validation failed: ${validation.errors.join(', ')}`
      );
    }

    // 转换为数据库记录
    const record = this.definitionToRecord(definition, scope, agentId, skillPath);

    // 注册到资源池
    if (scope === 'global') {
      await this.resourceManager.registerGlobal(record);
    } else {
      if (!agentId) {
        throw new Error('agentId is required for private scope');
      }
      await this.resourceManager.registerPrivate(agentId, record);
    }
  }

  /**
   * 注销 Skill
   */
  async unregister(
    skillId: SkillId,
    scope: ResourceScope,
    agentId?: AgentId
  ): Promise<void> {
    await this.resourceManager.unregister(skillId, scope, agentId);
    this.loadedSkills.delete(skillId);
  }

  /**
   * 查找 Skill
   */
  async find(
    agentId: AgentId,
    skillId: SkillId
  ): Promise<SkillDefinition | undefined> {
    const record = await this.resourceManager.find(agentId, skillId);
    if (!record) {
      return undefined;
    }

    return this.recordToDefinition(record);
  }

  /**
   * 列出可访问的 Skills
   */
  async listAccessible(agentId: AgentId): Promise<SkillDefinition[]> {
    const records = await this.resourceManager.listAccessible(agentId);
    return records.map(record => this.recordToDefinition(record));
  }

  /**
   * 加载 Skill
   */
  async load(skillId: SkillId): Promise<LoadedSkill> {
    // 检查是否已加载
    const cached = this.loadedSkills.get(skillId);
    if (cached && cached.status === 'initialized') {
      return cached;
    }

    // 查找 Skill 定义
    const record = this.skillRepo.findById(skillId);
    if (!record) {
      throw new Error(`Skill ${skillId} not found`);
    }

    const definition = this.recordToDefinition(record);

    // 解析依赖
    const graph = await this.dependencyResolver.resolve(definition);

    // 加载依赖的 Tools
    const tools = new Map<string, any>();
    for (const [toolId, node] of graph.nodes) {
      if (node.type === 'tool') {
        // 这里需要获取 Tool 实例
        // 暂时使用占位符
        tools.set(toolId, {
          id: toolId,
          execute: async (params: any) => {
            return await this.toolRegistry.execute(toolId, params);
          },
        });
      }
    }

    // 创建已加载的 Skill
    const loadedSkill: LoadedSkill = {
      definition,
      tools,
      status: 'initialized',
      loadedAt: Date.now(),
    };

    // 缓存
    this.loadedSkills.set(skillId, loadedSkill);

    // 记录日志
    this.logExecution({
      skillId,
      agentId: record.ownerId || 'system',
      action: 'load',
      success: true,
      duration: 0,
    });

    return loadedSkill;
  }

  /**
   * 卸载 Skill
   */
  async unload(skillId: SkillId): Promise<void> {
    const loadedSkill = this.loadedSkills.get(skillId);
    if (!loadedSkill) {
      return;
    }

    // 清理资源
    loadedSkill.tools.clear();
    this.loadedSkills.delete(skillId);

    // 记录日志
    this.logExecution({
      skillId,
      agentId: 'system',
      action: 'unload',
      success: true,
      duration: 0,
    });
  }

  /**
   * 健康检查
   */
  async healthCheck(skillId: SkillId): Promise<HealthStatus> {
    const record = this.skillRepo.findById(skillId);
    if (!record) {
      return {
        healthy: false,
        status: 'error',
        message: 'Skill not found',
        lastCheck: Date.now(),
      };
    }

    // 检查依赖的健康状态
    const definition = this.recordToDefinition(record);
    const graph = await this.dependencyResolver.resolve(definition);
    const validation = await this.dependencyResolver.validate(graph);

    const healthy = record.status === 'active' && validation.valid;
    return {
      healthy,
      status: healthy ? 'ok' : 'error',
      message: healthy
        ? 'Skill is healthy'
        : `Skill has issues: ${validation.errors.join(', ')}`,
      details: {
        dependencies: validation,
      },
      lastCheck: Date.now(),
    };
  }

  /**
   * 验证 Skill 定义
   */
  private validateDefinition(definition: SkillDefinition): void {
    if (!definition.meta.id) {
      throw new Error('Skill ID is required');
    }
    if (!definition.meta.name) {
      throw new Error('Skill name is required');
    }
    if (!definition.inputSchema || !definition.outputSchema) {
      throw new Error('Input and output schemas are required');
    }
    if (!definition.executor) {
      throw new Error('Executor function is required');
    }
  }

  /**
   * 转换定义为数据库记录
   */
  private definitionToRecord(
    definition: SkillDefinition,
    scope: ResourceScope,
    agentId?: AgentId,
    skillPath?: string
  ): any {
    return {
      id: definition.meta.id,
      name: definition.meta.name,
      description: definition.meta.description,
      version: definition.meta.version,
      author: definition.meta.author || null,
      tags: definition.meta.tags ? JSON.stringify(definition.meta.tags) : null,
      category: definition.meta.category || null,
      inputSchema: JSON.stringify(definition.inputSchema),
      outputSchema: JSON.stringify(definition.outputSchema),
      dependencies: JSON.stringify(definition.dependencies),
      scope,
      ownerId: agentId || null,
      config: definition.config ? JSON.stringify(definition.config) : null,
      executorType: 'function',
      executorData: definition.executor.toString(),
      path: skillPath || null,
      status: 'active',
      healthStatus: JSON.stringify({ healthy: true, status: 'ok', lastCheck: Date.now() }),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  /**
   * 转换数据库记录为定义
   */
  private recordToDefinition(record: any): SkillDefinition {
    return {
      meta: {
        id: record.id,
        name: record.name,
        description: record.description,
        version: record.version,
        author: record.author || undefined,
        tags: record.tags ? JSON.parse(record.tags) : undefined,
        category: record.category || undefined,
      },
      inputSchema: JSON.parse(record.inputSchema),
      outputSchema: JSON.parse(record.outputSchema),
      dependencies: JSON.parse(record.dependencies),
      executor: record.executorData ? eval(record.executorData) : undefined,
      config: record.config ? JSON.parse(record.config) : undefined,
    };
  }

  /**
   * 记录执行日志
   */
  private logExecution(log: {
    skillId: SkillId;
    agentId: AgentId;
    action: string;
    input?: any;
    output?: any;
    success: boolean;
    error?: string;
    duration: number;
  }): void {
    try {
      this.executionLogRepo.insert({
        id: `${log.skillId}-${Date.now()}`,
        resourceType: 'skill',
        resourceId: log.skillId,
        agentId: log.agentId,
        action: log.action as any,
        input: log.input ? JSON.stringify(log.input) : undefined,
        output: log.output ? JSON.stringify(log.output) : undefined,
        success: log.success,
        error: log.error,
        duration: log.duration,
        timestamp: Date.now(),
      });
    } catch (err) {
      console.error('Failed to log execution:', err);
    }
  }
}
