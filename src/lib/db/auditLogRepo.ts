/**
 * 数据访问层 - AuditLog（Task 3 + Task 33）
 *
 * 审计日志不可篡改（仅追加），使用 SHA-256 哈希。
 */

import { getDb } from "./database";
import { createHash } from "crypto";

export interface AuditLogRow {
  log_id: string;
  action: string;
  actor_id: string;
  target_type: string;
  target_id: string;
  content_hash: string;
  details: string | null;
  created_at: number;
}

/** 写入审计日志（仅追加，不可修改/删除） */
export function addAuditLog(row: {
  logId: string;
  action: string;
  actorId: string;
  targetType: string;
  targetId: string;
  content: string;
  details?: Record<string, unknown>;
}): void {
  const db = getDb();
  const contentHash = createHash("sha256").update(row.content).digest("hex");
  db.prepare(`
    INSERT INTO audit_logs (log_id, action, actor_id, target_type, target_id, content_hash, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    row.logId, row.action, row.actorId, row.targetType, row.targetId,
    contentHash, row.details ? JSON.stringify(row.details) : null, Date.now()
  );
}

/** 查询审计日志（按时间倒序） */
export function getAuditLogs(options?: {
  actorId?: string;
  action?: string;
  since?: number;
  limit?: number;
}): AuditLogRow[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options?.actorId) {
    conditions.push("actor_id = ?");
    params.push(options.actorId);
  }
  if (options?.action) {
    conditions.push("action = ?");
    params.push(options.action);
  }
  if (options?.since) {
    conditions.push("created_at >= ?");
    params.push(options.since);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = options?.limit ?? 100;

  return db.prepare(
    `SELECT * FROM audit_logs ${where} ORDER BY created_at DESC LIMIT ?`
  ).all(...params, limit) as AuditLogRow[];
}

/** 清理 30 天前的审计日志 */
export function purgeOldAuditLogs(): number {
  const db = getDb();
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const result = db.prepare("DELETE FROM audit_logs WHERE created_at < ?").run(cutoff);
  return result.changes;
}
