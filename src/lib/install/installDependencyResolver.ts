/**
 * 安装依赖解析器
 *
 * 解析和安装 Skill 依赖的 Tools，检测循环依赖。
 */

import type {
  AgentId,
  ToolId,
  ToolDefinition,
  ToolDependency,
  DependencyResolution,
  AutoInstallResult,
} from '@/types';
import type { IToolRegistry } from '@/lib/skills/types';

export class InstallDependencyResolver {
  constructor(private toolRegistry: IToolRegistry) {}

  /**
   * 解析依赖
   */
  async resolve(
    dependencies: ToolDependency[],
    agentId: AgentId
  ): Promise<DependencyResolution> {
    const resolved = new Map<ToolId, ToolDefinition>();
    const missing: ToolDependency[] = [];
    const graph = new Map<ToolId, ToolDependency[]>();

    // 解析每个依赖
    for (const dep of dependencies) {
      // 检查是否已安装（全局或私有）
      const tool = await this.toolRegistry.find(agentId, dep.toolId);

      if (tool) {
        resolved.set(dep.toolId, tool);
      } else if (dep.required) {
        missing.push(dep);
      }

      // 构建依赖图（用于循环检测）
      graph.set(dep.toolId, []);
    }

    // 检测循环依赖
    const hasCircular = this.detectCircular(graph);

    return { resolved, missing, hasCircular };
  }

  /**
   * 自动安装缺失的依赖
   *
   * 注意：当前实现中，自动安装需要 Tool 的安装源信息。
   * 如果 Tool 没有可用的安装源，则标记为失败。
   */
  async autoInstall(
    missing: ToolDependency[],
    agentId: AgentId
  ): Promise<AutoInstallResult> {
    const installed: ToolId[] = [];
    const failed: Array<{ toolId: ToolId; error: string }> = [];

    for (const dep of missing) {
      try {
        // 检查 Tool 是否已存在（可能在解析过程中被其他安装添加）
        const existing = await this.toolRegistry.find(agentId, dep.toolId);
        if (existing) {
          installed.push(dep.toolId);
          continue;
        }

        // 当前无法自动安装没有源信息的 Tool
        // 记录为失败
        failed.push({
          toolId: dep.toolId,
          error: `Tool "${dep.toolId}" not found and no installation source available`,
        });
      } catch (err) {
        failed.push({
          toolId: dep.toolId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return {
      success: failed.length === 0,
      installed,
      failed,
    };
  }

  /**
   * 检测循环依赖（使用深度优先搜索）
   */
  private detectCircular(graph: Map<ToolId, ToolDependency[]>): boolean {
    const visited = new Set<ToolId>();
    const recursionStack = new Set<ToolId>();

    for (const [node] of graph) {
      if (this.hasCycle(node, graph, visited, recursionStack)) {
        return true;
      }
    }

    return false;
  }

  private hasCycle(
    node: ToolId,
    graph: Map<ToolId, ToolDependency[]>,
    visited: Set<ToolId>,
    recursionStack: Set<ToolId>
  ): boolean {
    if (recursionStack.has(node)) return true;
    if (visited.has(node)) return false;

    visited.add(node);
    recursionStack.add(node);

    const neighbors = graph.get(node) || [];
    for (const neighbor of neighbors) {
      if (this.hasCycle(neighbor.toolId, graph, visited, recursionStack)) {
        return true;
      }
    }

    recursionStack.delete(node);
    return false;
  }
}
