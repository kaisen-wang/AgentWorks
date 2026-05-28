/**
 * Bash 工具
 * 用于执行系统命令，支持超时控制、工作目录和环境变量设置
 */

import { SecurityManager, SandboxController, ToolError, ToolErrorCode, CommandResult } from './security';

/**
 * Bash 工具输入参数
 */
export interface BashToolInput {
  /** 要执行的命令 */
  command: string;
  /** 超时时间（毫秒，默认 30000） */
  timeout?: number;
  /** 工作目录 */
  cwd?: string;
  /** 环境变量 */
  env?: Record<string, string>;
}

/**
 * Bash 工具输出
 */
export interface BashToolOutput {
  /** 标准输出 */
  stdout: string;
  /** 标准错误 */
  stderr: string;
  /** 退出码 */
  exitCode: number | null;
  /** 执行时长（毫秒） */
  duration: number;
  /** 是否超时 */
  timedOut: boolean;
}

/**
 * Bash 工具类
 */
export class BashTool {
  readonly id = 'bash';
  readonly name = 'Bash';
  readonly description = '执行系统命令，支持超时控制、工作目录和环境变量设置';
  readonly version = '1.0.0';

  private securityManager: SecurityManager;
  private sandboxController: SandboxController;

  constructor(securityManager: SecurityManager, sandboxController: SandboxController) {
    this.securityManager = securityManager;
    this.sandboxController = sandboxController;
  }

  /**
   * JSON Schema 输入定义
   */
  readonly inputSchema = {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: '要执行的命令',
      },
      timeout: {
        type: 'number',
        description: '超时时间（毫秒）',
        default: 30000,
        minimum: 1000,
        maximum: 600000,
      },
      cwd: {
        type: 'string',
        description: '工作目录',
      },
      env: {
        type: 'object',
        description: '环境变量',
        additionalProperties: {
          type: 'string',
        },
      },
    },
    required: ['command'],
  };

  /**
   * JSON Schema 输出定义
   */
  readonly outputSchema = {
    type: 'object',
    properties: {
      stdout: {
        type: 'string',
        description: '标准输出',
      },
      stderr: {
        type: 'string',
        description: '标准错误',
      },
      exitCode: {
        type: 'number',
        description: '退出码',
        nullable: true,
      },
      duration: {
        type: 'number',
        description: '执行时长（毫秒）',
      },
      timedOut: {
        type: 'boolean',
        description: '是否超时',
      },
    },
    required: ['stdout', 'stderr', 'exitCode', 'duration', 'timedOut'],
  };

  /**
   * 执行命令
   */
  async execute(input: BashToolInput): Promise<BashToolOutput> {
    const { command, timeout, cwd, env } = input;

    // 验证命令
    const commandValidation = this.securityManager.validateCommand(command);
    if (!commandValidation.valid) {
      throw new ToolError(
        commandValidation.errorCode as ToolErrorCode,
        commandValidation.errorMessage || '命令验证失败',
        { command }
      );
    }

    // 验证工作目录（如果指定）
    if (cwd) {
      const pathValidation = this.securityManager.validateFilePath(cwd);
      if (!pathValidation.valid) {
        throw new ToolError(
          pathValidation.errorCode as ToolErrorCode,
          pathValidation.errorMessage || '工作目录验证失败',
          { cwd }
        );
      }
    }

    // 清理环境变量
    const sanitizedEnv = env 
      ? this.securityManager.sanitizeEnvironment(env)
      : undefined;

    try {
      // 执行命令
      const result = await this.sandboxController.execute(command, [], {
        timeout: timeout || 30000,
        cwd,
        env: sanitizedEnv,
      });

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        duration: result.duration,
        timedOut: result.timedOut,
      };
    } catch (error) {
      if (error instanceof ToolError) {
        throw error;
      }

      throw new ToolError(
        ToolErrorCode.EXECUTION_FAILED,
        `命令执行失败: ${error instanceof Error ? error.message : String(error)}`,
        { 
          command, 
          error: error instanceof Error ? error.message : String(error) 
        }
      );
    }
  }
}
