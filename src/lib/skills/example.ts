/**
 * Skills 和 Tools 使用示例
 */

import { createSkillsToolsManager } from '@/lib/skills';
import type { SkillDefinition, ToolDefinition } from '@/types';

async function main() {
  // 创建管理器
  const manager = createSkillsToolsManager();

  // ============================================
  // 示例 1: 注册全局 Tool
  // ============================================
  const globalTool: ToolDefinition = {
    type: 'custom',
    meta: {
      id: 'weather-tool',
      name: 'Weather Tool',
      description: 'Get weather information',
      version: '1.0.0',
    },
    inputSchema: {
      type: 'object',
      properties: {
        city: { type: 'string' },
      },
      required: ['city'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        temperature: { type: 'number' },
        condition: { type: 'string' },
      },
    },
    executor: async (params, context) => {
      // 模拟天气查询
      return {
        success: true,
        data: {
          city: params.city,
          temperature: 25,
          condition: 'Sunny',
        },
      };
    },
  };

  await manager.toolRegistry.register(globalTool, 'global');
  console.log('✅ Global tool registered');

  // ============================================
  // 示例 2: 注册私有 Tool
  // ============================================
  const privateTool: ToolDefinition = {
    type: 'custom',
    meta: {
      id: 'database-tool',
      name: 'Database Tool',
      description: 'Query database',
      version: '1.0.0',
    },
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
      },
      required: ['query'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        results: { type: 'array' },
      },
    },
    executor: async (params, context) => {
      // 模拟数据库查询
      return {
        success: true,
        data: {
          query: params.query,
          results: [{ id: 1, name: 'Item 1' }],
        },
      };
    },
  };

  await manager.toolRegistry.register(privateTool, 'private', 'agent-001');
  console.log('✅ Private tool registered');

  // ============================================
  // 示例 3: 注册 Skill（依赖 Tool）
  // ============================================
  const skill: SkillDefinition = {
    meta: {
      id: 'weather-report-skill',
      name: 'Weather Report Skill',
      description: 'Generate weather report',
      version: '1.0.0',
    },
    inputSchema: {
      type: 'object',
      properties: {
        city: { type: 'string' },
      },
      required: ['city'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        report: { type: 'string' },
      },
    },
    dependencies: [
      {
        toolId: 'weather-tool',
        required: true,
      },
    ],
    executor: async (context, params) => {
      // 获取依赖的 Tool
      const weatherTool = context.tools.get('weather-tool');

      if (!weatherTool) {
        return {
          success: false,
          error: {
            code: 'TOOL_NOT_FOUND',
            message: 'Weather tool not found',
          },
        };
      }

      // 调用 Tool
      const weatherResult = await weatherTool.execute({ city: params.city });

      if (!weatherResult.success) {
        return {
          success: false,
          error: {
            code: 'TOOL_ERROR',
            message: 'Failed to get weather',
            details: weatherResult.error,
          },
        };
      }

      // 生成报告
      const report = `Weather Report for ${params.city}:\n` +
        `Temperature: ${weatherResult.data.temperature}°C\n` +
        `Condition: ${weatherResult.data.condition}`;

      return {
        success: true,
        data: {
          report,
        },
      };
    },
  };

  await manager.skillRegistry.register(skill, 'global');
  console.log('✅ Skill registered');

  // ============================================
  // 示例 4: 执行 Tool
  // ============================================
  const toolResult = await manager.toolExecutor.execute('weather-tool', {
    city: 'Beijing',
  });

  console.log('✅ Tool executed:', toolResult);

  // ============================================
  // 示例 5: 执行 Skill
  // ============================================
  const skillResult = await manager.skillExecutor.execute(
    'agent-001',
    'weather-report-skill',
    { city: 'Shanghai' }
  );

  console.log('✅ Skill executed:', skillResult);

  // ============================================
  // 示例 6: 列出可访问的资源
  // ============================================
  const accessibleTools = await manager.toolRegistry.listAccessible('agent-001');
  console.log('✅ Accessible tools:', accessibleTools.map(t => t.meta.name));

  const accessibleSkills = await manager.skillRegistry.listAccessible('agent-001');
  console.log('✅ Accessible skills:', accessibleSkills.map(s => s.meta.name));

  // ============================================
  // 示例 7: 健康检查
  // ============================================
  const toolHealth = await manager.toolRegistry.healthCheck('weather-tool');
  console.log('✅ Tool health:', toolHealth);

  const skillHealth = await manager.skillRegistry.healthCheck('weather-report-skill');
  console.log('✅ Skill health:', skillHealth);
}

// 运行示例
main().catch(console.error);
