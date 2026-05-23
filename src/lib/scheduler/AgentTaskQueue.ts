/**
 * AgentTaskQueue - 每个 Agent 独立的任务队列（ORG-09）
 *
 * 实现：
 * - 三级优先级队列：high / medium / low
 * - 同级队列按 FIFO（created_at ASC）排序
 * - 优先级抢占：高优先级任务可抢占低优先级任务
 * - 任务挂起与恢复
 */

import type { TaskId, TaskPriority } from "@/types";

/** 队列中的任务条目 */
export interface QueueEntry {
  taskId: TaskId;
  priority: TaskPriority;
  createdAt: number;
}

/** 被抢占的任务快照 */
export interface SuspendedTask {
  taskId: TaskId;
  priority: TaskPriority;
  checkpoint: unknown; // 保存的进度快照
  suspendedAt: number;
}

/** 优先级数值映射（数值越大优先级越高） */
const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * AgentTaskQueue - 单个 Agent 的任务队列
 *
 * 每个 Agent 维护独立的队列，不同 Agent 之间队列相互独立。
 */
export class AgentTaskQueue {
  private urgent: QueueEntry[] = [];
  private high: QueueEntry[] = [];
  private medium: QueueEntry[] = [];
  private low: QueueEntry[] = [];
  private currentTask: QueueEntry | null = null;
  private suspendedStack: SuspendedTask[] = [];

  /** 入队 - 按优先级插入对应队列 */
  enqueue(entry: QueueEntry): QueueEntry | null {
    const queue = this._getQueue(entry.priority);
    queue.push(entry);

    // 检查是否需要抢占当前任务
    if (this.currentTask && PRIORITY_WEIGHT[entry.priority] > PRIORITY_WEIGHT[this.currentTask.priority]) {
      return this.currentTask; // 返回被抢占的任务
    }
    return null; // 无抢占
  }

  /** 出队 - 按优先级取下一个任务 */
  dequeue(): QueueEntry | null {
    if (this.urgent.length > 0) return this.urgent.shift()!;
    if (this.high.length > 0) return this.high.shift()!;
    if (this.medium.length > 0) return this.medium.shift()!;
    if (this.low.length > 0) return this.low.shift()!;
    return null;
  }

  /** 获取下一个待执行任务（不出队） */
  peek(): QueueEntry | null {
    if (this.urgent.length > 0) return this.urgent[0];
    if (this.high.length > 0) return this.high[0];
    if (this.medium.length > 0) return this.medium[0];
    if (this.low.length > 0) return this.low[0];
    return null;
  }

  /** 移除指定任务 */
  remove(taskId: TaskId): boolean {
    for (const queue of [this.urgent, this.high, this.medium, this.low]) {
      const idx = queue.findIndex((e) => e.taskId === taskId);
      if (idx >= 0) {
        queue.splice(idx, 1);
        return true;
      }
    }
    return false;
  }

  /** 挂起当前任务（抢占时调用） */
  suspendCurrent(checkpoint: unknown): SuspendedTask | null {
    if (!this.currentTask) return null;
    const suspended: SuspendedTask = {
      taskId: this.currentTask.taskId,
      priority: this.currentTask.priority,
      checkpoint,
      suspendedAt: Date.now(),
    };
    this.suspendedStack.push(suspended);
    this.currentTask = null;
    return suspended;
  }

  /** 恢复最近挂起的任务 */
  resumeSuspended(): QueueEntry | null {
    const suspended = this.suspendedStack.pop();
    if (!suspended) return null;
    const entry: QueueEntry = {
      taskId: suspended.taskId,
      priority: suspended.priority,
      createdAt: Date.now(), // 恢复时更新时间
    };
    // 重新入队
    this.enqueue(entry);
    return entry;
  }

  /** 设置当前正在执行的任务 */
  setCurrent(entry: QueueEntry): void {
    this.currentTask = entry;
  }

  /** 清除当前任务（完成或失败时调用） */
  clearCurrent(): QueueEntry | null {
    const task = this.currentTask;
    this.currentTask = null;
    return task;
  }

  /** 获取队列中所有任务（按优先级排序） */
  getAll(): QueueEntry[] {
    return [...this.urgent, ...this.high, ...this.medium, ...this.low];
  }

  /** 获取队列长度 */
  get length(): number {
    return this.urgent.length + this.high.length + this.medium.length + this.low.length;
  }

  /** 获取当前执行中的任务 */
  get current(): QueueEntry | null {
    return this.currentTask;
  }

  /** 获取挂起任务栈 */
  get suspended(): SuspendedTask[] {
    return [...this.suspendedStack];
  }

  /** 获取各优先级队列长度 */
  get stats(): { urgent: number; high: number; medium: number; low: number; suspended: number } {
    return {
      urgent: this.urgent.length,
      high: this.high.length,
      medium: this.medium.length,
      low: this.low.length,
      suspended: this.suspendedStack.length,
    };
  }

  private _getQueue(priority: TaskPriority): QueueEntry[] {
    switch (priority) {
      case "urgent":
        return this.urgent;
      case "high":
        return this.high;
      case "medium":
        return this.medium;
      case "low":
        return this.low;
    }
  }
}

/**
 * TaskScheduler - 全局任务调度器
 *
 * 管理所有 Agent 的任务队列，提供统一的调度接口。
 */
export class TaskScheduler {
  private queues: Map<string, AgentTaskQueue> = new Map();

  /** 获取或创建 Agent 的任务队列 */
  getQueue(agentId: string): AgentTaskQueue {
    if (!this.queues.has(agentId)) {
      this.queues.set(agentId, new AgentTaskQueue());
    }
    return this.queues.get(agentId)!;
  }

  /** 向 Agent 队列添加任务，返回被抢占的任务（如有） */
  enqueue(agentId: string, entry: QueueEntry): QueueEntry | null {
    const queue = this.getQueue(agentId);
    return queue.enqueue(entry);
  }

  /** 从 Agent 队列取出下一个任务 */
  dequeue(agentId: string): QueueEntry | null {
    const queue = this.getQueue(agentId);
    const entry = queue.dequeue();
    if (entry) queue.setCurrent(entry);
    return entry;
  }

  /** 重分配任务到另一个 Agent */
  reassign(taskId: TaskId, fromAgentId: string, toAgentId: string): boolean {
    const fromQueue = this.queues.get(fromAgentId);
    if (!fromQueue) return false;
    const removed = fromQueue.remove(taskId);
    if (!removed) return false;
    // 注意：调用方需负责将任务入队到 toAgentId
    return true;
  }

  /** 获取所有 Agent 的队列统计 */
  getAllStats(): Record<string, { urgent: number; high: number; medium: number; low: number; suspended: number }> {
    const result: Record<string, { urgent: number; high: number; medium: number; low: number; suspended: number }> = {};
    for (const [agentId, queue] of this.queues) {
      result[agentId] = queue.stats;
    }
    return result;
  }
}

/** 全局单例 */
export const taskScheduler = new TaskScheduler();
