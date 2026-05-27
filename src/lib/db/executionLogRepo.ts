/**
 * 执行日志数据访问层
 */

import Database from 'better-sqlite3';
import type { AgentId } from '@/types';
import type { ExecutionLogRecord } from '@/lib/skills/types';

export class ExecutionLogRepo {
  constructor(private db: Database.Database) {}

  /**
   * 插入执行日志
   */
  insert(log: ExecutionLogRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO execution_logs (
        id, resource_type, resource_id, agent_id, action,
        input, output, success, error, duration, timestamp
      ) VALUES (
        @id, @resourceType, @resourceId, @agentId, @action,
        @input, @output, @success, @error, @duration, @timestamp
      )
    `);
    stmt.run(log);
  }

  /**
   * 根据 Agent ID 查找执行日志
   */
  findByAgent(agentId: AgentId, limit: number = 100): ExecutionLogRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM execution_logs
      WHERE agent_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    const rows = stmt.all(agentId, limit) as any[];
    return rows.map(row => this.mapRowToRecord(row));
  }

  /**
   * 根据资源查找执行日志
   */
  findByResource(
    resourceType: 'skill' | 'tool',
    resourceId: string,
    limit: number = 100
  ): ExecutionLogRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM execution_logs
      WHERE resource_type = ? AND resource_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    const rows = stmt.all(resourceType, resourceId, limit) as any[];
    return rows.map(row => this.mapRowToRecord(row));
  }

  /**
   * 清理旧日志
   */
  cleanOldLogs(beforeTimestamp: number): number {
    const stmt = this.db.prepare('DELETE FROM execution_logs WHERE timestamp < ?');
    const result = stmt.run(beforeTimestamp);
    return result.changes;
  }

  /**
   * 映射数据库行到记录对象
   */
  private mapRowToRecord(row: any): ExecutionLogRecord {
    return {
      id: row.id,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      agentId: row.agent_id,
      action: row.action,
      input: row.input,
      output: row.output,
      success: row.success === 1,
      error: row.error,
      duration: row.duration,
      timestamp: row.timestamp,
    };
  }
}
