/**
 * Task 数据访问层
 */

import Database from 'better-sqlite3';
import type { TaskId, AgentId, Task, SubTask, TaskStatus, TaskPriority } from '@/types';

/** Task 数据库记录 */
export interface TaskRecord {
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

/** TaskRepository 接口 */
export interface ITaskRepository {
  findAll(): Task[];
  findById(id: TaskId): Task | undefined;
  findByAssignee(assigneeId: AgentId): Task[];
  findByProject(projectId: string): Task[];
  findByStatus(status: TaskStatus): Task[];
  create(task: Task): void;
  update(task: Task): void;
  delete(id: TaskId): void;
}

export class TaskRepository implements ITaskRepository {
  constructor(private db: Database.Database) {}

  /**
   * 查找所有 Tasks
   */
  findAll(): Task[] {
    const stmt = this.db.prepare('SELECT * FROM tasks ORDER BY created_at DESC');
    const rows = stmt.all() as TaskRecord[];
    return rows.map(row => this.mapRowToTask(row));
  }

  /**
   * 根据 ID 查找 Task
   */
  findById(id: TaskId): Task | undefined {
    const stmt = this.db.prepare('SELECT * FROM tasks WHERE task_id = ?');
    const row = stmt.get(id) as TaskRecord | undefined;
    return row ? this.mapRowToTask(row) : undefined;
  }

  /**
   * 根据执行者查找 Tasks
   */
  findByAssignee(assigneeId: AgentId): Task[] {
    const stmt = this.db.prepare(`
      SELECT * FROM tasks 
      WHERE assignee_id = ? 
      ORDER BY priority DESC, created_at ASC
    `);
    const rows = stmt.all(assigneeId) as TaskRecord[];
    return rows.map(row => this.mapRowToTask(row));
  }

  /**
   * 根据项目查找 Tasks
   */
  findByProject(projectId: string): Task[] {
    const stmt = this.db.prepare(`
      SELECT * FROM tasks 
      WHERE project_id = ? 
      ORDER BY created_at DESC
    `);
    const rows = stmt.all(projectId) as TaskRecord[];
    return rows.map(row => this.mapRowToTask(row));
  }

  /**
   * 根据状态查找 Tasks
   */
  findByStatus(status: TaskStatus): Task[] {
    const stmt = this.db.prepare(`
      SELECT * FROM tasks 
      WHERE status = ? 
      ORDER BY created_at DESC
    `);
    const rows = stmt.all(status) as TaskRecord[];
    return rows.map(row => this.mapRowToTask(row));
  }

  /**
   * 创建 Task
   */
  create(task: Task): void {
    const stmt = this.db.prepare(`
      INSERT INTO tasks (
        task_id, title, description, assignee_id, parent_task_id,
        project_id, priority, status, timeout_seconds, retry_count,
        checkpoint, chat_id, created_at, updated_at, completed_at
      ) VALUES (
        @taskId, @title, @description, @assigneeId, @parentTaskId,
        @projectId, @priority, @status, @timeoutSeconds, @retryCount,
        @checkpoint, @chatId, @createdAt, @updatedAt, @completedAt
      )
    `);

    const record = this.mapTaskToRecord(task);
    stmt.run(record);
  }

  /**
   * 更新 Task
   */
  update(task: Task): void {
    const stmt = this.db.prepare(`
      UPDATE tasks SET
        title = @title,
        description = @description,
        assignee_id = @assigneeId,
        parent_task_id = @parentTaskId,
        project_id = @projectId,
        priority = @priority,
        status = @status,
        timeout_seconds = @timeoutSeconds,
        retry_count = @retryCount,
        checkpoint = @checkpoint,
        chat_id = @chatId,
        updated_at = @updatedAt,
        completed_at = @completedAt
      WHERE task_id = @taskId
    `);

    const record = {
      ...this.mapTaskToRecord(task),
      updatedAt: Date.now(),
    };
    stmt.run(record);
  }

  /**
   * 删除 Task
   */
  delete(id: TaskId): void {
    const stmt = this.db.prepare('DELETE FROM tasks WHERE task_id = ?');
    stmt.run(id);
  }

  /**
   * 映射数据库行到 Task 对象
   */
  private mapRowToTask(row: TaskRecord): Task {
    // 解析 checkpoint 字段获取子任务
    const subTasks: SubTask[] = row.checkpoint 
      ? JSON.parse(row.checkpoint) 
      : [];

    return {
      id: row.task_id,
      title: row.title,
      description: row.description,
      assigneeId: row.assignee_id,
      subTasks,
      status: row.status as TaskStatus,
      priority: row.priority as TaskPriority,
      projectId: row.project_id || undefined,
      chatId: row.chat_id || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at || undefined,
    };
  }

  /**
   * 映射 Task 对象到数据库记录
   */
  private mapTaskToRecord(task: Task): any {
    return {
      taskId: task.id,
      title: task.title,
      description: task.description,
      assigneeId: task.assigneeId,
      parentTaskId: null, // 暂不支持父任务
      projectId: task.projectId || null,
      priority: task.priority,
      status: task.status,
      timeoutSeconds: 30,
      retryCount: 0,
      checkpoint: JSON.stringify(task.subTasks),
      chatId: task.chatId || null,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      completedAt: task.completedAt || null,
    };
  }
}
