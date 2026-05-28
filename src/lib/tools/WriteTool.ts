/**
 * Write 工具
 * 用于写入文件内容，支持创建新文件和覆盖现有文件
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { SecurityManager, ToolError, ToolErrorCode } from './security';

/**
 * Write 工具输入参数
 */
export interface WriteToolInput {
  /** 文件路径（绝对路径） */
  file_path: string;
  /** 文件内容 */
  content: string;
  /** 文件编码（默认 utf-8） */
  encoding?: BufferEncoding;
}

/**
 * Write 工具输出
 */
export interface WriteToolOutput {
  /** 写入的字节数 */
  bytesWritten: number;
  /** 文件路径 */
  path: string;
}

/**
 * Write 工具类
 */
export class WriteTool {
  readonly id = 'write';
  readonly name = 'Write';
  readonly description = '写入文件内容，支持创建新文件和覆盖现有文件';
  readonly version = '1.0.0';

  private securityManager: SecurityManager;

  constructor(securityManager: SecurityManager) {
    this.securityManager = securityManager;
  }

  /**
   * JSON Schema 输入定义
   */
  readonly inputSchema = {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: '要写入的文件绝对路径',
      },
      content: {
        type: 'string',
        description: '要写入的文件内容',
      },
      encoding: {
        type: 'string',
        description: '文件编码（默认 utf-8）',
        enum: ['utf-8', 'ascii', 'base64', 'binary', 'hex', 'latin1'],
        default: 'utf-8',
      },
    },
    required: ['file_path', 'content'],
  };

  /**
   * JSON Schema 输出定义
   */
  readonly outputSchema = {
    type: 'object',
    properties: {
      bytesWritten: {
        type: 'number',
        description: '写入的字节数',
      },
      path: {
        type: 'string',
        description: '文件路径',
      },
    },
    required: ['bytesWritten', 'path'],
  };

  /**
   * 执行文件写入
   */
  async execute(input: WriteToolInput): Promise<WriteToolOutput> {
    const { file_path, content, encoding = 'utf-8' } = input;

    // 验证路径
    const pathValidation = this.securityManager.validateFilePath(file_path);
    if (!pathValidation.valid) {
      throw new ToolError(
        pathValidation.errorCode as ToolErrorCode,
        pathValidation.errorMessage || '路径验证失败',
        { path: file_path }
      );
    }

    try {
      // 检查父目录是否存在
      const parentDir = path.dirname(file_path);
      
      try {
        const parentStats = await fs.stat(parentDir);
        if (!parentStats.isDirectory()) {
          throw new ToolError(
            ToolErrorCode.DIRECTORY_NOT_FOUND,
            `父路径不是一个目录: ${parentDir}`,
            { path: file_path, parentDir }
          );
        }
      } catch (error) {
        const nodeError = error as NodeJS.ErrnoException;
        if (nodeError.code === 'ENOENT') {
          throw new ToolError(
            ToolErrorCode.DIRECTORY_NOT_FOUND,
            `父目录不存在: ${parentDir}`,
            { path: file_path, parentDir }
          );
        }
        throw error;
      }

      // 写入文件
      await fs.writeFile(file_path, content, encoding);

      // 计算写入的字节数
      const bytesWritten = Buffer.byteLength(content, encoding);

      return {
        bytesWritten,
        path: file_path,
      };
    } catch (error) {
      if (error instanceof ToolError) {
        throw error;
      }

      // 处理文件系统错误
      const nodeError = error as NodeJS.ErrnoException;
      
      if (nodeError.code === 'EACCES' || nodeError.code === 'EPERM') {
        throw new ToolError(
          ToolErrorCode.PERMISSION_DENIED,
          `没有权限写入文件: ${file_path}`,
          { path: file_path }
        );
      }

      if (nodeError.code === 'ENOSPC') {
        throw new ToolError(
          ToolErrorCode.EXECUTION_FAILED,
          '磁盘空间不足',
          { path: file_path }
        );
      }

      throw new ToolError(
        ToolErrorCode.EXECUTION_FAILED,
        `写入文件失败: ${error instanceof Error ? error.message : String(error)}`,
        { path: file_path, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }
}
