import { describe, it, expect, vi } from "vitest";
import { TurnManager } from "./TurnManager";
import type { TurnContext, PrepareNextTurnResult } from "./types";

function makeContext(overrides?: Partial<TurnContext>): TurnContext {
  return {
    turnNumber: 1,
    iteration: 0,
    transcript: [],
    lastAssistantMessage: null,
    ...overrides,
  };
}

describe("TurnManager", () => {
  describe("prepareNextTurn", () => {
    it("未配置钩子时返回空对象", async () => {
      const tm = new TurnManager();
      const result = await tm.prepareNextTurn(makeContext());
      expect(result).toEqual({});
    });

    it("配置了钩子时调用并返回修改结果", async () => {
      const hook = vi.fn().mockResolvedValue({ model: "gpt-4o" });
      const tm = new TurnManager(hook);
      const ctx = makeContext();
      const result = await tm.prepareNextTurn(ctx);
      expect(hook).toHaveBeenCalledWith(ctx);
      expect(result).toEqual({ model: "gpt-4o" });
    });

    it("钩子返回 undefined 时返回空对象", async () => {
      const hook = vi.fn().mockResolvedValue(undefined);
      const tm = new TurnManager(hook);
      const result = await tm.prepareNextTurn(makeContext());
      expect(result).toEqual({});
    });

    it("返回的 model/systemPrompt 可覆盖当前值", async () => {
      const hook = vi.fn().mockResolvedValue({
        model: "claude-3",
        systemPrompt: "new prompt",
      } satisfies PrepareNextTurnResult);
      const tm = new TurnManager(hook);
      const result = await tm.prepareNextTurn(makeContext());
      expect(result.model).toBe("claude-3");
      expect(result.systemPrompt).toBe("new prompt");
    });
  });

  describe("shouldStopAfterTurn", () => {
    it("未配置钩子时返回 false", async () => {
      const tm = new TurnManager();
      const result = await tm.shouldStopAfterTurn(makeContext());
      expect(result).toBe(false);
    });

    it("配置了钩子且返回 true 时返回 true", async () => {
      const hook = vi.fn().mockResolvedValue(true);
      const tm = new TurnManager(undefined, hook);
      const result = await tm.shouldStopAfterTurn(makeContext());
      expect(result).toBe(true);
    });

    it("配置了钩子且返回 false 时返回 false", async () => {
      const hook = vi.fn().mockResolvedValue(false);
      const tm = new TurnManager(undefined, hook);
      const result = await tm.shouldStopAfterTurn(makeContext());
      expect(result).toBe(false);
    });

    it("钩子接收正确的 TurnContext", async () => {
      const hook = vi.fn().mockReturnValue(false);
      const tm = new TurnManager(undefined, hook);
      const ctx = makeContext({ turnNumber: 3, iteration: 5 });
      await tm.shouldStopAfterTurn(ctx);
      expect(hook).toHaveBeenCalledWith(ctx);
    });
  });
});
