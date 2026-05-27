/**
 * Tool 注册表实现
 */

import type {
  AgentId,
  ToolId,
  ResourceScope,
  ToolDefinition,
  ToolResult,
  ToolExecutionContext,
  HealthStatus,
  JSONSchema,
} from '@/types';
import type { IToolRegistry } from '@/lib/skills/types';
import { ResourceManager } from './resourcePool';
import { ToolRepo } from '@/lib/db/toolRepo';
import { ExecutionLogRepo } from '@/lib/db/executionLogRepo';

/**
 * Tool 注册表
 * 管理 Tool 的注册、查找和执行
 */
export class ToolRegistry implements IToolRegistry {
  private resourceManager: ResourceManager<any>;
  private executionLogRepo: ExecutionLogRepo;
  private toolInstances: Map<ToolId, any> = new Map();

  constructor(
    private toolRepo: ToolRepo,
    executionLogRepo: ExecutionLogRepo
  ) {
    this.executionLogRepo = executionLogRepo;

    // 初始化资源管理器
    this.resourceManager = new ResourceManager(
      toolRepo,
      toolRepo,
      { maxCacheSize: 100 }
    );
  }

  /**
   * 注册 Tool
   */
  async register(
    definition: ToolDefinition,
    scope: ResourceScope,
    agentId?: AgentId
  ): Promise<void> {
    // 验证定义
    this.validateDefinition(definition);

    // 转换为数据库记录
    const record = this.definitionToRecord(definition, scope, agentId);

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
   * 注销 Tool
   */
  async unregister(
    toolId: ToolId,
    scope: ResourceScope,
    agentId?: AgentId
  ): Promise<void> {
    await this.resourceManager.unregister(toolId, scope, agentId);
    this.toolInstances.delete(toolId);
  }

  /**
   * 查找 Tool
   */
  async find(
    agentId: AgentId,
    toolId: ToolId
  ): Promise<ToolDefinition | undefined> {
    const record = await this.resourceManager.find(agentId, toolId);
    if (!record) {
      return undefined;
    }

    return this.recordToDefinition(record);
  }

  /**
   * 列出可访问的 Tools
   */
  async listAccessible(agentId: AgentId): Promise<ToolDefinition[]> {
    const records = await this.resourceManager.listAccessible(agentId);
    return records.map(record => this.recordToDefinition(record));
  }

  /**
   * 执行 Tool
   */
  async execute(
    toolId: ToolId,
    params: Record<string, any>,
    context?: ToolExecutionContext
  ): Promise<ToolResult> {
    const startTime = Date.now();
    let success = false;
    let result: ToolResult;
    let error: string | undefined;

    try {
      // 查找 Tool 定义
      const agentId = context?.agentId || '*';
      const definition = await this.find(agentId, toolId);

      if (!definition) {
        throw new Error(`Tool ${toolId} not found`);
      }

      // 验证参数
      this.validateParams(definition.inputSchema, params);

      // 执行
      if (definition.type === 'mcp') {
        result = await this.executeMCPTool(definition, params, context);
      } else {
        result = await this.executeCustomTool(definition, params, context);
      }

      // 验证结果
      this.validateResult(definition.outputSchema, result.data);

      success = true;
      return result;
    } catch (err: any) {
      error = err.message;
      return {
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: err.message,
          details: err.stack,
        },
      };
    } finally {
      // 记录执行日志
      const duration = Date.now() - startTime;
      this.logExecution({
        toolId,
        agentId: context?.agentId || 'unknown',
        action: 'execute',
        input: params,
        output: result?.data,
        success,
        error,
        duration,
      });
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(toolId: ToolId): Promise<HealthStatus> {
    const record = this.toolRepo.findById(toolId);
    if (!record) {
      return {
        healthy: false,
        status: 'error',
        message: 'Tool not found',
        lastCheck: Date.now(),
      };
    }

    // 简单的健康检查（实际应该根据 Tool 类型进行具体检查）
    const healthy = record.status === 'active';
    return {
      healthy,
      status: healthy ? 'ok' : 'error',
      message: healthy ? 'Tool is active' : 'Tool is inactive',
      lastCheck: Date.now(),
    };
  }

  /**
   * 验证 Tool 定义
   */
  private validateDefinition(definition: ToolDefinition): void {
    if (!definition.meta.id) {
      throw new Error('Tool ID is required');
    }
    if (!definition.meta.name) {
      throw new Error('Tool name is required');
    }
    if (!definition.inputSchema || !definition.outputSchema) {
      throw new Error('Input and output schemas are required');
    }
  }

  /**
   * 验证参数
   */
  private validateParams(schema: JSONSchema, params: Record<string, any>): void {
    // 简单验证（实际应该使用 JSON Schema 验证库）
    if (schema.required) {
      for (const field of schema.required) {
        if (params[field] === undefined) {
          throw new Error(`Missing required field: ${field}`);
        }
      }
    }
  }

  /**
   * 验证结果
   */
  private validateResult(schema: JSONSchema, result: any): void {
    // 简单验证
    // 实际应该使用 JSON Schema 验证库
  }

  /**
   * 执行 MCP Tool
   */
  private async executeMCPTool(
    definition: any,
    params: Record<string, any>,
    context?: ToolExecutionContext
  ): Promise<ToolResult> {
    // 这里需要调用 MCP 适配器
    // 暂时返回模拟结果
    return {
      success: true,
      data: { message: 'MCP Tool execution not implemented yet' },
      metadata: {
        toolId: definition.meta.id,
        type: 'mcp',
      },
    };
  }

  /**
   * 执行 Custom Tool
   */
  private async executeCustomTool(
    definition: any,
    params: Record<string, any>,
    context?: ToolExecutionContext
  ): Promise<ToolResult> {
    // 调用自定义执行函数
    if (definition.executor) {
      return await definition.executor(params, context);
    }

    throw new Error('Custom Tool executor not found');
  }

  /**
   * 转换定义为数据库记录
   */
  private definitionToRecord(
    definition: ToolDefinition,
    scope: ResourceScope,
    agentId?: AgentId
  ): any {
    const base = {
      id: definition.meta.id,
      name: definition.meta.name,
      description: definition.meta.description,
      version: definition.meta.version,
      category: definition.meta.category,
      tags: definition.meta.tags ? JSON.stringify(definition.meta.tags) : null,
      type: definition.type,
      inputSchema: JSON.stringify(definition.inputSchema),
      outputSchema: JSON.stringify(definition.outputSchema),
      scope,
      ownerId: agentId || null,
      config: definition.config ? JSON.stringify(definition.config) : null,
      status: 'active',
      healthStatus: JSON.stringify({ healthy: true, status: 'ok', lastCheck: Date.now() }),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    if (definition.type === 'mcp') {
      return {
        ...base,
        endpoint: definition.endpoint,
        toolName: definition.toolName,
        authType: definition.authType || null,
        authConfig: definition.authConfig ? JSON.stringify(definition.authConfig) : null,
        timeout: definition.timeout || null,
        executorData: null,
      };
    } else {
      return {
        ...base,
        endpoint: null,
        toolName: null,
        authType: null,
        authConfig: null,
        timeout: null,
        executorData: definition.executor ? definition.executor.toString() : null,
      };
    }
  }

  /**
   * 转换数据库记录为定义
   */
  private recordToDefinition(record: any): ToolDefinition {
    const base = {
      meta: {
        id: record.id,
        name: record.name,
        description: record.description,
        version: record.version,
        category: record.category,
        tags: record.tags ? JSON.parse(record.tags) : undefined,
      },
      inputSchema: JSON.parse(record.inputSchema),
      outputSchema: JSON.parse(record.outputSchema),
      config: record.config ? JSON.parse(record.config) : undefined,
    };

    if (record.type === 'mcp') {
      return {
        ...base,
        type: 'mcp',
        endpoint: record.endpoint,
        toolName: record.toolName,
        authType: record.authType || undefined,
        authConfig: record.authConfig ? JSON.parse(record.authConfig) : undefined,
        timeout: record.timeout || undefined,
      };
    } else {
      return {
        ...base,
        type: 'custom',
        executor: record.executorData ? eval(record.executorData) : undefined,
      };
    }
  }

  /**
   * 记录执行日志
   */
  private logExecution(log: {
    toolId: ToolId;
    agentId: AgentId;
    action: string;
    input: any;
    output: any;
    success: boolean;
    error?: string;
    duration: number;
  }): void {
    try {
      this.executionLogRepo.insert({
        id: `${log.toolId}-${Date.now()}`,
        resourceType: 'tool',
        resourceId: log.toolId,
        agentId: log.agentId,
        action: log.action as any,
        input: JSON.stringify(log.input),
        output: JSON.stringify(log.output),
        success: log.success,
        error: log.error,
        duration: log.duration,
        timestamp: Date.now(),
      });
    } catch (err) {
      // 日志记录失败不影响主流程
      console.error('Failed to log execution:', err);
    }
  }
}
