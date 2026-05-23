/**
 * AgentTaskQueue 测试
 */

import { describe, it, expect } from "vitest";
import { AgentTaskQueue, TaskScheduler } from "./AgentTaskQueue";
import type { QueueEntry } from "./AgentTaskQueue";

const makeEntry = (id: string, priority: "low" | "medium" | "high" | "urgent", createdAt = Date.now()): QueueEntry => ({
  taskId: id,
  priority,
  createdAt,
});

describe("AgentTaskQueue", () => {
  it("入队和出队按优先级排序", () => {
    const queue = new AgentTaskQueue();
    queue.enqueue(makeEntry("t1", "low"));
    queue.enqueue(makeEntry("t2", "high"));
    queue.enqueue(makeEntry("t3", "medium"));

    const first = queue.dequeue();
    expect(first?.taskId).toBe("t2"); // high first
    const second = queue.dequeue();
    expect(second?.taskId).toBe("t3"); // medium second
    const third = queue.dequeue();
    expect(third?.taskId).toBe("t1"); // low last
  });

  it("同级队列按 FIFO 排序", () => {
    const queue = new AgentTaskQueue();
    const now = Date.now();
    queue.enqueue(makeEntry("t1", "medium", now));
    queue.enqueue(makeEntry("t2", "medium", now + 1));

    expect(queue.dequeue()?.taskId).toBe("t1");
    expect(queue.dequeue()?.taskId).toBe("t2");
  });

  it("高优先级任务触发抢占", () => {
    const queue = new AgentTaskQueue();
    queue.enqueue(makeEntry("t1", "low"));
    queue.setCurrent(makeEntry("t1", "low"));

    // 高优先级入队，应返回被抢占的任务
    const preempted = queue.enqueue(makeEntry("t2", "high"));
    expect(preempted?.taskId).toBe("t1");
  });

  it("低优先级任务不触发抢占", () => {
    const queue = new AgentTaskQueue();
    queue.enqueue(makeEntry("t1", "high"));
    queue.setCurrent(makeEntry("t1", "high"));

    const preempted = queue.enqueue(makeEntry("t2", "low"));
    expect(preempted).toBeNull();
  });

  it("挂起当前任务", () => {
    const queue = new AgentTaskQueue();
    queue.setCurrent(makeEntry("t1", "low"));
    const suspended = queue.suspendCurrent({ step: 3 });
    expect(suspended?.taskId).toBe("t1");
    expect(suspended?.checkpoint).toEqual({ step: 3 });
    expect(queue.current).toBeNull();
  });

  it("恢复挂起任务", () => {
    const queue = new AgentTaskQueue();
    queue.setCurrent(makeEntry("t1", "medium"));
    queue.suspendCurrent({ step: 5 });

    const resumed = queue.resumeSuspended();
    expect(resumed?.taskId).toBe("t1");
    expect(queue.length).toBe(1); // 重新入队
  });

  it("移除指定任务", () => {
    const queue = new AgentTaskQueue();
    queue.enqueue(makeEntry("t1", "high"));
    queue.enqueue(makeEntry("t2", "medium"));

    expect(queue.remove("t1")).toBe(true);
    expect(queue.length).toBe(1);
    expect(queue.remove("t1")).toBe(false);
  });

  it("getAll 返回按优先级排序的任务", () => {
    const queue = new AgentTaskQueue();
    queue.enqueue(makeEntry("t1", "low"));
    queue.enqueue(makeEntry("t2", "high"));
    queue.enqueue(makeEntry("t3", "medium"));

    const all = queue.getAll();
    expect(all.map((e) => e.taskId)).toEqual(["t2", "t3", "t1"]);
  });

  it("stats 返回各优先级队列长度", () => {
    const queue = new AgentTaskQueue();
    queue.enqueue(makeEntry("t1", "high"));
    queue.enqueue(makeEntry("t2", "high"));
    queue.enqueue(makeEntry("t3", "medium"));
    queue.enqueue(makeEntry("t4", "low"));

    expect(queue.stats).toEqual({ urgent: 0, high: 2, medium: 1, low: 1, suspended: 0 });
  });

  it("urgent 优先级排在 high 之前", () => {
    const queue = new AgentTaskQueue();
    queue.enqueue(makeEntry("t1", "high"));
    queue.enqueue(makeEntry("t2", "urgent"));

    expect(queue.dequeue()?.taskId).toBe("t2");
    expect(queue.dequeue()?.taskId).toBe("t1");
  });
});

describe("TaskScheduler", () => {
  it("为不同 Agent 维护独立队列", () => {
    const scheduler = new TaskScheduler();
    scheduler.enqueue("agent1", makeEntry("t1", "high"));
    scheduler.enqueue("agent2", makeEntry("t2", "low"));

    const q1 = scheduler.getQueue("agent1");
    const q2 = scheduler.getQueue("agent2");
    expect(q1.length).toBe(1);
    expect(q2.length).toBe(1);
  });

  it("reassign 将任务从源 Agent 移除", () => {
    const scheduler = new TaskScheduler();
    scheduler.enqueue("agent1", makeEntry("t1", "medium"));

    const result = scheduler.reassign("t1", "agent1", "agent2");
    expect(result).toBe(true);
    expect(scheduler.getQueue("agent1").length).toBe(0);
  });

  it("getAllStats 返回所有 Agent 的队列统计", () => {
    const scheduler = new TaskScheduler();
    scheduler.enqueue("agent1", makeEntry("t1", "high"));
    scheduler.enqueue("agent2", makeEntry("t2", "low"));

    const stats = scheduler.getAllStats();
    expect(stats.agent1).toEqual({ urgent: 0, high: 1, medium: 0, low: 0, suspended: 0 });
    expect(stats.agent2).toEqual({ urgent: 0, high: 0, medium: 0, low: 1, suspended: 0 });
  });
});
