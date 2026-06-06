/**
 * CapabilityMatcher 服务端扩展
 *
 * ⚠️ 仅限服务端使用。直接访问数据库获取 skills 能力标签。
 * 客户端请使用 CapabilityMatcher.ts 中的 matchCapabilitiesFromList() + fetch("/api/skills")。
 */

import type { AgentCapability } from "@/types";
import { matchCapabilitiesFromList } from "./CapabilityMatcher";
import { getDb } from "@/lib/db/database";
import { SkillRepo } from "@/lib/db/skillRepo";

/**
 * 从数据库 skills 表加载所有 active 的 skill，转换为 AgentCapability[]
 */
export function getSkillCapabilitiesFromDB(): AgentCapability[] {
  const db = getDb();
  const skillRepo = new SkillRepo(db);
  const allSkills = skillRepo.findAll().filter(s => s.status === 'active');

  return allSkills.map(s => ({
    name: s.name,
    description: s.description || `Skill: ${s.name}`,
    tools: s.tags ? JSON.parse(s.tags) : [],
  }));
}

/**
 * 获取所有可用能力标签（全部来自 skills 表）
 */
export function getAllCapabilities(): AgentCapability[] {
  return getSkillCapabilitiesFromDB();
}

/**
 * 从任务描述中提取匹配的能力标签（服务端版本，直接读数据库）
 */
export function matchCapabilitiesFromTask(taskDescription: string): string[] {
  const allCaps = getSkillCapabilitiesFromDB();
  return matchCapabilitiesFromList(taskDescription, allCaps);
}
