/**
 * 数据访问层 - Task CRUD（Task 3 + Task 11）
 */

import { getDb } from "./database";

export interface TaskRow {
  task_id: string;
  title: string;
  description: string;
  assignee_id: string;
  parent_task_id: string | null;
  project_id: string | null;
  priority: string;
  status: string;
  timeout_seconds: number;
  retry_count: number;
  checkpoint: string | null;
  chat_id: string | null;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
}

/** 创建任务 */
export function createTask(row: {
  taskId: string;
  title: string;
  description: string;
  assigneeId: string;
  parentTaskId?: string | null;
  projectId?: string | null;
  priority?: string;
  chatId?: string | null;
}): void {
  const db = getDb();
  const now = Date.now();
  db.prepare(`
    INSERT INTO tasks (task_id, title, description, assignee_id, parent_task_id,
      project_id, priority, status, chat_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
  `).run(
    row.taskId, row.title, row.description, row.assigneeId,
    row.parentTaskId ?? null, row.projectId ?? null,
    row.priority ?? "medium", row.chatId ?? null, now, now
  );
}

/** 查询任务 by ID */
export function getTaskById(taskId: string): TaskRow | null {
  const db = getDb();
  return db.prepare("SELECT * FROM tasks WHERE task_id = ?").get(taskId) as TaskRow | null;
}

/** 查询 Agent 的任务队列（按优先级排序） */
export function getTasksByAssignee(assigneeId: string, projectId?: string | null): TaskRow[] {
  const db = getDb();
  if (projectId) {
    return db.prepare(
      "SELECT * FROM tasks WHERE assignee_id = ? AND project_id = ? ORDER BY priority DESC, created_at ASC"
    ).all(assigneeId, projectId) as TaskRow[];
  }
  return db.prepare(
    "SELECT * FROM tasks WHERE assignee_id = ? ORDER BY priority DESC, created_at ASC"
  ).all(assigneeId) as TaskRow[];
}

/** 查询子任务 */
export function getSubTasks(parentTaskId: string): TaskRow[] {
  const db = getDb();
  return db.prepare("SELECT * FROM tasks WHERE parent_task_id = ? ORDER BY created_at ASC").all(parentTaskId) as TaskRow[];
}

/** 更新任务状态 */
export function updateTaskStatus(taskId: string, status: string, completedAt?: number): void {
  const db = getDb();
  db.prepare("UPDATE tasks SET status = ?, updated_at = ?, completed_at = ? WHERE task_id = ?")
    .run(status, Date.now(), completedAt ?? null, taskId);
}

/** 更新任务优先级 */
export function updateTaskPriority(taskId: string, priority: string): void {
  const db = getDb();
  db.prepare("UPDATE tasks SET priority = ?, updated_at = ? WHERE task_id = ?").run(priority, Date.now(), taskId);
}

/** 重分配任务 */
export function reassignTask(taskId: string, newAssigneeId: string): void {
  const db = getDb();
  db.prepare("UPDATE tasks SET assignee_id = ?, updated_at = ? WHERE task_id = ?").run(newAssigneeId, Date.now(), taskId);
}

/** 保存 checkpoint（挂起时） */
export function saveCheckpoint(taskId: string, checkpoint: unknown): void {
  const db = getDb();
  db.prepare("UPDATE tasks SET checkpoint = ?, status = 'suspended', updated_at = ? WHERE task_id = ?")
    .run(JSON.stringify(checkpoint), Date.now(), taskId);
}

/** 增加重试计数 */
export function incrementRetryCount(taskId: string): number {
  const db = getDb();
  db.prepare("UPDATE tasks SET retry_count = retry_count + 1, updated_at = ? WHERE task_id = ?").run(Date.now(), taskId);
  const row = db.prepare("SELECT retry_count FROM tasks WHERE task_id = ?").get(taskId) as { retry_count: number } | null;
  return row?.retry_count ?? 0;
}
