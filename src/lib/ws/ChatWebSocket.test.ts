/**
 * WebSocket 推送事件集成测试
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { emitPushEvent, onPushEvent } from "./ChatWebSocket";
import type { PushEvent, PushEventType } from "./ChatWebSocket";

describe("WebSocket 推送事件", () => {
  let cleanup: (() => void) | null = null;
  let receivedEvents: PushEvent[] = [];

  beforeEach(() => {
    receivedEvents = [];
  });

  afterEach(() => {
    if (cleanup) {
      cleanup();
      cleanup = null;
    }
  });

  it("emitPushEvent 触发 onPushEvent 监听器", () => {
    cleanup = onPushEvent((event) => {
      receivedEvents.push(event);
    });

    emitPushEvent("new_message", { content: "hello" }, "chat-1");

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].event).toBe("new_message");
    expect(receivedEvents[0].chatId).toBe("chat-1");
    expect(receivedEvents[0].data).toEqual({ content: "hello" });
  });

  it("多个监听器均收到事件", () => {
    const events2: PushEvent[] = [];
    cleanup = onPushEvent((event) => { receivedEvents.push(event); });
    const cleanup2 = onPushEvent((event) => { events2.push(event); });

    emitPushEvent("task_status_changed", { taskId: "t1" }, "chat-2");

    expect(receivedEvents).toHaveLength(1);
    expect(events2).toHaveLength(1);

    cleanup2();
  });

  it("取消监听后不再收到事件", () => {
    cleanup = onPushEvent((event) => { receivedEvents.push(event); });
    cleanup!();
    cleanup = null;

    emitPushEvent("new_message", {}, "chat-1");
    expect(receivedEvents).toHaveLength(0);
  });

  it("member_added 事件正确传递", () => {
    cleanup = onPushEvent((event) => { receivedEvents.push(event); });

    emitPushEvent("member_added", { id: "agent-1", name: "Agent1" }, "chat-1");

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].event).toBe("member_added");
    expect(receivedEvents[0].data).toEqual({ id: "agent-1", name: "Agent1" });
  });

  it("member_removed 事件正确传递", () => {
    cleanup = onPushEvent((event) => { receivedEvents.push(event); });

    emitPushEvent("member_removed", { memberId: "agent-1" }, "chat-1");

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].event).toBe("member_removed");
  });

  it("member_role_changed 事件正确传递", () => {
    cleanup = onPushEvent((event) => { receivedEvents.push(event); });

    emitPushEvent("member_role_changed", { memberId: "agent-1", role: "owner" }, "chat-1");

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].event).toBe("member_role_changed");
  });

  it("mention_all 事件正确传递", () => {
    cleanup = onPushEvent((event) => { receivedEvents.push(event); });

    emitPushEvent("mention_all", { chatId: "chat-1", senderId: "user", content: "@all 开会" }, "chat-1");

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].event).toBe("mention_all");
    expect((receivedEvents[0].data as { content: string }).content).toBe("@all 开会");
  });

  it("监听器异常不影响其他监听器", () => {
    const events2: PushEvent[] = [];
    cleanup = onPushEvent(() => { throw new Error("listener error"); });
    const cleanup2 = onPushEvent((event) => { events2.push(event); });

    // 抑制 console.error
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    emitPushEvent("new_message", {}, "chat-1");
    spy.mockRestore();

    expect(events2).toHaveLength(1);
    cleanup2();
  });

  it("事件包含 timestamp", () => {
    cleanup = onPushEvent((event) => { receivedEvents.push(event); });
    const before = Date.now();

    emitPushEvent("new_message", {}, "chat-1");

    const after = Date.now();
    expect(receivedEvents[0].timestamp).toBeGreaterThanOrEqual(before);
    expect(receivedEvents[0].timestamp).toBeLessThanOrEqual(after);
  });
});
