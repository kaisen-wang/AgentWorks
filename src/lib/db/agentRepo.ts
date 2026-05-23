/**
 * 数据访问层 - Agent CRUD（Task 3 + Task 4）
 */

import { getDb } from "./database";
import type { AgentId, AgentRole, ActionStatus, AgentCapability, AgentConfig } from "@/types";

export interface AgentRow {
  agent_id: string;
  name: string;
  model: string;
  parent_id: string | null;
  path: string;
  span_of_control_limit: number;
  span_exemption: number;
  span_exemption_reason: string | null;
  capability_tags: string;
  monthly_budget: number | null;
  budget_used: number;
  status: string;
  avatar_url: string;
  config: string;
  created_at: number;
  updated_at: number;
}

/** 创建 Agent */
export function createAgent(row: {
  agentId: string;
  name: string;
  model: string;
  parentId: string | null;
  path: string;
  spanOfControlLimit?: number;
  capabilityTags?: AgentCapability[];
  monthlyBudget?: number;
  status?: string;
  avatarUrl?: string;
  config?: Partial<AgentConfig>;
}): void {
  const db = getDb();
  const now = Date.now();
  db.prepare(`
    INSERT INTO agents (agent_id, name, model, parent_id, path, span_of_control_limit,
      capability_tags, monthly_budget, status, avatar_url, config, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    row.agentId, row.name, row.model, row.parentId, row.path,
    row.spanOfControlLimit ?? 5,
    JSON.stringify(row.capabilityTags ?? []),
    row.monthlyBudget ?? null,
    row.status ?? "idle",
    row.avatarUrl ?? "bot",
    JSON.stringify(row.config ?? {}),
    now, now
  );
}

/** 查询 Agent by ID */
export function getAgentById(agentId: string): AgentRow | null {
  const db = getDb();
  return db.prepare("SELECT * FROM agents WHERE agent_id = ?").get(agentId) as AgentRow | null;
}

/** 查询所有 Agent */
export function getAllAgents(): AgentRow[] {
  const db = getDb();
  return db.prepare("SELECT * FROM agents ORDER BY created_at ASC").all() as AgentRow[];
}

/** 查询直接下属 */
export function getSubordinates(parentId: string): AgentRow[] {
  const db = getDb();
  return db.prepare("SELECT * FROM agents WHERE parent_id = ? ORDER BY created_at ASC").all(parentId) as AgentRow[];
}

/** 查询下属数量 */
export function getSubordinateCount(parentId: string): number {
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) as count FROM agents WHERE parent_id = ?").get(parentId) as { count: number };
  return row.count;
}

/** 更新 Agent */
export function updateAgent(agentId: string, updates: Partial<{
  name: string;
  model: string;
  parent_id: string | null;
  path: string;
  span_of_control_limit: number;
  span_exemption: number;
  span_exemption_reason: string | null;
  capability_tags: string;
  monthly_budget: number | null;
  budget_used: number;
  status: string;
  avatar_url: string;
  config: string;
}>): void {
  const db = getDb();
  const fields = Object.keys(updates);
  if (fields.length === 0) return;
  const setClause = fields.map((f) => `${f} = ?`).join(", ");
  const values = [...Object.values(updates), Date.now(), agentId];
  db.prepare(`UPDATE agents SET ${setClause}, updated_at = ? WHERE agent_id = ?`).run(...values);
}

/** 删除 Agent */
export function deleteAgent(agentId: string): void {
  const db = getDb();
  db.prepare("DELETE FROM agents WHERE agent_id = ?").run(agentId);
}

/** 沿 parentId 向上遍历，检测循环引用 */
export function detectCycle(agentId: string, targetParentId: string): boolean {
  const db = getDb();
  let currentId: string | null = targetParentId;
  const visited = new Set<string>();
  while (currentId) {
    if (currentId === agentId) return true;
    if (visited.has(currentId)) return true;
    visited.add(currentId);
    const row = db.prepare("SELECT parent_id FROM agents WHERE agent_id = ?").get(currentId) as { parent_id: string | null } | null;
    currentId = row?.parent_id ?? null;
  }
  return false;
}
