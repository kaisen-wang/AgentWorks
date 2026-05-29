'use server';

/**
 * Agent Server Actions
 * 所有Agent操作都在服务器端执行
 */

import { getDb } from '@/lib/db/database';
import { initializeDatabase } from '@/lib/db/init';
import { AgentRepository } from '@/lib/db/agentRepo';
import { v4 as uuidv4 } from 'uuid';
import type { Agent, AgentCapability, AgentConfig, AgentRole } from '@/types';

const defaultAgentConfig = (): AgentConfig => ({
  model: "deepseek-v4-flash",
  temperature: 0.7,
  timeout: 30000,
  maxRetries: 3,
  decisionThreshold: 5,
  monthlyBudget: 10,
  budgetUsed: 0,
  budgetAlertThreshold: 0.9,
});

/**
 * 获取所有Agents
 */
export async function getAgents(): Promise<{ agents: Agent[]; error?: string }> {
  try {
    initializeDatabase();
    const db = getDb();
    const repo = new AgentRepository(db);
    const agents = repo.findAll();
    return { agents };
  } catch (error) {
    console.error("获取Agents失败:", error);
    return { agents: [], error: "数据库错误" };
  }
}

/**
 * 创建Agent
 */
export async function createAgent(data: {
  name: string;
  role: AgentRole;
  parentId?: string | null;
  capabilities?: AgentCapability[];
  config?: Partial<AgentConfig>;
  description?: string;
}): Promise<{ agent?: Agent; error?: string }> {
  try {
    initializeDatabase();
    const db = getDb();
    const repo = new AgentRepository(db);

    // 检查管理幅度
    if (data.parentId) {
      const children = repo.findByParentId(data.parentId);
      if (children.length >= 5) {
        return { error: `上级Agent的管理幅度已达上限 (${children.length}/5)` };
      }
    }

    const id = uuidv4();
    const now = Date.now();
    const avatarMap: Record<string, string> = {
      supervisor: "supervisor",
      specialist: "specialist",
      general: "bot",
    };

    const agent: Agent = {
      id,
      name: data.name,
      description: data.description || "",
      role: data.role,
      parentId: data.parentId || null,
      childIds: [],
      maxChildren: 5,
      spanExemption: false,
      capabilities: data.capabilities || [],
      config: { ...defaultAgentConfig(), ...data.config },
      status: "idle",
      avatar: avatarMap[data.role] || "bot",
      createdAt: now,
      updatedAt: now,
    };

    repo.create(agent);
    return { agent };
  } catch (error) {
    console.error("创建Agent失败:", error);
    return { error: "创建失败" };
  }
}

/**
 * 更新Agent
 */
export async function updateAgent(data: {
  id: string;
  updates: Partial<Agent>;
}): Promise<{ agent?: Agent; error?: string }> {
  try {
    initializeDatabase();
    const db = getDb();
    const repo = new AgentRepository(db);
    const existing = repo.findById(data.id);

    if (!existing) {
      return { error: "Agent不存在" };
    }

    const updated = {
      ...existing,
      ...data.updates,
      updatedAt: Date.now(),
    };

    repo.update(updated);
    return { agent: updated };
  } catch (error) {
    console.error("更新Agent失败:", error);
    return { error: "更新失败" };
  }
}

/**
 * 删除Agent
 */
export async function deleteAgent(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    initializeDatabase();
    const db = getDb();
    const repo = new AgentRepository(db);
    repo.delete(id);
    return { success: true };
  } catch (error) {
    console.error("删除Agent失败:", error);
    return { success: false, error: "删除失败" };
  }
}
