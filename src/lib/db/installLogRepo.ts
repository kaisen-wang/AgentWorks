/**
 * 安装日志数据访问层
 */

import Database from 'better-sqlite3';
import type { AgentId, InstallLog } from '@/types';

export class InstallLogRepo {
  constructor(private db: Database.Database) {}

  /**
   * 创建安装日志
   */
  create(log: InstallLog): void {
    const stmt = this.db.prepare(`
      INSERT INTO installation_logs (
        install_id, resource_type, resource_id, agent_id,
        source_url, scope, status, step, error_message,
        error_details, duration_ms, created_at, updated_at
      ) VALUES (
        @installId, @resourceType, @resourceId, @agentId,
        @sourceUrl, @scope, @status, @step, @errorMessage,
        @errorDetails, @durationMs, @createdAt, @updatedAt
      )
    `);
    stmt.run({
      installId: log.installId,
      resourceType: log.resourceType,
      resourceId: log.resourceId,
      agentId: log.agentId,
      sourceUrl: log.sourceUrl,
      scope: log.scope,
      status: log.status,
      step: log.step,
      errorMessage: log.errorMessage ?? null,
      errorDetails: log.errorDetails ?? null,
      durationMs: log.durationMs,
      createdAt: log.createdAt,
      updatedAt: log.updatedAt,
    });
  }

  /**
   * 更新安装日志
   */
  update(installId: string, updates: Partial<InstallLog>): void {
    const fields: string[] = [];
    const values: Record<string, unknown> = { installId };

    if (updates.resourceId !== undefined) {
      fields.push('resource_id = @resourceId');
      values.resourceId = updates.resourceId;
    }
    if (updates.status !== undefined) {
      fields.push('status = @status');
      values.status = updates.status;
    }
    if (updates.step !== undefined) {
      fields.push('step = @step');
      values.step = updates.step;
    }
    if (updates.errorMessage !== undefined) {
      fields.push('error_message = @errorMessage');
      values.errorMessage = updates.errorMessage;
    }
    if (updates.errorDetails !== undefined) {
      fields.push('error_details = @errorDetails');
      values.errorDetails = updates.errorDetails;
    }
    if (updates.durationMs !== undefined) {
      fields.push('duration_ms = @durationMs');
      values.durationMs = updates.durationMs;
    }

    fields.push('updated_at = @updatedAt');
    values.updatedAt = updates.updatedAt ?? Date.now();

    if (fields.length === 0) return;

    const stmt = this.db.prepare(
      `UPDATE installation_logs SET ${fields.join(', ')} WHERE install_id = @installId`
    );
    stmt.run(values);
  }

  /**
   * 根据 ID 查找安装日志
   */
  findById(installId: string): InstallLog | undefined {
    const stmt = this.db.prepare('SELECT * FROM installation_logs WHERE install_id = ?');
    const row = stmt.get(installId) as Record<string, unknown> | undefined;
    return row ? this.mapRowToLog(row) : undefined;
  }

  /**
   * 查询 Agent 的安装历史
   */
  findByAgent(agentId: AgentId, limit: number = 50): InstallLog[] {
    const stmt = this.db.prepare(
      'SELECT * FROM installation_logs WHERE agent_id = ? ORDER BY created_at DESC LIMIT ?'
    );
    const rows = stmt.all(agentId, limit) as Record<string, unknown>[];
    return rows.map(row => this.mapRowToLog(row));
  }

  /**
   * 查询进行中的安装
   */
  findInProgress(): InstallLog[] {
    const stmt = this.db.prepare(
      "SELECT * FROM installation_logs WHERE status = 'in_progress' ORDER BY created_at DESC"
    );
    const rows = stmt.all() as Record<string, unknown>[];
    return rows.map(row => this.mapRowToLog(row));
  }

  /**
   * 映射数据库行到 InstallLog 对象
   */
  private mapRowToLog(row: Record<string, unknown>): InstallLog {
    return {
      installId: row.install_id as string,
      resourceType: row.resource_type as 'skill' | 'tool',
      resourceId: row.resource_id as string,
      agentId: row.agent_id as AgentId,
      sourceUrl: row.source_url as string,
      scope: row.scope as 'global' | 'private',
      status: row.status as 'in_progress' | 'completed' | 'failed' | 'rolled_back',
      step: row.step as string,
      errorMessage: (row.error_message as string) ?? undefined,
      errorDetails: (row.error_details as string) ?? undefined,
      durationMs: row.duration_ms as number,
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
    };
  }
}
