/**
 * SupervisorAgent - 主管 Agent 实现
 *
 * 主管 Agent 的核心能力：
 * 1. 接收宏观任务，自动拆解为子任务（TDN-02）
 * 2. 分配子任务给下属 Agent
 * 3. 汇总下属上报结果
 * 4. 异常上报给上级/老板（BUP-01, BUP-02）
 */

import { BaseAgent, ExecutionResult, SummaryResult, ReportContent, ArchiveInput } from "./BaseAgent";
import type { AgentId, AgentConfig, AgentCapability } from "@/types";
import { decomposeWithLLM, parseDecompositionResponse } from "@/lib/llm";
import type { LLMConfig, DecompositionResult } from "@/lib/llm";
import { matchCapabilitiesFromTask, matchAgentByCapability } from "@/lib/capability";
import type { Agent } from "@/types";

interface TaskDecomposition {
  subTasks: {
    assigneeId: AgentId;
    title: string;
    description: string;
  }[];
  summary: string;
  unmatchedTasks?: string[];
}

export class SupervisorAgent extends BaseAgent {
  readonly capabilities: AgentCapability[];

  constructor(id: AgentId, name: string, config: AgentConfig, capabilities: AgentCapability[] = []) {
    super(id, name, config);
    this.capabilities = capabilities;
  }

  /**
   * 执行 - 主管的执行是"拆解任务"
   * 实际拆解逻辑由 LLM 驱动，这里提供框架
   */
  async execute(task: string, context?: Record<string, unknown>): Promise<ExecutionResult> {
    this.setStatus("executing");
    try {
      // 主管执行 = 任务拆解
      const decomposition = await this.decomposeTask(task, context);
      return {
        success: true,
        data: JSON.stringify(decomposition),
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
   * 任务拆解（TDN-02）
   *
   * 优先使用 LLM 智能拆解；LLM 不可用时回退到能力标签匹配；
   * 都不可用时回退到简单均分。
   */
  async decomposeTask(
    task: string,
    context?: Record<string, unknown>
  ): Promise<TaskDecomposition> {
    const subordinates = (context?.subordinates as AgentId[]) || [];
    const subordinateCapabilities = (context?.subordinateCapabilities as Array<{
      id: AgentId;
      name: string;
      capabilities: AgentCapability[];
    }>) || [];
    const llmConfig = context?.llmConfig as LLMConfig | undefined;

    // 策略 1: LLM 智能拆解
    if (llmConfig && subordinateCapabilities.length > 0) {
      try {
        const result = await decomposeWithLLM(
          task,
          subordinateCapabilities,
          llmConfig
        );
        return {
          subTasks: result.subTasks,
          summary: result.summary,
          unmatchedTasks: result.unmatchedTasks,
        };
      } catch (err) {
        console.warn(`[SupervisorAgent] LLM 拆解失败，回退到能力匹配:`, err);
      }
    }

    // 策略 2: 能力标签匹配拆解
    if (subordinateCapabilities.length > 0) {
      const requiredCaps = matchCapabilitiesFromTask(task);
      if (requiredCaps.length > 0) {
        const agents = subordinateCapabilities.map((s) => ({
          ...s,
          role: "specialist" as const,
          parentId: null as string | null,
          childIds: [] as AgentId[],
          maxChildren: 0,
          spanExemption: false,
          status: "idle" as const,
          config: { model: "", timeout: 30000, maxRetries: 3, decisionThreshold: 0 },
        }));
        const matches = matchAgentByCapability(requiredCaps, agents as Agent[]);

        if (matches.length > 0) {
          return {
            subTasks: matches.map((m, i) => ({
              assigneeId: m.agent.id,
              title: `${requiredCaps[i] || "子任务"} ${i + 1}`,
              description: `从"${task}"拆出 - 匹配能力: ${m.matchedTags.join(", ")}`,
            })),
            summary: `已按能力标签将任务"${task}"拆解为 ${matches.length} 个子任务`,
          };
        }
      }
    }

    // 策略 3: 简单均分（兜底）
    return {
      subTasks: subordinates.map((id, i) => ({
        assigneeId: id,
        title: `子任务 ${i + 1}`,
        description: `从"${task}"拆解出的子任务`,
      })),
      summary: `已将任务"${task}"拆解为 ${subordinates.length} 个子任务`,
    };
  }

  /**
   * 汇总 - 主管汇总下属上报
   * 覆盖基类，提供更丰富的汇总格式
   */
  async summarize(results: ExecutionResult[]): Promise<SummaryResult> {
    this.setStatus("summarizing");
    try {
      const successResults = results.filter((r) => r.success);
      const failedResults = results.filter((r) => !r.success);

      let content = "";
      if (successResults.length > 0) {
        content += `完成 ${successResults.length} 项:\n`;
        content += successResults.map((r) => `- ${r.data}`).join("\n");
      }
      if (failedResults.length > 0) {
        content += `\n失败 ${failedResults.length} 项:\n`;
        content += failedResults.map((r) => `- ${r.error || r.data}`).join("\n");
      }

      return { content, format: "card" };
    } finally {
      this.setStatus("idle");
    }
  }

  /**
   * 上报 - 主管上报给老板
   * 构造结构化上报内容（BUP-02），委托给 BaseAgent.report 真正发送
   */
  async report(content: ReportContent, targetId?: AgentId): Promise<void> {
    const report: ReportContent = {
      ...content,
      type: content.type || "decision",
      title: content.title || `${this.name} 上报`,
    };
    // 委托给 BaseAgent.report，真正发送到 store/chat
    await super.report(report, targetId);
  }

  async archive(input: ArchiveInput): Promise<string> {
    return super.archive(input);
  }
}
