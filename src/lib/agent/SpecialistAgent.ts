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
import type { LLMConfig } from "@/lib/llm";
import { getAgentToolDefinitions } from "./AgentTools";
import { AgentLoop } from "@/lib/agent-loop/AgentLoop";

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
   * 优先使用 LLM 生成结果；LLM 不可用时返回基于能力标签的模拟结果
   *
   * 工具调用循环：LLM 返回 tool_calls → 执行工具 → 结果回传 LLM → LLM 决定继续或结束
   */
  async execute(task: string, context?: Record<string, unknown>): Promise<ExecutionResult> {
    this.setStatus("executing");
    const startTime = Date.now();
    try {
      // 策略 1: 使用 LLM 真正执行
      const llmConfig = context?.llmConfig as LLMConfig | undefined
        ?? (this.config.llmEndpoint ? {
          endpoint: this.config.llmEndpoint,
          apiKey: this.config.llmApiKey || "",
          model: this.config.model,
        } : undefined);

      if (llmConfig) {
        const capabilityDesc = this.capabilities.length > 0
          ? `你的能力标签: ${this.capabilities.map(c => `${c.name}(${c.description})`).join(", ")}`
          : "你是一个通用专员";

        const systemPrompt = `你是 ${this.name}，一个专员 Agent。${capabilityDesc}

当用户要求创建文件、编写代码等任务时，请使用提供的工具来完成实际操作。
不要只是在对话中输出代码，而是调用工具来创建实际的文件。

例如：
- 用户要求"写一个HTML页面" → 调用 write_file 工具创建文件
- 用户要求"修改某个文件" → 调用 edit_file 工具编辑文件
- 用户要求"查看某个文件" → 调用 read_file 工具读取文件

完成工具调用后，简要说明你做了什么。`;

        // 获取工具定义
        const tools = getAgentToolDefinitions();

        // 使用 AgentLoop 驱动执行
        const loop = new AgentLoop({
          systemPrompt,
          llmConfig,
          tools,
          maxIterations: 50,
        });

        const result = await loop.run(task);

        // 估算 cost
        let totalCost = 0;
        for (const msg of result.transcript) {
          if (msg.role === "assistant") {
            totalCost += (msg.content?.length ?? 0) * 0.00001;
          }
        }

        return {
          success: result.status !== "error",
          data: result.lastAssistantMessage?.content ?? "",
          cost: totalCost,
          apiCalls: result.totalIterations,
          model: llmConfig.model,
          error: result.errorMessage ?? undefined,
        };
      }

      // 策略 2: 无 LLM 配置时，基于能力标签生成结构化结果
      const capNames = this.capabilities.map(c => c.name).join(", ") || "通用";
      return {
        success: true,
        data: `[${this.name}(${capNames})] 已处理任务: ${task}`,
        cost: 0,
        apiCalls: 0,
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
