/**
 * 全局工具注册器
 * 负责将四个工具（Read、Write、Edit、Bash）注册到 ToolRegistry
 */

import type { ToolRegistry } from '@/lib/skills/toolRegistry';
import type { CustomToolDefinition, ToolExecutor, ToolResult, ToolExecutionContext } from '@/types';
import { SecurityManager, SandboxController, SecurityConfig, SecurityPolicy } from './security';
import { ReadTool, ReadToolInput, ReadToolOutput } from './ReadTool';
import { WriteTool, WriteToolInput, WriteToolOutput } from './WriteTool';
import { EditTool, EditToolInput, EditToolOutput } from './EditTool';
import { BashTool, BashToolInput, BashToolOutput } from './BashTool';

/**
 * 全局工具配置
 */
export interface GlobalToolsConfig {
  security?: Partial<SecurityConfig>;
  policy?: Partial<SecurityPolicy>;
}

/**
 * 全局工具注册器
 */
export class GlobalToolsRegistry {
  private securityManager: SecurityManager;
  private sandboxController: SandboxController;
  private readTool: ReadTool;
  private writeTool: WriteTool;
  private editTool: EditTool;
  private bashTool: BashTool;
  private registered: boolean = false;

  constructor(config?: GlobalToolsConfig) {
    // 初始化安全管理器
    this.securityManager = new SecurityManager(
      config?.security,
      config?.policy
    );

    // 初始化沙箱控制器
    this.sandboxController = new SandboxController(
      config?.security?.defaultTimeout || 30000
    );

    // 初始化工具实例
    this.readTool = new ReadTool(this.securityManager);
    this.writeTool = new WriteTool(this.securityManager);
    this.editTool = new EditTool(this.securityManager);
    this.bashTool = new BashTool(this.securityManager, this.sandboxController);
  }

  /**
   * 注册所有工具到 ToolRegistry
   */
  async registerAll(toolRegistry: ToolRegistry): Promise<void> {
    if (this.registered) {
      console.warn('Global tools already registered');
      return;
    }

    try {
      // 注册 Read 工具
      await toolRegistry.register(
        this.createToolDefinition(this.readTool, this.createReadExecutor()),
        'global'
      );

      // 注册 Write 工具
      await toolRegistry.register(
        this.createToolDefinition(this.writeTool, this.createWriteExecutor()),
        'global'
      );

      // 注册 Edit 工具
      await toolRegistry.register(
        this.createToolDefinition(this.editTool, this.createEditExecutor()),
        'global'
      );

      // 注册 Bash 工具
      await toolRegistry.register(
        this.createToolDefinition(this.bashTool, this.createBashExecutor()),
        'global'
      );

      this.registered = true;
      console.log('Global tools registered successfully:', {
        read: this.readTool.id,
        write: this.writeTool.id,
        edit: this.editTool.id,
        bash: this.bashTool.id,
      });
    } catch (error) {
      console.error('Failed to register global tools:', error);
      throw error;
    }
  }

  /**
   * 注销所有工具
   */
  async unregisterAll(toolRegistry: ToolRegistry): Promise<void> {
    if (!this.registered) {
      return;
    }

    try {
      await toolRegistry.unregister(this.readTool.id, 'global');
      await toolRegistry.unregister(this.writeTool.id, 'global');
      await toolRegistry.unregister(this.editTool.id, 'global');
      await toolRegistry.unregister(this.bashTool.id, 'global');

      this.registered = false;
      console.log('Global tools unregistered successfully');
    } catch (error) {
      console.error('Failed to unregister global tools:', error);
      throw error;
    }
  }

  /**
   * 创建工具定义
   */
  private createToolDefinition(tool: any, executor: ToolExecutor): CustomToolDefinition {
    return {
      type: 'custom',
      meta: {
        id: tool.id,
        name: tool.name,
        description: tool.description,
        version: tool.version,
        category: 'file-operations',
        tags: ['global', 'file', 'system'],
      },
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
      executor,
    };
  }

  /**
   * 创建 Read 工具执行器
   */
  private createReadExecutor(): ToolExecutor {
    return async (params: Record<string, any>, context?: ToolExecutionContext): Promise<ToolResult> => {
      try {
        const result = await this.readTool.execute(params as ReadToolInput);
        return {
          success: true,
          data: result,
          metadata: {
            toolId: this.readTool.id,
            type: 'custom',
          },
        };
      } catch (error: any) {
        return {
          success: false,
          error: {
            code: error.code || 'EXECUTION_ERROR',
            message: error.message,
            details: error.details,
          },
        };
      }
    };
  }

  /**
   * 创建 Write 工具执行器
   */
  private createWriteExecutor(): ToolExecutor {
    return async (params: Record<string, any>, context?: ToolExecutionContext): Promise<ToolResult> => {
      try {
        const result = await this.writeTool.execute(params as WriteToolInput);
        return {
          success: true,
          data: result,
          metadata: {
            toolId: this.writeTool.id,
            type: 'custom',
          },
        };
      } catch (error: any) {
        return {
          success: false,
          error: {
            code: error.code || 'EXECUTION_ERROR',
            message: error.message,
            details: error.details,
          },
        };
      }
    };
  }

  /**
   * 创建 Edit 工具执行器
   */
  private createEditExecutor(): ToolExecutor {
    return async (params: Record<string, any>, context?: ToolExecutionContext): Promise<ToolResult> => {
      try {
        const result = await this.editTool.execute(params as EditToolInput);
        return {
          success: true,
          data: result,
          metadata: {
            toolId: this.editTool.id,
            type: 'custom',
          },
        };
      } catch (error: any) {
        return {
          success: false,
          error: {
            code: error.code || 'EXECUTION_ERROR',
            message: error.message,
            details: error.details,
          },
        };
      }
    };
  }

  /**
   * 创建 Bash 工具执行器
   */
  private createBashExecutor(): ToolExecutor {
    return async (params: Record<string, any>, context?: ToolExecutionContext): Promise<ToolResult> => {
      try {
        const result = await this.bashTool.execute(params as BashToolInput);
        return {
          success: true,
          data: result,
          metadata: {
            toolId: this.bashTool.id,
            type: 'custom',
          },
        };
      } catch (error: any) {
        return {
          success: false,
          error: {
            code: error.code || 'EXECUTION_ERROR',
            message: error.message,
            details: error.details,
          },
        };
      }
    };
  }

  /**
   * 获取安全管理器
   */
  getSecurityManager(): SecurityManager {
    return this.securityManager;
  }

  /**
   * 获取沙箱控制器
   */
  getSandboxController(): SandboxController {
    return this.sandboxController;
  }

  /**
   * 检查是否已注册
   */
  isRegistered(): boolean {
    return this.registered;
  }
}

/**
 * 创建默认的全局工具注册器
 */
export function createGlobalToolsRegistry(config?: GlobalToolsConfig): GlobalToolsRegistry {
  return new GlobalToolsRegistry(config);
}
