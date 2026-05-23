/**
 * RFT-06: 外部 API 幂等性处理
 *
 * Agent 调用外部 API 时：
 * - 若 API 支持幂等键，自动生成并传递
 * - 若不支持，在用户授权时明确提示"可能因重试导致重复执行"
 * - 不同 API 可配置单独的重试策略（如支付接口不重试）
 */

import { v4 as uuidv4 } from "uuid";

// ============================================================
// 幂等键管理
// ============================================================

/** 幂等键记录 */
interface IdempotencyRecord {
  key: string;           // 幂等键
  apiName: string;       // API 名称
  requestId: string;     // 关联的请求 ID
  status: "pending" | "completed" | "failed";
  result?: unknown;      // 缓存的执行结果
  createdAt: number;
  completedAt?: number;
}

/** API 重试策略配置 */
export interface RetryPolicy {
  maxRetries: number;        // 最大重试次数，0 表示不重试
  baseDelayMs: number;       // 基础重试延迟（毫秒）
  maxDelayMs: number;        // 最大重试延迟
  supportsIdempotency: boolean; // 是否支持幂等键
  requireUserConfirmation: boolean; // 不支持幂等时是否需要用户确认
}

/** 预置重试策略 */
const DEFAULT_POLICIES: Record<string, RetryPolicy> = {
  // 支付接口 - 不重试，需用户确认
  payment: {
    maxRetries: 0,
    baseDelayMs: 0,
    maxDelayMs: 0,
    supportsIdempotency: true,
    requireUserConfirmation: true,
  },
  // 发布接口 - 支持幂等，可重试
  publish: {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
    supportsIdempotency: true,
    requireUserConfirmation: false,
  },
  // 邮件发送 - 支持幂等，可重试
  email: {
    maxRetries: 3,
    baseDelayMs: 2000,
    maxDelayMs: 30000,
    supportsIdempotency: true,
    requireUserConfirmation: false,
  },
  // 数据查询 - 无副作用，可重试
  query: {
    maxRetries: 3,
    baseDelayMs: 500,
    maxDelayMs: 5000,
    supportsIdempotency: false,
    requireUserConfirmation: false,
  },
  // 默认策略
  default: {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
    supportsIdempotency: false,
    requireUserConfirmation: true,
  },
};

/**
 * IdempotencyManager - 幂等性管理器
 *
 * 管理 API 调用的幂等键生成、缓存和重试策略。
 */
export class IdempotencyManager {
  private records = new Map<string, IdempotencyRecord>();
  private policies: Record<string, RetryPolicy>;

  constructor(customPolicies?: Record<string, RetryPolicy>) {
    this.policies = { ...DEFAULT_POLICIES, ...customPolicies };
  }

  /**
   * 为 API 调用准备幂等键
   *
   * 返回幂等键（如果 API 支持）和重试策略。
   * 如果 API 不支持幂等且需要用户确认，返回 confirmationRequired 标记。
   */
  prepareCall(apiName: string, requestId: string): {
    idempotencyKey?: string;
    policy: RetryPolicy;
    confirmationRequired: boolean;
    warning?: string;
  } {
    const policy = this.policies[apiName] || this.policies.default;
    let idempotencyKey: string | undefined;
    let confirmationRequired = false;
    let warning: string | undefined;

    if (policy.supportsIdempotency) {
      // 生成幂等键
      idempotencyKey = `idem_${apiName}_${uuidv4()}`;
      this.records.set(idempotencyKey, {
        key: idempotencyKey,
        apiName,
        requestId,
        status: "pending",
        createdAt: Date.now(),
      });
      // 即使支持幂等，也可能需要用户确认（如支付接口）
      if (policy.requireUserConfirmation) {
        confirmationRequired = true;
        warning = `API「${apiName}」为敏感操作，请确认是否执行。`;
      }
    } else if (policy.requireUserConfirmation) {
      // 不支持幂等且需要用户确认
      confirmationRequired = true;
      warning = `API「${apiName}」不支持幂等键，重试可能导致重复执行。请确认是否继续。`;
    }

    return { idempotencyKey, policy, confirmationRequired, warning };
  }

  /**
   * 记录 API 调用结果
   *
   * 如果 API 支持幂等，缓存结果以便重试时直接返回。
   */
  recordResult(idempotencyKey: string | undefined, result: unknown, success: boolean): void {
    if (!idempotencyKey) return;

    const record = this.records.get(idempotencyKey);
    if (record) {
      record.status = success ? "completed" : "failed";
      record.result = result;
      record.completedAt = Date.now();
    }
  }

  /**
   * 检查是否有缓存的幂等结果
   *
   * 如果同一幂等键的请求已完成，直接返回缓存结果，避免重复执行。
   */
  getCachedResult(idempotencyKey: string): { found: boolean; result?: unknown } {
    const record = this.records.get(idempotencyKey);
    if (record && record.status === "completed") {
      return { found: true, result: record.result };
    }
    return { found: false };
  }

  /**
   * 带重试策略的 API 调用
   *
   * 根据策略自动重试，支持指数退避。
   */
  async callWithRetry<T>(
    apiName: string,
    fn: (idempotencyKey?: string) => Promise<T>,
    requestId: string = uuidv4()
  ): Promise<{ result?: T; error?: string; retries: number; warning?: string }> {
    const { idempotencyKey, policy, confirmationRequired, warning } = this.prepareCall(apiName, requestId);

    if (confirmationRequired) {
      return { error: "confirmation_required", retries: 0, warning };
    }

    // 检查缓存
    if (idempotencyKey) {
      const cached = this.getCachedResult(idempotencyKey);
      if (cached.found) {
        return { result: cached.result as T, retries: 0 };
      }
    }

    let lastError: string | undefined;
    let retries = 0;

    for (let attempt = 0; attempt <= policy.maxRetries; attempt++) {
      try {
        const result = await fn(idempotencyKey);
        this.recordResult(idempotencyKey, result, true);
        return { result, retries };
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        retries = attempt;

        if (attempt < policy.maxRetries) {
          // 指数退避
          const delay = Math.min(
            policy.baseDelayMs * Math.pow(2, attempt),
            policy.maxDelayMs
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    this.recordResult(idempotencyKey, undefined, false);
    return { error: lastError, retries };
  }

  /** 获取 API 重试策略 */
  getPolicy(apiName: string): RetryPolicy {
    return this.policies[apiName] || this.policies.default;
  }

  /** 清理过期的幂等记录（超过 1 小时） */
  purgeExpired(): number {
    const cutoff = Date.now() - 60 * 60 * 1000;
    let purged = 0;
    for (const [key, record] of this.records.entries()) {
      if (record.createdAt < cutoff) {
        this.records.delete(key);
        purged++;
      }
    }
    return purged;
  }
}

// 单例
export const idempotencyManager = new IdempotencyManager();
