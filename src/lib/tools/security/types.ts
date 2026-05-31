/**
 * 安全管理类型定义
 */

/**
 * 安全配置接口
 */
export interface SecurityConfig {
  /** 允许访问的目录列表 */
  allowedDirectories: string[];
  /** 禁止执行的命令黑名单 */
  blockedCommands: string[];
  /** 最大文件大小（字节） */
  maxFileSize: number;
  /** 默认超时时间（毫秒） */
  defaultTimeout: number;
  /** 敏感环境变量名称模式 */
  sensitiveEnvPatterns: string[];
}

/**
 * 安全策略接口
 */
export interface SecurityPolicy {
  /** 是否启用路径验证 */
  enablePathValidation: boolean;
  /** 是否启用命令验证 */
  enableCommandValidation: boolean;
  /** 是否启用环境变量清理 */
  enableEnvSanitization: boolean;
  /** 是否启用沙箱执行 */
  enableSandbox: boolean;
}

/**
 * 沙箱执行选项
 */
export interface SandboxOptions {
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 工作目录 */
  cwd?: string;
  /** 环境变量 */
  env?: Record<string, string>;
  /** 是否分离进程 */
  detached?: boolean;
}

/**
 * 验证结果
 */
export interface ValidationResult {
  /** 是否有效 */
  valid: boolean;
  /** 错误代码 */
  errorCode?: string;
  /** 错误消息 */
  errorMessage?: string;
}

/**
 * 命令执行结果
 */
export interface CommandResult {
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
 * 工具错误类型
 */
export enum ToolErrorCode {
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  PATH_NOT_ALLOWED = 'PATH_NOT_ALLOWED',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  DIRECTORY_NOT_FOUND = 'DIRECTORY_NOT_FOUND',
  STRING_NOT_FOUND = 'STRING_NOT_FOUND',
  MULTIPLE_MATCHES = 'MULTIPLE_MATCHES',
  COMMAND_BLOCKED = 'COMMAND_BLOCKED',
  TIMEOUT = 'TIMEOUT',
  EXECUTION_FAILED = 'EXECUTION_FAILED',
  INVALID_INPUT = 'INVALID_INPUT',
}

/**
 * 工具错误
 */
export class ToolError extends Error {
  constructor(
    public code: ToolErrorCode,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ToolError';
  }
}

/**
 * 默认安全配置
 */
export const defaultSecurityConfig: SecurityConfig = {
  allowedDirectories: [process.cwd(), '/tmp'],
  blockedCommands: [
    'rm -rf /',
    'rm -rf /*',
    'sudo',
    'chmod 777',
    'chmod -R 777',
    'dd if=/dev/zero',
    ':(){ :|:& };:',
    'mkfs',
    'fdisk',
  ],
  maxFileSize: 10 * 1024 * 1024, // 10MB
  defaultTimeout: 30000, // 30秒
  sensitiveEnvPatterns: [
    'API_KEY',
    'SECRET',
    'PASSWORD',
    'TOKEN',
    'CREDENTIAL',
    'PRIVATE_KEY',
    'ACCESS_KEY',
  ],
};

/**
 * 默认安全策略
 */
export const defaultSecurityPolicy: SecurityPolicy = {
  enablePathValidation: true,
  enableCommandValidation: true,
  enableEnvSanitization: true,
  enableSandbox: true,
};
