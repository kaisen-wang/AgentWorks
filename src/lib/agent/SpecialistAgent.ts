/**
 * SpecialistAgent - 专员 Agent 实现
 *
 * 专员 Agent 的核心能力：
 * 1. 执行具体任务（如生成内容、调用 API）
 * 2. 完成后上报给直接上级
 * 3. 遇到异常时上报决策请求
 */

import { BaseAgent, ExecutionResult, ReportContent, ArchiveInput } from "./BaseAgent";
import type { AgentId, AgentConfig, AgentCapability } from "@/types";

export class SpecialistAgent extends BaseAgent {
  readonly capabilities: AgentCapability[];
  readonly tools: string[];

  constructor(
    id: AgentId,
    name: string,
    config: AgentConfig,
    capabilities: AgentCapability[] = [],
    tools: string[] = []
  ) {
    super(id, name, config);
    this.capabilities = capabilities;
    this.tools = tools;
  }

  /**
   * 执行 - 专员执行具体任务
   * 实际执行由 LLM + 工具调用完成
   */
  async execute(task: string, context?: Record<string, unknown>): Promise<ExecutionResult> {
    this.setStatus("executing");
    try {
      // 框架层：专员执行具体任务
      // 实际实现中，这里会调用 LLM + 外部工具
      console.log(`[SpecialistAgent] ${this.name} 执行任务: ${task}`);

      return {
        success: true,
        data: `任务"${task}"执行完成`,
        cost: 0.01,
        apiCalls: 1,
        model: this.config.model,
      };
    } catch (err) {
      return {
        success: false,
        data: "",
        error: err instanceof Error ? err.message : String(err),
      };
    } finally {
      this.setStatus("idle");
    }
  }

  /**
   * 异常上报（BUP-01）
   * 遇到无法处理的问题时，自动上报给直接上级
   */
  async reportError(
    problem: string,
    attemptedSolutions: string,
    options: { id: string; label: string }[],
    parentId: AgentId
  ): Promise<void> {
    const content: ReportContent = {
      type: "decision",
      title: "需要决策",
      problem,
      attemptedSolutions,
      options,
    };
    await this.report(content, parentId);
  }

  /**
   * 进度上报（BUP-03）
   */
  async reportProgress(milestone: string, parentId: AgentId): Promise<void> {
    const content: ReportContent = {
      type: "progress",
      title: "进度更新",
      data: { milestone, agentId: this.id, agentName: this.name },
    };
    await this.report(content, parentId);
  }

  async archive(input: ArchiveInput): Promise<string> {
    return super.archive(input);
  }
}
