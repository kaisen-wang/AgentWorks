/**
 * Read 工具
 * 用于读取文件内容，支持行号显示和分页读取
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { SecurityManager, ToolError, ToolErrorCode } from './security';

/**
 * Read 工具输入参数
 */
export interface ReadToolInput {
  /** 文件路径（绝对路径） */
  file_path: string;
  /** 起始行号（可选，从 1 开始） */
  offset?: number;
  /** 读取行数（可选） */
  limit?: number;
}

/**
 * Read 工具输出
 */
export interface ReadToolOutput {
  /** 文件内容（带行号） */
  content: string;
  /** 总行数 */
  lines: number;
  /** 文件大小（字节） */
  size: number;
  /** 文件路径 */
  path: string;
}

/**
 * Read 工具类
 */
export class ReadTool {
  readonly id = 'read';
  readonly name = 'Read';
  readonly description = '读取文件内容，支持行号显示和分页读取';
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
        description: '要读取的文件绝对路径',
      },
      offset: {
        type: 'number',
        description: '起始行号（从 1 开始）',
        minimum: 1,
      },
      limit: {
        type: 'number',
        description: '读取的行数',
        minimum: 1,
      },
    },
    required: ['file_path'],
  };

  /**
   * JSON Schema 输出定义
   */
  readonly outputSchema = {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: '文件内容（带行号）',
      },
      lines: {
        type: 'number',
        description: '总行数',
      },
      size: {
        type: 'number',
        description: '文件大小（字节）',
      },
      path: {
        type: 'string',
        description: '文件路径',
      },
    },
    required: ['content', 'lines', 'size', 'path'],
  };

  /**
   * 执行文件读取
   */
  async execute(input: ReadToolInput): Promise<ReadToolOutput> {
    const { file_path, offset, limit } = input;

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
      // 检查文件是否存在
      const stats = await fs.stat(file_path);
      
      if (!stats.isFile()) {
        throw new ToolError(
          ToolErrorCode.FILE_NOT_FOUND,
          '路径不是一个文件',
          { path: file_path }
        );
      }

      // 验证文件大小
      const sizeValidation = this.securityManager.validateFileSize(file_path);
      if (!sizeValidation.valid) {
        throw new ToolError(
          sizeValidation.errorCode as ToolErrorCode,
          sizeValidation.errorMessage || '文件大小验证失败',
          { path: file_path, size: stats.size }
        );
      }

      // 读取文件内容
      const rawContent = await fs.readFile(file_path, 'utf-8');
      const lines = rawContent.split('\n');

      // 处理分页
      let selectedLines = lines;
      let startLine = 1;

      if (offset !== undefined && offset > 0) {
        startLine = offset;
        selectedLines = lines.slice(offset - 1);
      }

      if (limit !== undefined && limit > 0) {
        selectedLines = selectedLines.slice(0, limit);
      }

      // 添加行号
      const numberedContent = selectedLines
        .map((line, index) => `${startLine + index}->${line}`)
        .join('\n');

      return {
        content: numberedContent,
        lines: lines.length,
        size: stats.size,
        path: file_path,
      };
    } catch (error) {
      if (error instanceof ToolError) {
        throw error;
      }

      // 处理文件系统错误
      const nodeError = error as NodeJS.ErrnoException;
      
      if (nodeError.code === 'ENOENT') {
        throw new ToolError(
          ToolErrorCode.FILE_NOT_FOUND,
          `文件不存在: ${file_path}`,
          { path: file_path }
        );
      }

      if (nodeError.code === 'EACCES' || nodeError.code === 'EPERM') {
        throw new ToolError(
          ToolErrorCode.PERMISSION_DENIED,
          `没有权限读取文件: ${file_path}`,
          { path: file_path }
        );
      }

      throw new ToolError(
        ToolErrorCode.EXECUTION_FAILED,
        `读取文件失败: ${error instanceof Error ? error.message : String(error)}`,
        { path: file_path, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }
}
