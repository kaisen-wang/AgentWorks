/**
 * Agent-Skill/Tool 绑定数据访问层
 */

import Database from 'better-sqlite3';
import type { AgentId, SkillId, ToolId } from '@/types';
import type { AgentSkillBindingRecord, AgentToolBindingRecord } from '@/lib/skills/types';

export class AgentSkillBindingRepo {
  constructor(private db: Database.Database) {}

  /**
   * 绑定 Agent 和 Skill
   */
  bind(binding: AgentSkillBindingRecord): void {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO agent_skill_bindings (
        id, agent_id, skill_id, auto_discover, created_at
      ) VALUES (
        @id, @agentId, @skillId, @autoDiscover, @createdAt
      )
    `);
    stmt.run(binding);
  }

  /**
   * 解绑 Agent 和 Skill
   */
  unbind(agentId: AgentId, skillId: SkillId): void {
    const stmt = this.db.prepare(`
      DELETE FROM agent_skill_bindings
      WHERE agent_id = ? AND skill_id = ?
    `);
    stmt.run(agentId, skillId);
  }

  /**
   * 根据 Agent 查找绑定
   */
  findByAgent(agentId: AgentId): AgentSkillBindingRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM agent_skill_bindings WHERE agent_id = ?
    `);
    const rows = stmt.all(agentId) as any[];
    return rows.map(row => this.mapRowToRecord(row));
  }

  /**
   * 根据 Skill 查找绑定
   */
  findBySkill(skillId: SkillId): AgentSkillBindingRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM agent_skill_bindings WHERE skill_id = ?
    `);
    const rows = stmt.all(skillId) as any[];
    return rows.map(row => this.mapRowToRecord(row));
  }

  /**
   * 映射数据库行到记录对象
   */
  private mapRowToRecord(row: any): AgentSkillBindingRecord {
    return {
      id: row.id,
      agentId: row.agent_id,
      skillId: row.skill_id,
      autoDiscover: row.auto_discover === 1,
      createdAt: row.created_at,
    };
  }
}

export class AgentToolBindingRepo {
  constructor(private db: Database.Database) {}

  /**
   * 绑定 Agent 和 Tool
   */
  bind(binding: AgentToolBindingRecord): void {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO agent_tool_bindings (
        id, agent_id, tool_id, auto_discover, created_at
      ) VALUES (
        @id, @agentId, @toolId, @autoDiscover, @createdAt
      )
    `);
    stmt.run(binding);
  }

  /**
   * 解绑 Agent 和 Tool
   */
  unbind(agentId: AgentId, toolId: ToolId): void {
    const stmt = this.db.prepare(`
      DELETE FROM agent_tool_bindings
      WHERE agent_id = ? AND tool_id = ?
    `);
    stmt.run(agentId, toolId);
  }

  /**
   * 根据 Agent 查找绑定
   */
  findByAgent(agentId: AgentId): AgentToolBindingRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM agent_tool_bindings WHERE agent_id = ?
    `);
    const rows = stmt.all(agentId) as any[];
    return rows.map(row => this.mapRowToRecord(row));
  }

  /**
   * 根据 Tool 查找绑定
   */
  findByTool(toolId: ToolId): AgentToolBindingRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM agent_tool_bindings WHERE tool_id = ?
    `);
    const rows = stmt.all(toolId) as any[];
    return rows.map(row => this.mapRowToRecord(row));
  }

  /**
   * 映射数据库行到记录对象
   */
  private mapRowToRecord(row: any): AgentToolBindingRecord {
    return {
      id: row.id,
      agentId: row.agent_id,
      toolId: row.tool_id,
      autoDiscover: row.auto_discover === 1,
      createdAt: row.created_at,
    };
  }
}
