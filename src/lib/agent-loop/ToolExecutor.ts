/**
 * ToolExecutor - 工具执行器
 *
 * 执行工具调用的三阶段生命周期（prepare→execute→finalize），
 * 支持 before/after 钩子、terminate 信号、parallel/sequential 执行模式。
 * 适配现有 AgentTools 的 executeToolCall 函数。
 */

import type { ToolCall } from "@/lib/llm";
import { executeToolCall } from "@/lib/agent/AgentTools";
import type {
  AfterToolCallResult,
  BeforeToolCallResult,
  IToolExecutor,
  LoopToolExecutionResult,
  ToolExecutionHooks,
  ToolExecutionMode,
} from "./types";

/** 创建错误工具结果 */
function createErrorToolResult(
  toolCallId: string,
  toolName: string,
  message: string,
  duration: number,
): LoopToolExecutionResult {
  return {
    toolCallId,
    toolName,
    output: message,
    isError: true,
    terminate: false,
    duration,
  };
}

export class DefaultToolExecutor implements IToolExecutor {
  /**
   * 执行单个工具调用（三阶段生命周期）
   *
   * 1. PREPARE: 解析参数，调用 beforeToolCall 钩子
   * 2. EXECUTE: 调用现有 executeToolCall，捕获异常
   * 3. FINALIZE: 检查 terminate，调用 afterToolCall 钩子
   */
  async executeToolCall(
    toolCall: ToolCall,
    hooks: ToolExecutionHooks,
    signal: AbortSignal,
  ): Promise<LoopToolExecutionResult> {
    const startTime = Date.now();
    const toolCallId = toolCall.id;
    const toolName = toolCall.function.name;
    let args = toolCall.function.arguments;

    // [DEBUG] 打印工具调用开始
    console.log('[DEBUG][ToolExecutor] 工具调用开始:', {
      toolCallId,
      toolName,
      argsLength: args.length,
      argsPreview: args.slice(0, 300),
      hasBeforeHook: !!hooks.beforeToolCall,
      hasAfterHook: !!hooks.afterToolCall,
    });

    // ---- PREPARE 阶段 ----
    // 解析 JSON 参数
    try {
      JSON.parse(args);
    } catch (parseErr) {
      // [DEBUG] JSON 解析失败
      console.error('[DEBUG][ToolExecutor] PREPARE 阶段 JSON 解析失败:', {
        toolCallId,
        toolName,
        argsLength: args.length,
        argsPreview: args.slice(0, 300),
        error: parseErr instanceof Error ? parseErr.message : String(parseErr),
      });
      return createErrorToolResult(
        toolCallId,
        toolName,
        `Invalid JSON arguments: ${args}`,
        Date.now() - startTime,
      );
    }

    // 调用 beforeToolCall 钩子
    if (hooks.beforeToolCall) {
      try {
        const beforeResult: BeforeToolCallResult | undefined = await hooks.beforeToolCall(
          { toolCall, args },
          signal,
        );
        if (beforeResult?.block) {
          return createErrorToolResult(
            toolCallId,
            toolName,
            beforeResult.reason ?? "Tool execution was blocked",
            Date.now() - startTime,
          );
        }
        if (beforeResult?.modifiedArgs) {
          args = beforeResult.modifiedArgs;
        }
      } catch (err) {
        return createErrorToolResult(
          toolCallId,
          toolName,
          err instanceof Error ? err.message : String(err),
          Date.now() - startTime,
        );
      }
    }

    // 检查取消信号
    if (signal.aborted) {
      return createErrorToolResult(toolCallId, toolName, "Operation aborted", Date.now() - startTime);
    }

    // ---- EXECUTE 阶段 ----
    let output: string;
    let isError = false;
    let terminate = false;

    console.log('[DEBUG][ToolExecutor] EXECUTE 阶段开始:', {
      toolCallId,
      toolName,
      argsPreview: args.slice(0, 200),
    });

    try {
      const raw = await executeToolCall(toolName, args);
      if (raw.success) {
        output = raw.output ?? "";
      } else {
        output = raw.error ?? "Unknown error";
        isError = true;
      }
      console.log('[DEBUG][ToolExecutor] EXECUTE 阶段完成:', {
        toolCallId,
        toolName,
        success: raw.success,
        outputLength: output.length,
        outputPreview: output.slice(0, 200),
        isError,
      });
    } catch (err) {
      output = err instanceof Error ? err.message : String(err);
      isError = true;
      console.error('[DEBUG][ToolExecutor] EXECUTE 阶段异常:', {
        toolCallId,
        toolName,
        error: output,
      });
    }

    // ---- FINALIZE 阶段 ----
    let result: LoopToolExecutionResult = {
      toolCallId,
      toolName,
      output,
      isError,
      terminate,
      duration: Date.now() - startTime,
    };

    console.log('[DEBUG][ToolExecutor] FINALIZE 阶段:', {
      toolCallId,
      toolName,
      isError,
      terminate,
      duration: result.duration,
      outputLength: output.length,
    });

    // 调用 afterToolCall 钩子
    if (hooks.afterToolCall) {
      try {
        const afterResult: AfterToolCallResult | undefined = await hooks.afterToolCall(
          { toolCall, args, result, isError },
          signal,
        );
        if (afterResult) {
          result = {
            ...result,
            output: afterResult.output ?? result.output,
            terminate: afterResult.terminate ?? result.terminate,
            isError: afterResult.isError ?? result.isError,
          };
        }
      } catch (err) {
        result = {
          ...result,
          output: err instanceof Error ? err.message : String(err),
          isError: true,
        };
      }
    }

    return result;
  }

  /**
   * 执行多个工具调用
   *
   * - parallel: Promise.allSettled 并发执行
   * - sequential: 逐个执行，terminate 时提前跳出
   */
  async executeToolCalls(
    toolCalls: ToolCall[],
    mode: ToolExecutionMode,
    hooks: ToolExecutionHooks,
    signal: AbortSignal,
  ): Promise<LoopToolExecutionResult[]> {
    if (mode === "sequential") {
      return this.executeToolCallsSequential(toolCalls, hooks, signal);
    }
    return this.executeToolCallsParallel(toolCalls, hooks, signal);
  }

  private async executeToolCallsSequential(
    toolCalls: ToolCall[],
    hooks: ToolExecutionHooks,
    signal: AbortSignal,
  ): Promise<LoopToolExecutionResult[]> {
    const results: LoopToolExecutionResult[] = [];

    for (const toolCall of toolCalls) {
      if (signal.aborted) break;

      const result = await this.executeToolCall(toolCall, hooks, signal);
      results.push(result);

      // terminate 信号：提前跳出
      if (result.terminate) break;
    }

    return results;
  }

  private async executeToolCallsParallel(
    toolCalls: ToolCall[],
    hooks: ToolExecutionHooks,
    signal: AbortSignal,
  ): Promise<LoopToolExecutionResult[]> {
    const settled = await Promise.allSettled(
      toolCalls.map((tc) => this.executeToolCall(tc, hooks, signal)),
    );

    const results: LoopToolExecutionResult[] = [];
    for (let i = 0; i < settled.length; i++) {
      const outcome = settled[i];
      if (outcome.status === "fulfilled") {
        results.push(outcome.value);
      } else {
        // 不应到达此处（executeToolCall 内部已 catch），但做防御性处理
        // 保留原始 toolCallId，避免 LLM API 报错 insufficient tool messages
        results.push({
          toolCallId: toolCalls[i].id,
          toolName: toolCalls[i].function.name,
          output: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
          isError: true,
          terminate: false,
          duration: 0,
        });
      }
    }

    return results;
  }
}
