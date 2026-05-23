/**
 * BaseAgent - Agent 四动作基类（ACT-01, ACT-02）
 *
 * 每个 Agent 必须实现：执行、汇总、上报、归档 四个动作，形成闭环。
 * 系统提供此基类，子类可继承并实现定制逻辑。
 */

import type { AgentId, ActionStatus, ArchiveRecord, AgentConfig } from "@/types";
import { useAppStore } from "@/stores/appStore";

/** 执行结果 */
export interface ExecutionResult {
  success: boolean;
  data: string;
  cost?: number;       // 本次执行费用
  apiCalls?: number;   // API 调用次数
  model?: string;      // 使用的模型
  error?: string;
}

/** 汇总结果 */
export interface SummaryResult {
  content: string;     // 结构化摘要
  format: "text" | "table" | "card";
}

/** 上报内容 */
export interface ReportContent {
  type: "progress" | "decision" | "error" | "budget_alert" | "heartbeat_alert";
  title: string;
  problem?: string;
  attemptedSolutions?: string;
  options?: { id: string; label: string }[];
  data?: Record<string, unknown>;
}

/** 归档输入 */
export interface ArchiveInput {
  taskId: string;
  input: string;
  output: string;
  intermediateSteps?: string[];
  cost: number;
  apiCalls: number;
  model: string;
  duration: number;
  tags?: string[];
}

/** Agent 动作接口（ACT-01） */
export interface IAgentActions {
  execute(task: string, context?: Record<string, unknown>): Promise<ExecutionResult>;
  summarize(results: ExecutionResult[]): Promise<SummaryResult>;
  report(content: ReportContent, targetId?: AgentId): Promise<void>;
  archive(input: ArchiveInput): Promise<string>;
}

/** 超时重试配置 */
interface RetryConfig {
  maxRetries: number;
  baseDelay: number;  // 基础延迟（毫秒）
  maxDelay: number;   // 最大延迟
}

const DEFAULT_RETRY: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 16000,
};

/**
 * BaseAgent 基类（ACT-02）
 *
 * 提供四动作的默认实现，子类可覆盖任意动作。
 * 内置超时重试（RFT-01）和指数退避。
 */
export abstract class BaseAgent implements IAgentActions {
  readonly id: AgentId;
  readonly name: string;
  protected config: AgentConfig;
  protected status: ActionStatus = "idle";
  protected retryConfig: RetryConfig;

  constructor(id: AgentId, name: string, config: AgentConfig) {
    this.id = id;
    this.name = name;
    this.config = config;
    this.retryConfig = {
      maxRetries: config.maxRetries,
      baseDelay: 1000,
      maxDelay: 16000,
    };
  }

  /** 获取当前状态 */
  getStatus(): ActionStatus {
    return this.status;
  }

  /** 设置状态 */
  protected setStatus(status: ActionStatus) {
    this.status = status;
  }

  /**
   * 执行 - 完成一个具体任务
   * 子类必须实现此方法
   */
  abstract execute(task: string, context?: Record<string, unknown>): Promise<ExecutionResult>;

  /**
   * 汇总 - 收集并合并多个结果
   * 默认实现：拼接所有结果文本
   */
  async summarize(results: ExecutionResult[]): Promise<SummaryResult> {
    this.setStatus("summarizing");
    try {
      let content: string;
      if (results.length === 0) {
        content = "无结果可汇总";
      } else if (results.length === 1) {
        content = results[0].data;
      } else {
        content = results
          .map((r, i) => `--- 结果 ${i + 1} ---\n${r.data}`)
          .join("\n\n");
      }
      // 记录审计日志
      try {
        useAppStore.getState().addAuditLog(this.id, "summarize", `汇总 ${results.length} 个结果`);
      } catch { /* store 可能未初始化 */ }
      return { content, format: "text" };
    } finally {
      this.setStatus("idle");
    }
  }

  /**
   * 上报 - 将结果/问题发送给上级
   * 默认实现：无阻塞发送（由 workflow 引擎处理路由）
   */
  async report(content: ReportContent, targetId?: AgentId): Promise<void> {
    this.setStatus("reporting");
    try {
      // 上报逻辑由 WorkflowEngine 处理
      // 这里只构造上报内容，实际路由在引擎层
      console.log(`[BaseAgent] ${this.name} 上报给 ${targetId || "上级"}:`, content);
    } finally {
      this.setStatus("idle");
    }
  }

  /**
   * 归档 - 保存到持久存储
   * 默认实现：返回归档 ID（实际存储由 store 处理）
   */
  async archive(input: ArchiveInput): Promise<string> {
    this.setStatus("archived");
    const archiveId = `archive_${this.id}_${Date.now()}`;
    // 记录审计日志
    try {
      useAppStore.getState().addAuditLog(this.id, "archive", `归档任务 ${input.taskId}, 费用 ${input.cost}`);
    } catch { /* store 可能未初始化 */ }
    return archiveId;
  }

  /**
   * 带超时和重试的执行包装器（RFT-01）
   *
   * 指数退避：delay = baseDelay * 2^attempt
   * 重试事件记录审计日志，3 次失败后触发异常上报
   */
  async executeWithRetry(
    task: string,
    context?: Record<string, unknown>
  ): Promise<ExecutionResult> {
    this.setStatus("executing");
    let lastError: string | undefined;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        const result = await this._executeWithTimeout(task, context);
        this.setStatus("idle");
        // 成功时记录审计日志
        try {
          useAppStore.getState().addAuditLog(this.id, "execute", `执行成功: ${task.slice(0, 100)}`);
        } catch { /* store 可能未初始化 */ }
        return result;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);

        if (attempt < this.retryConfig.maxRetries) {
          // 指数退避
          const delay = Math.min(
            this.retryConfig.baseDelay * Math.pow(2, attempt),
            this.retryConfig.maxDelay
          );
          // 重试事件记录审计日志
          try {
            useAppStore.getState().addAuditLog(
              this.id, "execute",
              `第 ${attempt + 1} 次执行失败（${lastError}），${delay}ms 后重试`
            );
          } catch { /* store 可能未初始化 */ }
          await this._sleep(delay);
        }
      }
    }

    this.setStatus("error");

    // 3 次失败后触发异常上报给上级
    try {
      const store = useAppStore.getState();
      store.addAuditLog(this.id, "report", `执行失败（重试 ${this.retryConfig.maxRetries} 次）: ${lastError}`);
      const agent = store.agents[this.id];
      if (agent?.parentId) {
        // 触发异常上报
        const parent = store.agents[agent.parentId];
        if (parent) {
          store.addAuditLog(this.id, "report", `异常上报给 ${parent.name}: 执行失败 - ${lastError}`);
        }
      }
    } catch { /* store 可能未初始化 */ }

    return {
      success: false,
      data: "",
      error: `执行失败（重试 ${this.retryConfig.maxRetries} 次）: ${lastError}`,
    };
  }

  /** 带超时的执行 */
  private _executeWithTimeout(
    task: string,
    context?: Record<string, unknown>
  ): Promise<ExecutionResult> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`执行超时（${this.config.timeout}ms）`));
      }, this.config.timeout);

      this.execute(task, context)
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  private _sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
