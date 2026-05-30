/**
 * Skill 解析器
 *
 * 解析 Skill 定义和元数据，从 skill.json 构建 SkillDefinition 对象。
 */

import { readFile, stat } from 'fs/promises';
import { join } from 'path';
import type {
  SkillDefinition,
  SkillMeta,
  SkillExecutor,
  SkillContext,
  SkillResult,
  ToolDependency,
  JSONSchema,
  PackageMetadata,
  InstallErrorCode,
} from '@/types';

export class SkillParser {
  /**
   * 解析 Skill 定义
   */
  async parse(packagePath: string): Promise<SkillDefinition> {
    // 读取 skill.json
    const skillJsonPath = join(packagePath, 'skill.json');
    const content = await readFile(skillJsonPath, 'utf-8');
    const skillJson = JSON.parse(content);

    // 解析元数据
    const meta: SkillMeta = {
      id: skillJson.meta.id,
      name: skillJson.meta.name,
      description: skillJson.meta.description || '',
      version: skillJson.meta.version || '1.0.0',
      author: skillJson.meta.author,
      tags: skillJson.meta.tags,
      category: skillJson.meta.category,
    };

    // 解析 inputSchema
    const inputSchema: JSONSchema = skillJson.inputSchema;

    // 解析 outputSchema
    const outputSchema: JSONSchema = skillJson.outputSchema;

    // 解析 dependencies
    const dependencies: ToolDependency[] = Array.isArray(skillJson.dependencies)
      ? skillJson.dependencies
      : [];

    // 解析 executor
    const executor = await this.parseExecutor(packagePath, skillJson.executor);

    // 构建 SkillDefinition
    return {
      meta,
      inputSchema,
      outputSchema,
      dependencies,
      executor,
      config: skillJson.config,
    };
  }

  /**
   * 解析包元数据
   */
  async parseMetadata(packagePath: string): Promise<PackageMetadata> {
    const skillJsonPath = join(packagePath, 'skill.json');
    const content = await readFile(skillJsonPath, 'utf-8');
    const skillJson = JSON.parse(content);

    return {
      name: skillJson.meta?.name || '',
      version: skillJson.meta?.version || '0.0.0',
      description: skillJson.meta?.description || '',
      author: skillJson.meta?.author,
    };
  }

  /**
   * 解析执行器
   *
   * 支持两种形式：
   * 1. 字符串引用：指向包内的文件路径
   * 2. 内联定义：直接包含执行代码
   */
  private async parseExecutor(
    packagePath: string,
    executorDef: unknown
  ): Promise<SkillExecutor> {
    if (typeof executorDef === 'string') {
      // 文件引用
      const executorPath = join(packagePath, executorDef);
      const executorCode = await readFile(executorPath, 'utf-8');
      return this.compileExecutor(executorCode);
    }

    if (typeof executorDef === 'object' && executorDef !== null) {
      // 内联定义（包含 code 或 handler 字段）
      const def = executorDef as Record<string, unknown>;
      if (typeof def.code === 'string') {
        return this.compileExecutor(def.code);
      }
      if (typeof def.handler === 'string') {
        const handlerPath = join(packagePath, def.handler);
        const handlerCode = await readFile(handlerPath, 'utf-8');
        return this.compileExecutor(handlerCode);
      }
    }

    // 默认：返回一个抛出错误的执行器
    return async (_context: SkillContext, _params: Record<string, unknown>): Promise<SkillResult> => {
      return {
        success: false,
        error: {
          code: 'NO_EXECUTOR' as string,
          message: 'No valid executor found in skill package',
        },
      };
    };
  }

  /**
   * 编译执行器代码
   *
   * 使用 Function 构造器安全地创建执行函数。
   * 注意：这仍然有安全风险，应配合安全扫描使用。
   */
  private compileExecutor(code: string): SkillExecutor {
    try {
      // 创建一个沙箱化的执行器
      const fn = new Function(
        'context',
        'params',
        `"use strict";\n${code}`
      );

      return async (context: SkillContext, params: Record<string, unknown>): Promise<SkillResult> => {
        try {
          const result = fn(context, params);
          // 如果结果是 Promise，等待它
          const resolved = result instanceof Promise ? await result : result;
          return {
            success: true,
            data: resolved,
          };
        } catch (err) {
          return {
            success: false,
            error: {
              code: 'EXECUTOR_ERROR',
              message: err instanceof Error ? err.message : String(err),
            },
          };
        }
      };
    } catch (err) {
      // 编译失败，返回错误执行器
      return async (_context: SkillContext, _params: Record<string, unknown>): Promise<SkillResult> => {
        return {
          success: false,
          error: {
            code: 'COMPILE_ERROR',
            message: `Executor compilation failed: ${err instanceof Error ? err.message : String(err)}`,
          },
        };
      };
    }
  }
}
