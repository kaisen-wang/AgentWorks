/**
 * 安全管理器
 * 负责路径验证、命令验证和环境变量清理
 */

import * as path from 'path';
import * as fs from 'fs';
import {
  SecurityConfig,
  SecurityPolicy,
  ValidationResult,
  ToolErrorCode,
  ToolError,
} from './types';

export class SecurityManager {
  private config: SecurityConfig;
  private policy: SecurityPolicy;

  constructor(config?: Partial<SecurityConfig>, policy?: Partial<SecurityPolicy>) {
    this.config = { ...defaultSecurityConfig, ...config };
    this.policy = { ...defaultSecurityPolicy, ...policy };
  }

  /**
   * 验证文件路径是否在允许范围内
   */
  validateFilePath(filePath: string): ValidationResult {
    if (!this.policy.enablePathValidation) {
      return { valid: true };
    }

    try {
      // 解析绝对路径
      const absolutePath = path.resolve(filePath);
      const realPath = fs.existsSync(absolutePath)
        ? fs.realpathSync(absolutePath)
        : absolutePath;

      // 检查目录遍历攻击
      if (this.hasDirectoryTraversal(filePath)) {
        return {
          valid: false,
          errorCode: ToolErrorCode.PATH_NOT_ALLOWED,
          errorMessage: '路径包含非法的目录遍历序列',
        };
      }

      // 检查路径是否在允许的目录范围内
      const isAllowed = this.config.allowedDirectories.some((allowedDir) => {
        const absoluteAllowedDir = path.resolve(allowedDir);
        return realPath.startsWith(absoluteAllowedDir + path.sep) || 
               realPath === absoluteAllowedDir;
      });

      if (!isAllowed) {
        return {
          valid: false,
          errorCode: ToolErrorCode.PATH_NOT_ALLOWED,
          errorMessage: `路径不在允许的目录范围内: ${filePath}`,
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        errorCode: ToolErrorCode.PATH_NOT_ALLOWED,
        errorMessage: `路径验证失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * 验证命令是否在黑名单中
   */
  validateCommand(command: string): ValidationResult {
    if (!this.policy.enableCommandValidation) {
      return { valid: true };
    }

    // 检查命令是否匹配黑名单
    const normalizedCommand = command.trim().toLowerCase();
    
    for (const blocked of this.config.blockedCommands) {
      const normalizedBlocked = blocked.toLowerCase();
      
      // 精确匹配或包含匹配
      if (normalizedCommand === normalizedBlocked || 
          normalizedCommand.startsWith(normalizedBlocked + ' ') ||
          normalizedCommand.includes(normalizedBlocked)) {
        return {
          valid: false,
          errorCode: ToolErrorCode.COMMAND_BLOCKED,
          errorMessage: `命令被禁止执行: ${blocked}`,
        };
      }
    }

    // 检查危险命令模式
    if (this.hasDangerousPattern(command)) {
      return {
        valid: false,
        errorCode: ToolErrorCode.COMMAND_BLOCKED,
        errorMessage: '命令包含危险模式',
      };
    }

    return { valid: true };
  }

  /**
   * 清理环境变量中的敏感信息
   */
  sanitizeEnvironment(env: Record<string, string>): Record<string, string> {
    if (!this.policy.enableEnvSanitization) {
      return env;
    }

    const sanitized: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(env)) {
      // 检查键名是否匹配敏感模式
      const isSensitive = this.config.sensitiveEnvPatterns.some((pattern) =>
        key.toUpperCase().includes(pattern.toUpperCase())
      );

      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * 检查文件大小是否超过限制
   */
  validateFileSize(filePath: string): ValidationResult {
    try {
      const stats = fs.statSync(filePath);
      
      if (stats.size > this.config.maxFileSize) {
        return {
          valid: false,
          errorCode: ToolErrorCode.FILE_TOO_LARGE,
          errorMessage: `文件大小超过限制: ${stats.size} > ${this.config.maxFileSize} 字节`,
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        errorCode: ToolErrorCode.FILE_NOT_FOUND,
        errorMessage: `无法获取文件信息: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * 检查路径是否包含目录遍历攻击
   */
  private hasDirectoryTraversal(filePath: string): boolean {
    // 检查 ../ 和 ..\ 序列
    const normalized = path.normalize(filePath);
    const hasTraversal = filePath.includes('../') || 
                         filePath.includes('..\\') ||
                         normalized.startsWith('..');
    return hasTraversal;
  }

  /**
   * 检查命令是否包含危险模式
   */
  private hasDangerousPattern(command: string): boolean {
    const dangerousPatterns = [
      /\brm\s+-rf\s+\/\b/i,           // rm -rf /
      /\brm\s+-rf\s+\/\*/i,           // rm -rf /*
      /\bchmod\s+777\s+\/\b/i,        // chmod 777 /
      /\bdd\s+if=\/dev\/zero\b/i,     // dd if=/dev/zero
      /\bmkfs\b/i,                    // mkfs
      /\bfdisk\b/i,                   // fdisk
      />\s*\/dev\/sd/i,               // 重定向到设备文件
      /\|\s*sh\b/i,                   // 管道到 shell
      /\|\s*bash\b/i,                 // 管道到 bash
    ];

    return dangerousPatterns.some((pattern) => pattern.test(command));
  }

  /**
   * 获取当前配置
   */
  getConfig(): SecurityConfig {
    return { ...this.config };
  }

  /**
   * 获取当前策略
   */
  getPolicy(): SecurityPolicy {
    return { ...this.policy };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 更新策略
   */
  updatePolicy(policy: Partial<SecurityPolicy>): void {
    this.policy = { ...this.policy, ...policy };
  }
}

// 导入默认配置
import { defaultSecurityConfig, defaultSecurityPolicy } from './types';
