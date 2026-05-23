/**
 * SQLite 数据库初始化与 Schema 管理（Task 2）
 *
 * 使用 better-sqlite3 实现，所有表结构按 design.md 定义。
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "agentworks.db");

let db: Database.Database | null = null;

/** 获取数据库实例（单例） */
export function getDb(): Database.Database {
  if (db) return db;

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  initializeSchema(db);
  return db;
}

/** 关闭数据库连接 */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/** 初始化 Schema */
function initializeSchema(db: Database.Database): void {
  db.exec(`
    -- agents 表
    CREATE TABLE IF NOT EXISTS agents (
      agent_id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      model TEXT NOT NULL,
      parent_id TEXT,
      path TEXT NOT NULL DEFAULT '/',
      span_of_control_limit INTEGER NOT NULL DEFAULT 5,
      span_exemption INTEGER NOT NULL DEFAULT 0,
      span_exemption_reason TEXT,
      capability_tags TEXT NOT NULL DEFAULT '[]',
      monthly_budget REAL,
      budget_used REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'idle',
      avatar_url TEXT NOT NULL DEFAULT 'bot',
      config TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    -- projects 表
    CREATE TABLE IF NOT EXISTS projects (
      project_id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      created_at INTEGER NOT NULL
    );

    -- tasks 表
    CREATE TABLE IF NOT EXISTS tasks (
      task_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      assignee_id TEXT NOT NULL,
      parent_task_id TEXT,
      project_id TEXT,
      priority TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'pending',
      timeout_seconds INTEGER NOT NULL DEFAULT 30,
      retry_count INTEGER NOT NULL DEFAULT 0,
      checkpoint TEXT,
      chat_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      completed_at INTEGER
    );

    -- reports 表
    CREATE TABLE IF NOT EXISTS reports (
      report_id TEXT PRIMARY KEY,
      reporter_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      problem_description TEXT NOT NULL,
      attempted_solutions TEXT NOT NULL DEFAULT '[]',
      decision_options TEXT NOT NULL,
      is_urgent INTEGER NOT NULL DEFAULT 0,
      is_cross_department INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      decision_result TEXT,
      created_at INTEGER NOT NULL,
      resolved_at INTEGER
    );

    -- archives 表
    CREATE TABLE IF NOT EXISTS archives (
      archive_id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      project_id TEXT,
      content TEXT NOT NULL,
      metadata TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    -- playbooks 表
    CREATE TABLE IF NOT EXISTS playbooks (
      playbook_id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      project_id TEXT,
      decomposition_rules TEXT NOT NULL,
      assignment_rules TEXT NOT NULL,
      reporting_rules TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    -- knowledge_bases 表
    CREATE TABLE IF NOT EXISTS knowledge_bases (
      kb_id TEXT PRIMARY KEY,
      scope TEXT NOT NULL,
      owner_id TEXT,
      content TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    -- audit_logs 表
    CREATE TABLE IF NOT EXISTS audit_logs (
      log_id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      details TEXT,
      created_at INTEGER NOT NULL
    );

    -- conversations 表
    CREATE TABLE IF NOT EXISTS conversations (
      conversation_id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      project_id TEXT,
      members TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    -- messages 表
    CREATE TABLE IF NOT EXISTS messages (
      message_id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      sender_type TEXT NOT NULL,
      message_type TEXT NOT NULL,
      content TEXT NOT NULL,
      reply_to TEXT,
      is_cross_department INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    -- 索引
    CREATE INDEX IF NOT EXISTS idx_tasks_assignee_priority ON tasks(assignee_id, priority DESC, created_at ASC);
    CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id);
    CREATE INDEX IF NOT EXISTS idx_archives_project ON archives(project_id);
    CREATE INDEX IF NOT EXISTS idx_archives_agent ON archives(agent_id);
    CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at DESC);
  `);
}
