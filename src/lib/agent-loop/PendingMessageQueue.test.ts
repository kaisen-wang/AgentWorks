import { describe, it, expect } from "vitest";
import { PendingMessageQueue } from "./PendingMessageQueue";

describe("PendingMessageQueue", () => {
  describe("all 模式", () => {
    it("push 将消息加入队列", () => {
      const q = new PendingMessageQueue("all");
      q.push("a");
      q.push("b");
      expect(q.size).toBe(2);
    });

    it("drain 返回所有消息并清空队列", () => {
      const q = new PendingMessageQueue("all");
      q.push("a");
      q.push("b");
      q.push("c");
      const drained = q.drain();
      expect(drained).toEqual(["a", "b", "c"]);
      expect(q.size).toBe(0);
    });

    it("drain 后再次 drain 返回空数组", () => {
      const q = new PendingMessageQueue("all");
      q.push("a");
      q.drain();
      expect(q.drain()).toEqual([]);
    });

    it("空队列 drain 返回空数组", () => {
      const q = new PendingMessageQueue("all");
      expect(q.drain()).toEqual([]);
    });
  });

  describe("one-at-a-time 模式", () => {
    it("drain 每次返回一条消息", () => {
      const q = new PendingMessageQueue("one-at-a-time");
      q.push("a");
      q.push("b");
      q.push("c");

      expect(q.drain()).toEqual(["a"]);
      expect(q.drain()).toEqual(["b"]);
      expect(q.drain()).toEqual(["c"]);
      expect(q.drain()).toEqual([]);
    });

    it("空队列 drain 返回空数组", () => {
      const q = new PendingMessageQueue("one-at-a-time");
      expect(q.drain()).toEqual([]);
    });
  });

  it("peek 返回当前队列内容但不移除", () => {
    const q = new PendingMessageQueue("all");
    q.push("a");
    q.push("b");
    expect(q.peek()).toEqual(["a", "b"]);
    expect(q.size).toBe(2); // 未移除
  });

  it("clear 清空队列", () => {
    const q = new PendingMessageQueue("all");
    q.push("a");
    q.push("b");
    q.clear();
    expect(q.size).toBe(0);
    expect(q.drain()).toEqual([]);
  });

  it("size 属性返回队列长度", () => {
    const q = new PendingMessageQueue("all");
    expect(q.size).toBe(0);
    q.push("a");
    expect(q.size).toBe(1);
    q.push("b");
    expect(q.size).toBe(2);
  });

  it("hasItems 返回是否有消息", () => {
    const q = new PendingMessageQueue("all");
    expect(q.hasItems()).toBe(false);
    q.push("a");
    expect(q.hasItems()).toBe(true);
  });

  it("setDrainMode 可动态切换排空模式", () => {
    const q = new PendingMessageQueue("all");
    q.push("a");
    q.push("b");
    q.setDrainMode("one-at-a-time");
    expect(q.drain()).toEqual(["a"]);
    expect(q.drain()).toEqual(["b"]);
  });
});
