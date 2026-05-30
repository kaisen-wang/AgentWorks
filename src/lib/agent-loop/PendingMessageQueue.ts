/**
 * PendingMessageQueue - 消息队列
 *
 * 支持 "all" 和 "one-at-a-time" 两种排空模式，
 * 用于 steering 和 follow-up 消息队列。
 */

import type { QueueDrainMode } from "./types";

export class PendingMessageQueue {
  private queue: string[] = [];

  constructor(private drainMode: QueueDrainMode = "all") {}

  /** 将消息加入队列 */
  push(message: string): void {
    this.queue.push(message);
  }

  /** 按排空模式取出消息 */
  drain(): string[] {
    if (this.drainMode === "all") {
      const messages = [...this.queue];
      this.queue = [];
      return messages;
    }
    // one-at-a-time
    if (this.queue.length === 0) {
      return [];
    }
    return [this.queue.shift()!];
  }

  /** 返回当前队列内容（只读）但不移除 */
  peek(): readonly string[] {
    return this.queue;
  }

  /** 清空队列 */
  clear(): void {
    this.queue = [];
  }

  /** 当前队列长度 */
  get size(): number {
    return this.queue.length;
  }

  /** 是否有消息 */
  hasItems(): boolean {
    return this.queue.length > 0;
  }

  /** 更新排空模式 */
  setDrainMode(mode: QueueDrainMode): void {
    this.drainMode = mode;
  }
}
