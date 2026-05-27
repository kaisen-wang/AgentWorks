/**
 * 执行引擎实现
 */

import type {
  AgentId,
  SkillId,
  ToolId,
  SkillResult,
  ToolResult,
  ToolExecutionContext,
  JSONSchema,
} from '@/types';
import type {
  ISkillExecutor,
  IToolExecutor,
  ISkillRegistry,
  IToolRegistry,
} from '@/lib/skills/types';

/**
 * Skill 执行器
 */
export class SkillExecutor implements ISkillExecutor {
  constructor(
    private skillRegistry: ISkillRegistry,
    private toolExecutor: IToolExecutor
  ) {}

  /**
   * 执行 Skill
   */
  async execute(
    agentId: AgentId,
    skillId: SkillId,
    params: Record<string, any>
  ): Promise<SkillResult> {
    const startTime = Date.now();

    try {
      // 加载 Skill
      const loadedSkill = await this.skillRegistry.load(skillId);

      // 验证参数
      const paramValidation = this.validateParams(
        loadedSkill.definition.inputSchema,
        params
      );
      if (!paramValidation.valid) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'Parameter validation failed',
            details: paramValidation.errors,
          },
        };
      }

      // 构建执行上下文
      const context = {
        agentId,
        agentConfig: {} as any, // 需要从 Agent 管理器获取
        tools: loadedSkill.tools,
        logger: this.createLogger(skillId, agentId),
        memory: this.createMemoryStore(agentId),
      };

      // 执行
      const result = await loadedSkill.definition.executor(context, params);

      // 验证结果
      const resultValidation = this.validateResult(
        loadedSkill.definition.outputSchema,
        result.data
      );
      if (!resultValidation.valid) {
        return {
          success: false,
          error: {
            code: 'INVALID_RESULT',
            message: 'Result validation failed',
            details: resultValidation.errors,
          },
        };
      }

      return result;
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: error.message,
          details: error.stack,
        },
      };
    }
  }

  /**
   * 验证参数
   */
  private validateParams(
    schema: JSONSchema,
    params: Record<string, any>
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 简单验证（实际应该使用 JSON Schema 验证库）
    if (schema.required) {
      for (const field of schema.required) {
        if (params[field] === undefined) {
          errors.push(`Missing required field: ${field}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 验证结果
   */
  private validateResult(
    schema: JSONSchema,
    result: any
  ): { valid: boolean; errors: string[] } {
    // 简单验证
    return {
      valid: true,
      errors: [],
    };
  }

  /**
   * 创建 Logger
   */
  private createLogger(skillId: SkillId, agentId: AgentId) {
    return {
      debug: (message: string, ...args: any[]) => {
        console.debug(`[Skill:${skillId}][Agent:${agentId}]`, message, ...args);
      },
      info: (message: string, ...args: any[]) => {
        console.info(`[Skill:${skillId}][Agent:${agentId}]`, message, ...args);
      },
      warn: (message: string, ...args: any[]) => {
        console.warn(`[Skill:${skillId}][Agent:${agentId}]`, message, ...args);
      },
      error: (message: string, ...args: any[]) => {
        console.error(`[Skill:${skillId}][Agent:${agentId}]`, message, ...args);
      },
    };
  }

  /**
   * 创建 Memory Store
   */
  private createMemoryStore(agentId: AgentId) {
    const store = new Map<string, any>();

    return {
      get: async (key: string) => {
        return store.get(`${agentId}:${key}`);
      },
      set: async (key: string, value: any, ttl?: number) => {
        store.set(`${agentId}:${key}`, value);
      },
      delete: async (key: string) => {
        store.delete(`${agentId}:${key}`);
      },
      clear: async () => {
        store.clear();
      },
    };
  }
}

/**
 * Tool 执行器
 */
export class ToolExecutor implements IToolExecutor {
  constructor(private toolRegistry: IToolRegistry) {}

  /**
   * 执行 Tool
   */
  async execute(
    toolId: ToolId,
    params: Record<string, any>,
    context?: ToolExecutionContext
  ): Promise<ToolResult> {
    return await this.toolRegistry.execute(toolId, params, context);
  }

  /**
   * 批量执行 Tools
   */
  async executeBatch(
    tasks: Array<{ toolId: ToolId; params: Record<string, any> }>,
    context?: ToolExecutionContext
  ): Promise<ToolResult[]> {
    // 并发执行（可以添加并发控制）
    const promises = tasks.map(task =>
      this.execute(task.toolId, task.params, context)
    );

    return await Promise.all(promises);
  }
}

/**
 * 执行调度器
 * 管理并发和任务队列
 */
export class ExecutionScheduler {
  private queue: Array<{
    id: string;
    type: 'skill' | 'tool';
    resourceId: string;
    params: Record<string, any>;
    context?: any;
    priority: number;
    resolve: (result: any) => void;
    reject: (error: any) => void;
  }> = [];

  private running: Map<string, Promise<any>> = new Map();
  private maxConcurrency: number;
  private agentConcurrency: Map<AgentId, number> = new Map();
  private maxAgentConcurrency: number;

  constructor(
    private skillExecutor: ISkillExecutor,
    private toolExecutor: IToolExecutor,
    options?: {
      maxConcurrency?: number;
      maxAgentConcurrency?: number;
    }
  ) {
    this.maxConcurrency = options?.maxConcurrency || 10;
    this.maxAgentConcurrency = options?.maxAgentConcurrency || 3;
  }

  /**
   * 提交执行任务
   */
  async submit(
    type: 'skill' | 'tool',
    resourceId: string,
    params: Record<string, any>,
    context?: any,
    priority: number = 0
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        id: `${type}-${resourceId}-${Date.now()}`,
        type,
        resourceId,
        params,
        context,
        priority,
        resolve,
        reject,
      });

      // 按优先级排序
      this.queue.sort((a, b) => b.priority - a.priority);

      // 尝试执行
      this.processQueue();
    });
  }

  /**
   * 取消执行
   */
  cancel(taskId: string): boolean {
    const index = this.queue.findIndex(task => task.id === taskId);
    if (index >= 0) {
      this.queue.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * 获取执行状态
   */
  getStatus(taskId: string): 'pending' | 'running' | 'completed' | 'not_found' {
    if (this.running.has(taskId)) {
      return 'running';
    }

    const inQueue = this.queue.find(task => task.id === taskId);
    if (inQueue) {
      return 'pending';
    }

    return 'not_found';
  }

  /**
   * 处理队列
   */
  private processQueue(): void {
    while (
      this.queue.length > 0 &&
      this.running.size < this.maxConcurrency
    ) {
      const task = this.queue.shift();
      if (!task) break;

      // 检查 Agent 并发限制
      const agentId = task.context?.agentId;
      if (agentId) {
        const agentRunning = this.agentConcurrency.get(agentId) || 0;
        if (agentRunning >= this.maxAgentConcurrency) {
          // 放回队列
          this.queue.unshift(task);
          break;
        }

        this.agentConcurrency.set(agentId, agentRunning + 1);
      }

      // 执行任务
      const promise = this.executeTask(task);
      this.running.set(task.id, promise);

      promise
        .then(result => {
          task.resolve(result);
        })
        .catch(error => {
          task.reject(error);
        })
        .finally(() => {
          this.running.delete(task.id);

          // 更新 Agent 并发计数
          if (agentId) {
            const agentRunning = this.agentConcurrency.get(agentId) || 0;
            this.agentConcurrency.set(agentId, Math.max(0, agentRunning - 1));
          }

          // 继续处理队列
          this.processQueue();
        });
    }
  }

  /**
   * 执行任务
   */
  private async executeTask(task: any): Promise<any> {
    if (task.type === 'skill') {
      return await this.skillExecutor.execute(
        task.context.agentId,
        task.resourceId,
        task.params
      );
    } else {
      return await this.toolExecutor.execute(
        task.resourceId,
        task.params,
        task.context
      );
    }
  }
}
