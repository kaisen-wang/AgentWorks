/**
 * Edit 工具
 * 用于编辑文件内容，支持精确字符串替换和批量替换
 */

import * as fs from 'fs/promises';
import { SecurityManager, ToolError, ToolErrorCode } from './security';

/**
 * Edit 工具输入参数
 */
export interface EditToolInput {
  /** 文件路径（绝对路径） */
  file_path: string;
  /** 要替换的旧字符串 */
  old_string: string;
  /** 新字符串 */
  new_string: string;
  /** 是否替换所有出现（默认 false） */
  replace_all?: boolean;
}

/**
 * Edit 工具输出
 */
export interface EditToolOutput {
  /** 替换次数 */
  replacements: number;
  /** 文件路径 */
  path: string;
}

/**
 * Edit 工具类
 */
export class EditTool {
  readonly id = 'edit';
  readonly name = 'Edit';
  readonly description = '编辑文件内容，支持精确字符串替换和批量替换';
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
        description: '要编辑的文件绝对路径',
      },
      old_string: {
        type: 'string',
        description: '要替换的旧字符串',
      },
      new_string: {
        type: 'string',
        description: '新字符串',
      },
      replace_all: {
        type: 'boolean',
        description: '是否替换所有出现（默认 false）',
        default: false,
      },
    },
    required: ['file_path', 'old_string', 'new_string'],
  };

  /**
   * JSON Schema 输出定义
   */
  readonly outputSchema = {
    type: 'object',
    properties: {
      replacements: {
        type: 'number',
        description: '替换次数',
      },
      path: {
        type: 'string',
        description: '文件路径',
      },
    },
    required: ['replacements', 'path'],
  };

  /**
   * 执行文件编辑
   */
  async execute(input: EditToolInput): Promise<EditToolOutput> {
    const { file_path, old_string, new_string, replace_all = false } = input;

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

      // 读取文件内容
      const content = await fs.readFile(file_path, 'utf-8');

      // 查找所有匹配位置
      const matches: number[] = [];
      let searchPos = 0;
      
      while (true) {
        const pos = content.indexOf(old_string, searchPos);
        if (pos === -1) break;
        matches.push(pos);
        searchPos = pos + 1;
      }

      // 检查是否找到字符串
      if (matches.length === 0) {
        throw new ToolError(
          ToolErrorCode.STRING_NOT_FOUND,
          `未找到要替换的字符串: "${old_string}"`,
          { path: file_path, old_string }
        );
      }

      // 检查多处匹配但未设置 replace_all
      if (matches.length > 1 && !replace_all) {
        throw new ToolError(
          ToolErrorCode.MULTIPLE_MATCHES,
          `找到 ${matches.length} 处匹配，但未设置 replace_all 参数`,
          { 
            path: file_path, 
            matches: matches.length,
            suggestion: '设置 replace_all=true 以替换所有匹配',
          }
        );
      }

      // 执行替换
      let newContent: string;
      let replacements: number;

      if (replace_all) {
        // 替换所有出现
        newContent = content.split(old_string).join(new_string);
        replacements = matches.length;
      } else {
        // 只替换第一次出现
        const pos = matches[0];
        newContent = 
          content.substring(0, pos) + 
          new_string + 
          content.substring(pos + old_string.length);
        replacements = 1;
      }

      // 写入文件
      await fs.writeFile(file_path, newContent, 'utf-8');

      return {
        replacements,
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
          `没有权限编辑文件: ${file_path}`,
          { path: file_path }
        );
      }

      throw new ToolError(
        ToolErrorCode.EXECUTION_FAILED,
        `编辑文件失败: ${error instanceof Error ? error.message : String(error)}`,
        { path: file_path, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }
}
