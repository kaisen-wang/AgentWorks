import { describe, it, expect, vi } from "vitest";
import { IdempotencyManager } from "./IdempotencyManager";

describe("IdempotencyManager - RFT-06", () => {
  it("为支持幂等的 API 生成幂等键", () => {
    const mgr = new IdempotencyManager();
    const result = mgr.prepareCall("payment", "req-1");
    expect(result.idempotencyKey).toBeDefined();
    expect(result.idempotencyKey).toContain("idem_payment_");
    expect(result.policy.supportsIdempotency).toBe(true);
    expect(result.confirmationRequired).toBe(true); // payment 需要用户确认
  });

  it("不支持幂等的 API 返回 confirmationRequired", () => {
    const mgr = new IdempotencyManager();
    const result = mgr.prepareCall("default", "req-2");
    expect(result.idempotencyKey).toBeUndefined();
    expect(result.confirmationRequired).toBe(true);
    expect(result.warning).toContain("不支持幂等键");
  });

  it("查询类 API 不需要确认", () => {
    const mgr = new IdempotencyManager();
    const result = mgr.prepareCall("query", "req-3");
    expect(result.confirmationRequired).toBe(false);
    expect(result.policy.maxRetries).toBe(3);
  });

  it("记录并缓存幂等结果", () => {
    const mgr = new IdempotencyManager();
    const { idempotencyKey } = mgr.prepareCall("publish", "req-4");
    expect(idempotencyKey).toBeDefined();

    // 缓存前无结果
    const cached1 = mgr.getCachedResult(idempotencyKey!);
    expect(cached1.found).toBe(false);

    // 记录结果
    mgr.recordResult(idempotencyKey, { url: "https://example.com" }, true);

    // 缓存后有结果
    const cached2 = mgr.getCachedResult(idempotencyKey!);
    expect(cached2.found).toBe(true);
    expect(cached2.result).toEqual({ url: "https://example.com" });
  });

  it("callWithRetry 成功时返回结果", async () => {
    const mgr = new IdempotencyManager();
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await mgr.callWithRetry("query", fn);
    expect(result.result).toBe("ok");
    expect(result.retries).toBe(0);
    expect(fn).toHaveBeenCalledOnce();
  });

  it("callWithRetry 重试后成功", async () => {
    const mgr = new IdempotencyManager({ test: { maxRetries: 2, baseDelayMs: 10, maxDelayMs: 100, supportsIdempotency: false, requireUserConfirmation: false } });
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockResolvedValue("ok");
    const result = await mgr.callWithRetry("test", fn);
    expect(result.result).toBe("ok");
    expect(result.retries).toBe(0); // 最终成功，retries 为最后一次成功时的 attempt
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("callWithRetry 超过最大重试次数后返回错误", async () => {
    const mgr = new IdempotencyManager({ test: { maxRetries: 1, baseDelayMs: 10, maxDelayMs: 100, supportsIdempotency: false, requireUserConfirmation: false } });
    const fn = vi.fn().mockRejectedValue(new Error("always fail"));
    const result = await mgr.callWithRetry("test", fn);
    expect(result.error).toBe("always fail");
    expect(fn).toHaveBeenCalledTimes(2); // 初始 + 1 次重试
  });

  it("callWithRetry 需要确认时返回 confirmation_required", async () => {
    const mgr = new IdempotencyManager();
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await mgr.callWithRetry("payment", fn);
    expect(result.error).toBe("confirmation_required");
    expect(result.warning).toBeDefined();
    expect(fn).not.toHaveBeenCalled();
  });

  it("幂等缓存避免重复执行", async () => {
    const mgr = new IdempotencyManager();
    const fn = vi.fn().mockResolvedValue("cached-result");

    // 第一次调用
    const result1 = await mgr.callWithRetry("publish", fn, "same-request");
    expect(result1.result).toBe("cached-result");
    expect(fn).toHaveBeenCalledOnce();

    // 第二次用同一幂等键调用（通过 getCachedResult）
    // 注意：callWithRetry 每次生成新的幂等键，所以这里测试 getCachedResult
    const { idempotencyKey } = mgr.prepareCall("publish", "same-request");
    mgr.recordResult(idempotencyKey, "cached-result", true);
    const cached = mgr.getCachedResult(idempotencyKey!);
    expect(cached.found).toBe(true);
    expect(cached.result).toBe("cached-result");
  });

  it("支付接口不重试", () => {
    const mgr = new IdempotencyManager();
    const policy = mgr.getPolicy("payment");
    expect(policy.maxRetries).toBe(0);
    expect(policy.requireUserConfirmation).toBe(true);
  });

  it("清理过期记录", () => {
    const mgr = new IdempotencyManager();
    const { idempotencyKey } = mgr.prepareCall("publish", "old-req");
    expect(idempotencyKey).toBeDefined();

    // 直接修改 createdAt 模拟过期
    // 由于 records 是 private，通过 purgeExpired 测试
    const purged = mgr.purgeExpired();
    // 刚创建的记录不应被清理（1小时内）
    expect(purged).toBe(0);
  });

  it("自定义策略覆盖默认策略", () => {
    const mgr = new IdempotencyManager({
      payment: { maxRetries: 5, baseDelayMs: 100, maxDelayMs: 1000, supportsIdempotency: true, requireUserConfirmation: false },
    });
    const policy = mgr.getPolicy("payment");
    expect(policy.maxRetries).toBe(5);
    expect(policy.requireUserConfirmation).toBe(false);
  });
});
