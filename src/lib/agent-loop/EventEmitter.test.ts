import { describe, it, expect, vi } from "vitest";
import { AgentEventEmitter } from "./EventEmitter";
import type { LifecycleEvent, EventCallback } from "./types";

function makeEvent(type: LifecycleEvent["type"]): LifecycleEvent {
  return {
    type,
    data: {} as never,
    timestamp: Date.now(),
  };
}

describe("AgentEventEmitter", () => {
  it("on() 注册回调并返回 UnsubscribeFn，调用后回调不再被调用", () => {
    const emitter = new AgentEventEmitter();
    const callback = vi.fn();
    const unsubscribe = emitter.on(callback);

    emitter.emit(makeEvent("agent_start"));
    expect(callback).toHaveBeenCalledTimes(1);

    unsubscribe();
    emitter.emit(makeEvent("agent_end"));
    expect(callback).toHaveBeenCalledTimes(1); // 不再被调用
  });

  it("off() 取消注册后回调不再被调用", () => {
    const emitter = new AgentEventEmitter();
    const callback = vi.fn();
    emitter.on(callback);

    emitter.emit(makeEvent("agent_start"));
    expect(callback).toHaveBeenCalledTimes(1);

    emitter.off(callback);
    emitter.emit(makeEvent("agent_end"));
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("emit() 时所有已注册回调按注册顺序被调用", () => {
    const emitter = new AgentEventEmitter();
    const order: number[] = [];
    const cb1: EventCallback = () => order.push(1);
    const cb2: EventCallback = () => order.push(2);
    const cb3: EventCallback = () => order.push(3);

    emitter.on(cb1);
    emitter.on(cb2);
    emitter.on(cb3);

    emitter.emit(makeEvent("agent_start"));
    expect(order).toEqual([1, 2, 3]);
  });

  it("回调抛出异常时不影响其他回调和 emit() 主流程", () => {
    const emitter = new AgentEventEmitter();
    const callbackAfter = vi.fn();
    const errorCallback: EventCallback = () => {
      throw new Error("test error");
    };

    emitter.on(errorCallback);
    emitter.on(callbackAfter);

    // emit 不应抛出
    expect(() => emitter.emit(makeEvent("agent_start"))).not.toThrow();
    // 后续回调仍被调用
    expect(callbackAfter).toHaveBeenCalledTimes(1);
  });

  it("同一回调重复注册不重复调用（使用 Set 去重）", () => {
    const emitter = new AgentEventEmitter();
    const callback = vi.fn();

    emitter.on(callback);
    emitter.on(callback); // 重复注册

    emitter.emit(makeEvent("agent_start"));
    expect(callback).toHaveBeenCalledTimes(1); // 只调用一次
  });

  it("listenerCount 返回已注册的监听器数量", () => {
    const emitter = new AgentEventEmitter();
    expect(emitter.listenerCount).toBe(0);

    const cb1 = vi.fn();
    const cb2 = vi.fn();
    emitter.on(cb1);
    expect(emitter.listenerCount).toBe(1);
    emitter.on(cb2);
    expect(emitter.listenerCount).toBe(2);

    emitter.off(cb1);
    expect(emitter.listenerCount).toBe(1);
  });

  it("clear() 移除所有监听器", () => {
    const emitter = new AgentEventEmitter();
    emitter.on(vi.fn());
    emitter.on(vi.fn());
    expect(emitter.listenerCount).toBe(2);

    emitter.clear();
    expect(emitter.listenerCount).toBe(0);
  });
});
