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
import { callLLM } from "@/lib/llm";
import type { LLMConfig, ToolCall } from "@/lib/llm";
import { getAgentToolDefinitions, executeToolCall, type ToolExecutionResult } from "./AgentTools";

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

        // 调用LLM，传递工具定义
        const response = await callLLM(
          [
            { role: "system", content: systemPrompt },
            { role: "user", content: task },
          ],
          llmConfig,
          { tools, toolChoice: "auto" }
        );

        const cost = response.usage
          ? (response.usage.promptTokens * 0.00003 + response.usage.completionTokens * 0.00006)
          : 0.01;

        // 检查是否有工具调用
        if (response.toolCalls && response.toolCalls.length > 0) {
          console.log(`🔧 [${this.name}] LLM请求调用 ${response.toolCalls.length} 个工具`);

          // 执行工具调用
          const toolResults: Array<{ toolCall: ToolCall; result: ToolExecutionResult }> = [];
          
          for (const toolCall of response.toolCalls) {
            console.log(`🔧 [${this.name}] 执行工具: ${toolCall.function.name}`);
            
            const result = await executeToolCall(
              toolCall.function.name,
              toolCall.function.arguments
            );
            
            toolResults.push({ toolCall, result });
            
            console.log(`✅ [${this.name}] 工具执行结果:`, result.success ? result.output : result.error);
          }

          // 格式化工具执行结果
          const resultSummary = toolResults.map(({ toolCall, result }) => {
            if (result.success) {
              return `✅ ${toolCall.function.name}: ${result.output}`;
            } else {
              return `❌ ${toolCall.function.name}: ${result.error}`;
            }
          }).join("\n");

          return {
            success: true,
            data: `已完成操作：\n\n${resultSummary}`,
            cost,
            apiCalls: 1,
            model: response.model,
          };
        }

        // 没有工具调用，返回文本
        return {
          success: true,
          data: response.content,
          cost,
          apiCalls: 1,
          model: response.model,
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
