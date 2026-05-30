/**
 * EventEmitter - 生命周期事件发射器
 *
 * 管理事件订阅/取消订阅，安全地分发事件给所有消费者。
 * 回调异常不影响其他回调和主流程。
 */

import type { EventCallback, LifecycleEvent, UnsubscribeFn } from "./types";

export class AgentEventEmitter {
  private readonly listeners = new Set<EventCallback>();

  /**
   * 订阅生命周期事件
   * @returns 取消订阅函数
   */
  on(callback: EventCallback): UnsubscribeFn {
    this.listeners.add(callback);
    return () => this.off(callback);
  }

  /**
   * 取消订阅生命周期事件
   */
  off(callback: EventCallback): void {
    this.listeners.delete(callback);
  }

  /**
   * 发射事件给所有已注册的消费者
   *
   * 每个回调用 try-catch 包裹，异常用 console.warn 记录但不抛出。
   * 回调按注册顺序（Set 迭代顺序）被调用。
   */
  emit(event: LifecycleEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.warn("[AgentEventEmitter] Listener threw error:", err);
      }
    }
  }

  /** 当前已注册的监听器数量 */
  get listenerCount(): number {
    return this.listeners.size;
  }

  /** 移除所有监听器 */
  clear(): void {
    this.listeners.clear();
  }
}
