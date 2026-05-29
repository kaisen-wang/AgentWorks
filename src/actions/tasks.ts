'use server';

/**
 * Task Server Actions
 * 所有Task操作都在服务器端执行
 */

import { getDb } from '@/lib/db/database';
import { initializeDatabase } from '@/lib/db/init';
import { TaskRepository } from '@/lib/db/taskRepo';
import { v4 as uuidv4 } from 'uuid';
import type { Task, TaskPriority, TaskStatus } from '@/types';

/**
 * 获取任务列表
 */
export async function getTasks(filters?: {
  assigneeId?: string;
  projectId?: string;
  status?: TaskStatus;
}): Promise<{ tasks: Task[]; error?: string }> {
  try {
    initializeDatabase();
    const db = getDb();
    const repo = new TaskRepository(db);

    let tasks: Task[];

    if (filters?.assigneeId) {
      tasks = repo.findByAssignee(filters.assigneeId);
    } else if (filters?.projectId) {
      tasks = repo.findByProject(filters.projectId);
    } else if (filters?.status) {
      tasks = repo.findByStatus(filters.status);
    } else {
      tasks = repo.findAll();
    }

    return { tasks };
  } catch (error) {
    console.error("获取任务失败:", error);
    return { tasks: [], error: "数据库错误" };
  }
}

/**
 * 创建任务
 */
export async function createTask(data: {
  title: string;
  description: string;
  assigneeId: string;
  chatId: string;
  priority?: TaskPriority;
  projectId?: string;
}): Promise<{ task?: Task; error?: string }> {
  try {
    initializeDatabase();
    const db = getDb();
    const repo = new TaskRepository(db);

    const now = Date.now();
    const task: Task = {
      id: uuidv4(),
      title: data.title,
      description: data.description || "",
      assigneeId: data.assigneeId,
      subTasks: [],
      status: "pending",
      priority: data.priority || "medium",
      projectId: data.projectId || undefined,
      chatId: data.chatId,
      createdAt: now,
      updatedAt: now,
    };

    repo.create(task);
    return { task };
  } catch (error) {
    console.error("创建任务失败:", error);
    return { error: "创建失败" };
  }
}

/**
 * 更新任务
 */
export async function updateTask(data: {
  id: string;
  updates: Partial<Task>;
}): Promise<{ task?: Task; error?: string }> {
  try {
    initializeDatabase();
    const db = getDb();
    const repo = new TaskRepository(db);
    const existing = repo.findById(data.id);

    if (!existing) {
      return { error: "任务不存在" };
    }

    const updated = {
      ...existing,
      ...data.updates,
      updatedAt: Date.now(),
    };

    // 如果状态变为 completed 或 failed，设置 completedAt
    if (data.updates.status && (data.updates.status === "completed" || data.updates.status === "failed")) {
      updated.completedAt = Date.now();
    }

    repo.update(updated);
    return { task: updated };
  } catch (error) {
    console.error("更新任务失败:", error);
    return { error: "更新失败" };
  }
}

/**
 * 删除任务
 */
export async function deleteTask(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    initializeDatabase();
    const db = getDb();
    const repo = new TaskRepository(db);
    repo.delete(id);
    return { success: true };
  } catch (error) {
    console.error("删除任务失败:", error);
    return { success: false, error: "删除失败" };
  }
}
