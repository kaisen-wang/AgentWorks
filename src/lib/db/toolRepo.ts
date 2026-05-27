/**
 * Tool 数据访问层
 */

import Database from 'better-sqlite3';
import type { AgentId, ToolId, ResourceScope } from '@/types';
import type { ToolRecord, IToolRepo } from '@/lib/skills/types';

export class ToolRepo implements IToolRepo {
  constructor(private db: Database.Database) {}

  /**
   * 插入 Tool 记录
   */
  insert(tool: ToolRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO tools (
        id, name, description, version, category, tags, type,
        input_schema, output_schema, scope, owner_id, config,
        endpoint, tool_name, auth_type, auth_config, timeout,
        executor_data, status, health_status, created_at, updated_at
      ) VALUES (
        @id, @name, @description, @version, @category, @tags, @type,
        @inputSchema, @outputSchema, @scope, @ownerId, @config,
        @endpoint, @toolName, @authType, @authConfig, @timeout,
        @executorData, @status, @healthStatus, @createdAt, @updatedAt
      )
    `);
    stmt.run(tool);
  }

  /**
   * 更新 Tool 记录
   */
  update(tool: ToolRecord): void {
    const stmt = this.db.prepare(`
      UPDATE tools SET
        name = @name,
        description = @description,
        version = @version,
        category = @category,
        tags = @tags,
        type = @type,
        input_schema = @inputSchema,
        output_schema = @outputSchema,
        scope = @scope,
        owner_id = @ownerId,
        config = @config,
        endpoint = @endpoint,
        tool_name = @toolName,
        auth_type = @authType,
        auth_config = @authConfig,
        timeout = @timeout,
        executor_data = @executorData,
        status = @status,
        health_status = @healthStatus,
        updated_at = @updatedAt
      WHERE id = @id
    `);
    stmt.run(tool);
  }

  /**
   * 删除 Tool 记录
   */
  delete(id: ToolId): void {
    const stmt = this.db.prepare('DELETE FROM tools WHERE id = ?');
    stmt.run(id);
  }

  /**
   * 根据 ID 查找 Tool
   */
  findById(id: ToolId): ToolRecord | undefined {
    const stmt = this.db.prepare('SELECT * FROM tools WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.mapRowToRecord(row) : undefined;
  }

  /**
   * 查找所有 Tools
   */
  findAll(): ToolRecord[] {
    const stmt = this.db.prepare('SELECT * FROM tools');
    const rows = stmt.all() as any[];
    return rows.map(row => this.mapRowToRecord(row));
  }

  /**
   * 根据范围查找 Tools
   */
  findByScope(scope: ResourceScope): ToolRecord[] {
    const stmt = this.db.prepare('SELECT * FROM tools WHERE scope = ?');
    const rows = stmt.all(scope) as any[];
    return rows.map(row => this.mapRowToRecord(row));
  }

  /**
   * 根据所有者查找 Tools
   */
  findByOwner(ownerId: AgentId): ToolRecord[] {
    const stmt = this.db.prepare('SELECT * FROM tools WHERE owner_id = ?');
    const rows = stmt.all(ownerId) as any[];
    return rows.map(row => this.mapRowToRecord(row));
  }

  /**
   * 映射数据库行到记录对象
   */
  private mapRowToRecord(row: any): ToolRecord {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      version: row.version,
      category: row.category,
      tags: row.tags,
      type: row.type,
      inputSchema: row.input_schema,
      outputSchema: row.output_schema,
      scope: row.scope,
      ownerId: row.owner_id,
      config: row.config,
      endpoint: row.endpoint,
      toolName: row.tool_name,
      authType: row.auth_type,
      authConfig: row.auth_config,
      timeout: row.timeout,
      executorData: row.executor_data,
      status: row.status,
      healthStatus: row.health_status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
