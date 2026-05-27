/**
 * Skill 数据访问层
 */

import Database from 'better-sqlite3';
import type { AgentId, SkillId, ResourceScope } from '@/types';
import type { SkillRecord, ISkillRepo } from '@/lib/skills/types';

export class SkillRepo implements ISkillRepo {
  constructor(private db: Database.Database) {}

  /**
   * 插入 Skill 记录
   */
  insert(skill: SkillRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO skills (
        id, name, description, version, author, tags, category,
        input_schema, output_schema, dependencies, scope, owner_id,
        config, executor_type, executor_data, status, health_status,
        created_at, updated_at
      ) VALUES (
        @id, @name, @description, @version, @author, @tags, @category,
        @inputSchema, @outputSchema, @dependencies, @scope, @ownerId,
        @config, @executorType, @executorData, @status, @healthStatus,
        @createdAt, @updatedAt
      )
    `);
    stmt.run(skill);
  }

  /**
   * 更新 Skill 记录
   */
  update(skill: SkillRecord): void {
    const stmt = this.db.prepare(`
      UPDATE skills SET
        name = @name,
        description = @description,
        version = @version,
        author = @author,
        tags = @tags,
        category = @category,
        input_schema = @inputSchema,
        output_schema = @outputSchema,
        dependencies = @dependencies,
        scope = @scope,
        owner_id = @ownerId,
        config = @config,
        executor_type = @executorType,
        executor_data = @executorData,
        status = @status,
        health_status = @healthStatus,
        updated_at = @updatedAt
      WHERE id = @id
    `);
    stmt.run(skill);
  }

  /**
   * 删除 Skill 记录
   */
  delete(id: SkillId): void {
    const stmt = this.db.prepare('DELETE FROM skills WHERE id = ?');
    stmt.run(id);
  }

  /**
   * 根据 ID 查找 Skill
   */
  findById(id: SkillId): SkillRecord | undefined {
    const stmt = this.db.prepare('SELECT * FROM skills WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.mapRowToRecord(row) : undefined;
  }

  /**
   * 查找所有 Skills
   */
  findAll(): SkillRecord[] {
    const stmt = this.db.prepare('SELECT * FROM skills');
    const rows = stmt.all() as any[];
    return rows.map(row => this.mapRowToRecord(row));
  }

  /**
   * 根据范围查找 Skills
   */
  findByScope(scope: ResourceScope): SkillRecord[] {
    const stmt = this.db.prepare('SELECT * FROM skills WHERE scope = ?');
    const rows = stmt.all(scope) as any[];
    return rows.map(row => this.mapRowToRecord(row));
  }

  /**
   * 根据所有者查找 Skills
   */
  findByOwner(ownerId: AgentId): SkillRecord[] {
    const stmt = this.db.prepare('SELECT * FROM skills WHERE owner_id = ?');
    const rows = stmt.all(ownerId) as any[];
    return rows.map(row => this.mapRowToRecord(row));
  }

  /**
   * 映射数据库行到记录对象
   */
  private mapRowToRecord(row: any): SkillRecord {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      version: row.version,
      author: row.author,
      tags: row.tags,
      category: row.category,
      inputSchema: row.input_schema,
      outputSchema: row.output_schema,
      dependencies: row.dependencies,
      scope: row.scope,
      ownerId: row.owner_id,
      config: row.config,
      executorType: row.executor_type,
      executorData: row.executor_data,
      status: row.status,
      healthStatus: row.health_status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
