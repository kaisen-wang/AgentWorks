/**
 * Skills 和 Tools 模块统一导出
 */

// 导出类型
export * from './types';

// 导出核心类
export { ResourcePool, GlobalResourcePool, PrivateResourcePool, ResourceManager } from './resourcePool';
export { DependencyResolver } from './dependencyResolver';
export { ToolRegistry } from './toolRegistry';
export { MCPAdapter } from './mcpAdapter';
export { SkillRegistry } from './skillRegistry';
export { SkillExecutor, ToolExecutor, ExecutionScheduler } from './executor';

// 导出数据访问层
export { SkillRepo } from '@/lib/db/skillRepo';
export { ToolRepo } from '@/lib/db/toolRepo';
export { ExecutionLogRepo } from '@/lib/db/executionLogRepo';
export { AgentSkillBindingRepo, AgentToolBindingRepo } from '@/lib/db/bindingRepo';

/**
 * 创建 Skills 和 Tools 管理器
 */
import { getDb } from '@/lib/db/database';
import { SkillRepo } from '@/lib/db/skillRepo';
import { ToolRepo } from '@/lib/db/toolRepo';
import { ExecutionLogRepo } from '@/lib/db/executionLogRepo';
import { ToolRegistry } from './toolRegistry';
import { SkillRegistry } from './skillRegistry';
import { SkillExecutor, ToolExecutor, ExecutionScheduler } from './executor';
import { MCPAdapter } from './mcpAdapter';

export interface SkillsToolsManager {
  skillRegistry: SkillRegistry;
  toolRegistry: ToolRegistry;
  skillExecutor: SkillExecutor;
  toolExecutor: ToolExecutor;
  executionScheduler: ExecutionScheduler;
  mcpAdapter: MCPAdapter;
}

/**
 * SkillsToolsManager 单例
 */
let managerInstance: SkillsToolsManager | null = null;
let managerInitPromise: Promise<SkillsToolsManager> | null = null;

/**
 * 获取或创建 Skills 和 Tools 管理器（单例）
 * 确保全局工具只初始化一次
 */
export async function createSkillsToolsManager(): Promise<SkillsToolsManager> {
  // 已初始化，直接返回
  if (managerInstance) {
    return managerInstance;
  }

  // 正在初始化中，等待完成（防止并发请求重复初始化）
  if (managerInitPromise) {
    return managerInitPromise;
  }

  // 开始初始化
  managerInitPromise = (async () => {
    const db = getDb();

    // 创建数据访问层
    const skillRepo = new SkillRepo(db);
    const toolRepo = new ToolRepo(db);
    const executionLogRepo = new ExecutionLogRepo(db);

    // 创建注册表
    const toolRegistry = new ToolRegistry(toolRepo, executionLogRepo);
    const skillRegistry = new SkillRegistry(skillRepo, toolRegistry, executionLogRepo);

    // 初始化全局工具（Read、Write、Edit、Bash）
    const { initializeGlobalTools } = await import('@/lib/tools/init');
    await initializeGlobalTools(toolRegistry);

    // 创建执行器
    const toolExecutor = new ToolExecutor(toolRegistry);
    const skillExecutor = new SkillExecutor(skillRegistry, toolExecutor);

    // 创建调度器
    const executionScheduler = new ExecutionScheduler(
      skillExecutor,
      toolExecutor,
      {
        maxConcurrency: 10,
        maxAgentConcurrency: 3,
      }
    );

    // 创建 MCP 适配器
    const mcpAdapter = new MCPAdapter();

    managerInstance = {
      skillRegistry,
      toolRegistry,
      skillExecutor,
      toolExecutor,
      executionScheduler,
      mcpAdapter,
    };

    managerInitPromise = null;
    return managerInstance;
  })();

  return managerInitPromise;
}
