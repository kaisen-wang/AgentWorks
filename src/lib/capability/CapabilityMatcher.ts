/**
 * 能力标签库与匹配引擎（Task 10: ACT-05）
 *
 * 提供：
 * - 从 skills 数据动态匹配能力标签
 * - 根据能力标签自动匹配下属 Agent
 *
 * 注意：本模块不 import 任何数据库模块，可安全用于客户端 bundle。
 * 服务端如需直接读数据库，请使用 CapabilityMatcherServer.ts。
 */

import type { Agent, AgentCapability, AgentId } from "@/types";

// ============================================================
// 预置标签库（已废弃，保留空数组以兼容旧引用）
// ============================================================

/** @deprecated 能力标签现在全部从 skills 表动态加载 */
export const PRESET_CAPABILITIES: AgentCapability[] = [];

// ============================================================
// 从已有列表中匹配能力标签（客户端安全）
// ============================================================

/**
 * 从任务描述中提取匹配的能力标签
 * 遍历给定的 capabilities 列表，检查任务描述是否包含相关关键词
 *
 * @param taskDescription 任务描述文本
 * @param capabilities 可用能力标签列表（由调用方通过 API 获取后传入）
 */
export function matchCapabilitiesFromList(
  taskDescription: string,
  capabilities: AgentCapability[]
): string[] {
  const matched = new Set<string>();
  const desc = taskDescription.toLowerCase();

  for (const cap of capabilities) {
    // 匹配 skill name
    if (desc.includes(cap.name.toLowerCase())) {
      matched.add(cap.name);
      continue;
    }
    // 匹配 skill tags
    if (cap.tools) {
      for (const tag of cap.tools) {
        if (desc.includes(tag.toLowerCase())) {
          matched.add(cap.name);
          break;
        }
      }
    }
    // 匹配 description 中的关键词
    if (cap.description) {
      const keywords = cap.description.split(/[，,、\s]+/).filter(k => k.length >= 2);
      for (const kw of keywords) {
        if (desc.includes(kw.toLowerCase())) {
          matched.add(cap.name);
          break;
        }
      }
    }
  }

  return Array.from(matched);
}

// ============================================================
// Agent 匹配
// ============================================================

/**
 * 根据能力标签匹配最合适的下属 Agent
 *
 * 返回按匹配度排序的 Agent 列表（匹配标签数多的排前面）。
 * 如果无匹配，返回空数组。
 */
export function matchAgentByCapability(
  requiredCapabilities: string[],
  candidates: Agent[]
): { agent: Agent; matchScore: number; matchedTags: string[] }[] {
  const results: { agent: Agent; matchScore: number; matchedTags: string[] }[] = [];

  for (const agent of candidates) {
    const agentTagNames = agent.capabilities.map((c) => c.name);
    const matchedTags = requiredCapabilities.filter((req) =>
      agentTagNames.some((tag) => tag === req || tag.includes(req) || req.includes(tag))
    );

    if (matchedTags.length > 0) {
      results.push({
        agent,
        matchScore: matchedTags.length / requiredCapabilities.length,
        matchedTags,
      });
    }
  }

  // 按匹配度降序排序
  results.sort((a, b) => b.matchScore - a.matchScore);
  return results;
}

/**
 * 查找最佳匹配 Agent（匹配度最高的）
 */
export function findBestMatchAgent(
  requiredCapabilities: string[],
  candidates: Agent[]
): Agent | null {
  const matches = matchAgentByCapability(requiredCapabilities, candidates);
  return matches.length > 0 ? matches[0].agent : null;
}
