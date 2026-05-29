/**
 * Agent 数据访问层
 */

import Database from 'better-sqlite3';
import type { AgentId, Agent, AgentCapability, AgentConfig } from '@/types';

/** Agent 数据库记录 */
export interface AgentRecord {
  agent_id: string;
  name: string;
  role: string;
  description: string | null;
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

/** AgentRepository 接口 */
export interface IAgentRepository {
  findAll(): Agent[];
  findById(id: AgentId): Agent | undefined;
  findByParentId(parentId: AgentId): Agent[];
  create(agent: Agent): void;
  update(agent: Agent): void;
  delete(id: AgentId): void;
}

export class AgentRepository implements IAgentRepository {
  constructor(private db: Database.Database) {}

  /**
   * 查找所有 Agents
   */
  findAll(): Agent[] {
    const stmt = this.db.prepare('SELECT * FROM agents');
    const rows = stmt.all() as AgentRecord[];
    return rows.map(row => this.mapRowToAgent(row));
  }

  /**
   * 根据 ID 查找 Agent
   */
  findById(id: AgentId): Agent | undefined {
    const stmt = this.db.prepare('SELECT * FROM agents WHERE agent_id = ?');
    const row = stmt.get(id) as AgentRecord | undefined;
    return row ? this.mapRowToAgent(row) : undefined;
  }

  /**
   * 根据父ID查找 Agents
   */
  findByParentId(parentId: AgentId): Agent[] {
    const stmt = this.db.prepare('SELECT * FROM agents WHERE parent_id = ?');
    const rows = stmt.all(parentId) as AgentRecord[];
    return rows.map(row => this.mapRowToAgent(row));
  }

  /**
   * 创建 Agent
   */
  create(agent: Agent): void {
    const stmt = this.db.prepare(`
      INSERT INTO agents (
        agent_id, name, role, description, model, parent_id, path,
        span_of_control_limit, span_exemption, span_exemption_reason,
        capability_tags, monthly_budget, budget_used, status, avatar_url,
        config, created_at, updated_at
      ) VALUES (
        @agentId, @name, @role, @description, @model, @parentId, @path,
        @spanOfControlLimit, @spanExemption, @spanExemptionReason,
        @capabilityTags, @monthlyBudget, @budgetUsed, @status, @avatarUrl,
        @config, @createdAt, @updatedAt
      )
    `);

    const record = this.mapAgentToRecord(agent);
    stmt.run(record);
  }

  /**
   * 更新 Agent
   */
  update(agent: Agent): void {
    const stmt = this.db.prepare(`
      UPDATE agents SET
        name = @name,
        role = @role,
        description = @description,
        model = @model,
        parent_id = @parentId,
        path = @path,
        span_of_control_limit = @spanOfControlLimit,
        span_exemption = @spanExemption,
        span_exemption_reason = @spanExemptionReason,
        capability_tags = @capabilityTags,
        monthly_budget = @monthlyBudget,
        budget_used = @budgetUsed,
        status = @status,
        avatar_url = @avatarUrl,
        config = @config,
        updated_at = @updatedAt
      WHERE agent_id = @agentId
    `);

    const record = this.mapAgentToRecord(agent);
    stmt.run(record);
  }

  /**
   * 删除 Agent（自动转移任务给上级）
   */
  delete(id: AgentId): void {
    const agent = this.findById(id);
    if (!agent) return;

    // 使用事务确保原子性
    const deleteAgent = this.db.transaction(() => {
      // 1. 如果有上级，将下属转移给上级
      if (agent.parentId) {
        const children = this.findByParentId(id);
        for (const child of children) {
          const updatedChild = { ...child, parentId: agent.parentId };
          this.update(updatedChild);
        }
      }

      // 2. 将该Agent的任务转移给上级
      if (agent.parentId) {
        const taskStmt = this.db.prepare(`
          UPDATE tasks SET assignee_id = ? WHERE assignee_id = ?
        `);
        taskStmt.run(agent.parentId, id);
      }

      // 3. 删除Agent
      const stmt = this.db.prepare('DELETE FROM agents WHERE agent_id = ?');
      stmt.run(id);
    });

    deleteAgent();
  }

  /**
   * 映射数据库行到 Agent 对象
   */
  private mapRowToAgent(row: AgentRecord): Agent {
    const capabilities: AgentCapability[] = JSON.parse(row.capability_tags || '[]');
    const config: AgentConfig = JSON.parse(row.config || '{}');

    // 查找子节点
    const childIds = this.findByParentId(row.agent_id).map(a => a.id);

    return {
      id: row.agent_id,
      name: row.name,
      description: row.description || '',
      role: row.role as any,
      parentId: row.parent_id,
      childIds,
      maxChildren: row.span_of_control_limit,
      spanExemption: row.span_exemption === 1,
      spanExemptionReason: row.span_exemption_reason || undefined,
      capabilities,
      config,
      status: row.status as any,
      avatar: row.avatar_url,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * 映射 Agent 对象到数据库记录
   */
  private mapAgentToRecord(agent: Agent): any {
    return {
      agentId: agent.id,
      name: agent.name,
      role: agent.role,
      description: agent.description || null,
      model: agent.config.model,
      parentId: agent.parentId || null,
      path: this.calculatePath(agent),
      spanOfControlLimit: agent.maxChildren,
      spanExemption: agent.spanExemption ? 1 : 0,
      spanExemptionReason: agent.spanExemptionReason || null,
      capabilityTags: JSON.stringify(agent.capabilities),
      monthlyBudget: agent.config.monthlyBudget || null,
      budgetUsed: agent.config.budgetUsed || 0,
      status: agent.status,
      avatarUrl: agent.avatar,
      config: JSON.stringify(agent.config),
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
    };
  }

  /**
   * 计算 Agent 路径
   */
  private calculatePath(agent: Agent): string {
    if (!agent.parentId) return '/';
    const parent = this.findById(agent.parentId);
    if (!parent) return '/';
    return `${parent.id}/`;
  }
}
