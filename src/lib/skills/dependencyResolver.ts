/**
 * 依赖解析器实现
 */

import type {
  SkillDefinition,
  DependencyGraph,
  DependencyNode,
  DependencyValidationResult,
  CycleDetectionResult,
} from '@/types';
import type { IDependencyResolver, IToolRegistry } from '@/lib/skills/types';

/**
 * 依赖解析器
 * 解析 Skill 的 Tool 依赖关系
 */
export class DependencyResolver implements IDependencyResolver {
  constructor(private toolRegistry: IToolRegistry) {}

  /**
   * 解析 Skill 的依赖关系
   */
  async resolve(skill: SkillDefinition): Promise<DependencyGraph> {
    const nodes = new Map<string, DependencyNode>();
    const edges: Array<{ from: string; to: string }> = [];

    // 添加 Skill 节点
    nodes.set(skill.meta.id, {
      id: skill.meta.id,
      type: 'skill',
      required: true,
      status: 'resolved',
    });

    // 解析每个依赖
    for (const dep of skill.dependencies) {
      // 检查 Tool 是否存在（使用通配符 agentId 表示全局查找）
      const tool = await this.toolRegistry.find('*', dep.toolId);

      const node: DependencyNode = {
        id: dep.toolId,
        type: 'tool',
        required: dep.required,
        status: tool ? 'resolved' : 'missing',
      };

      nodes.set(dep.toolId, node);

      // 添加边（Skill -> Tool）
      edges.push({
        from: skill.meta.id,
        to: dep.toolId,
      });
    }

    return { nodes, edges };
  }

  /**
   * 验证依赖可用性
   */
  async validate(graph: DependencyGraph): Promise<DependencyValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 检查每个节点
    for (const [id, node] of graph.nodes) {
      if (node.status === 'missing') {
        if (node.required) {
          errors.push(`Required dependency '${id}' is missing`);
        } else {
          warnings.push(`Optional dependency '${id}' is missing`);
        }
      } else if (node.status === 'error') {
        errors.push(`Dependency '${id}' has error`);
      }
    }

    // 检测循环依赖
    const cycleResult = this.detectCycle(graph);
    if (cycleResult.hasCycle) {
      errors.push(
        `Circular dependency detected: ${cycleResult.cycle?.join(' -> ')}`
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 检测循环依赖
   * 使用 DFS 算法检测
   */
  detectCycle(graph: DependencyGraph): CycleDetectionResult {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    // 构建邻接表
    const adjacencyList = new Map<string, string[]>();
    for (const [id] of graph.nodes) {
      adjacencyList.set(id, []);
    }

    for (const edge of graph.edges) {
      const neighbors = adjacencyList.get(edge.from);
      if (neighbors) {
        neighbors.push(edge.to);
      }
    }

    // DFS 检测环
    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const neighbors = adjacencyList.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) {
            return true;
          }
        } else if (recursionStack.has(neighbor)) {
          // 找到环
          const cycleStart = path.indexOf(neighbor);
          const cycle = path.slice(cycleStart);
          cycle.push(neighbor);
          return true;
        }
      }

      recursionStack.delete(nodeId);
      path.pop();
      return false;
    };

    // 对每个未访问的节点执行 DFS
    for (const [nodeId] of graph.nodes) {
      if (!visited.has(nodeId)) {
        if (dfs(nodeId)) {
          return {
            hasCycle: true,
            cycle: path,
          };
        }
      }
    }

    return {
      hasCycle: false,
    };
  }

  /**
   * 拓扑排序
   * 使用 Kahn 算法
   */
  topologicalSort(graph: DependencyGraph): string[] {
    // 计算入度
    const inDegree = new Map<string, number>();
    for (const [id] of graph.nodes) {
      inDegree.set(id, 0);
    }

    for (const edge of graph.edges) {
      const current = inDegree.get(edge.to) || 0;
      inDegree.set(edge.to, current + 1);
    }

    // 构建邻接表
    const adjacencyList = new Map<string, string[]>();
    for (const [id] of graph.nodes) {
      adjacencyList.set(id, []);
    }

    for (const edge of graph.edges) {
      const neighbors = adjacencyList.get(edge.from);
      if (neighbors) {
        neighbors.push(edge.to);
      }
    }

    // 找到所有入度为 0 的节点
    const queue: string[] = [];
    for (const [id, degree] of inDegree) {
      if (degree === 0) {
        queue.push(id);
      }
    }

    // 拓扑排序
    const result: string[] = [];
    while (queue.length > 0) {
      const node = queue.shift()!;
      result.push(node);

      const neighbors = adjacencyList.get(node) || [];
      for (const neighbor of neighbors) {
        const degree = inDegree.get(neighbor)! - 1;
        inDegree.set(neighbor, degree);

        if (degree === 0) {
          queue.push(neighbor);
        }
      }
    }

    // 如果结果长度不等于节点数，说明有环
    if (result.length !== graph.nodes.size) {
      throw new Error('Graph contains cycle, topological sort not possible');
    }

    return result;
  }
}
