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
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'specialist',
      description TEXT,
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
      name TEXT NOT NULL,
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
      name TEXT NOT NULL,
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

    -- Skills 表
    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      version TEXT NOT NULL,
      author TEXT,
      tags TEXT,
      category TEXT,
      input_schema TEXT NOT NULL,
      output_schema TEXT NOT NULL,
      dependencies TEXT NOT NULL,
      scope TEXT NOT NULL CHECK(scope IN ('global', 'private')),
      owner_id TEXT,
      config TEXT,
      executor_type TEXT NOT NULL,
      executor_data TEXT,
      status TEXT NOT NULL,
      health_status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    -- Tools 表
    CREATE TABLE IF NOT EXISTS tools (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      version TEXT NOT NULL,
      category TEXT,
      tags TEXT,
      type TEXT NOT NULL CHECK(type IN ('mcp', 'custom')),
      input_schema TEXT NOT NULL,
      output_schema TEXT NOT NULL,
      scope TEXT NOT NULL CHECK(scope IN ('global', 'private')),
      owner_id TEXT,
      config TEXT,
      endpoint TEXT,
      tool_name TEXT,
      auth_type TEXT,
      auth_config TEXT,
      timeout INTEGER,
      executor_data TEXT,
      status TEXT NOT NULL,
      health_status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    -- Agent-Skill 绑定表
    CREATE TABLE IF NOT EXISTS agent_skill_bindings (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      skill_id TEXT NOT NULL,
      auto_discover INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      UNIQUE(agent_id, skill_id)
    );

    -- Agent-Tool 绑定表
    CREATE TABLE IF NOT EXISTS agent_tool_bindings (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      tool_id TEXT NOT NULL,
      auto_discover INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      UNIQUE(agent_id, tool_id)
    );

    -- 执行日志表
    CREATE TABLE IF NOT EXISTS execution_logs (
      id TEXT PRIMARY KEY,
      resource_type TEXT NOT NULL CHECK(resource_type IN ('skill', 'tool')),
      resource_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      action TEXT NOT NULL,
      input TEXT,
      output TEXT,
      success INTEGER NOT NULL,
      error TEXT,
      duration INTEGER NOT NULL,
      timestamp INTEGER NOT NULL
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
    CREATE INDEX IF NOT EXISTS idx_skills_scope ON skills(scope);
    CREATE INDEX IF NOT EXISTS idx_skills_owner ON skills(owner_id);
    CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category);
    CREATE INDEX IF NOT EXISTS idx_tools_scope ON tools(scope);
    CREATE INDEX IF NOT EXISTS idx_tools_owner ON tools(owner_id);
    CREATE INDEX IF NOT EXISTS idx_tools_type ON tools(type);
    CREATE INDEX IF NOT EXISTS idx_agent_skill_bindings_agent ON agent_skill_bindings(agent_id);
    CREATE INDEX IF NOT EXISTS idx_agent_skill_bindings_skill ON agent_skill_bindings(skill_id);
    CREATE INDEX IF NOT EXISTS idx_agent_tool_bindings_agent ON agent_tool_bindings(agent_id);
    CREATE INDEX IF NOT EXISTS idx_agent_tool_bindings_tool ON agent_tool_bindings(tool_id);
    CREATE INDEX IF NOT EXISTS idx_execution_logs_resource ON execution_logs(resource_type, resource_id);
    CREATE INDEX IF NOT EXISTS idx_execution_logs_agent ON execution_logs(agent_id);
    CREATE INDEX IF NOT EXISTS idx_execution_logs_timestamp ON execution_logs(timestamp DESC);
  `);

}
