/**
 * TypeMappers - SDK 类型与内部类型的双向转换
 *
 * 集中管理 OpenAI SDK 类型与内部类型之间的映射逻辑，
 * 确保类型安全并消除 any 使用。
 */

import type {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionToolChoiceOption,
  ChatCompletionMessageToolCall,
} from "openai/resources/chat/completions/completions";
import type { ChatMessage, ToolDefinition, ToolCall, LLMResponse } from "./LLMService";
import type { StreamEvent, UsageInfo } from "@/lib/agent-loop/types";

/** 工具调用增量累积器（流式场景） */
export interface ToolCallAccumulator {
  id: string;
  name: string;
  argumentsChunks: string[];
}

// ============================================================
// 内部类型 → SDK 类型
// ============================================================

/**
 * 将内部 ChatMessage[] 转换为 SDK ChatCompletionMessageParam[]
 *
 * 处理四种角色：system、user、assistant（含 tool_calls）、tool（含 tool_call_id）
 */
export function toSDKMessages(messages: ChatMessage[]): ChatCompletionMessageParam[] {
  return messages.map((msg) => {
    switch (msg.role) {
      case "system":
        return {
          role: "system" as const,
          content: msg.content,
        };
      case "user":
        return {
          role: "user" as const,
          content: msg.content,
        };
      case "assistant":
        return {
          role: "assistant" as const,
          content: msg.content,
          ...(msg.tool_calls && msg.tool_calls.length > 0
            ? {
                tool_calls: msg.tool_calls.map(
                  (tc): ChatCompletionMessageToolCall => ({
                    id: tc.id,
                    type: "function" as const,
                    function: {
                      name: tc.function.name,
                      arguments: tc.function.arguments,
                    },
                  }),
                ),
              }
            : {}),
        };
      case "tool":
        return {
          role: "tool" as const,
          content: msg.content,
          tool_call_id: msg.tool_call_id ?? "",
        };
    }
  });
}

/**
 * 将内部 ToolDefinition[] 转换为 SDK ChatCompletionTool[]
 */
export function toSDKTools(tools: ToolDefinition[]): ChatCompletionTool[] {
  return tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters as Record<string, unknown>,
    },
  }));
}

/**
 * 将内部 toolChoice 转换为 SDK ChatCompletionToolChoiceOption
 */
export function toSDKToolChoice(
  choice?: "auto" | "none" | "required",
): ChatCompletionToolChoiceOption | undefined {
  if (!choice) return undefined;
  return choice as ChatCompletionToolChoiceOption;
}

// ============================================================
// SDK 类型 → 内部类型
// ============================================================

/**
 * 将 SDK ChatCompletion 转换为内部 LLMResponse
 */
export function fromSDKResponse(response: ChatCompletion): LLMResponse {
  const message = response.choices[0]?.message;

  // 解析工具调用
  const toolCalls: ToolCall[] | undefined = message?.tool_calls?.map((tc) => {
    // 验证 arguments 是否是有效的 JSON 字符串
    let args = tc.function.arguments;
    if (typeof args !== "string") {
      args = JSON.stringify(args);
    }

    return {
      id: tc.id,
      type: "function" as const,
      function: {
        name: tc.function.name,
        arguments: args,
      },
    };
  });

  return {
    content: message?.content ?? "",
    toolCalls,
    usage: response.usage
      ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        }
      : undefined,
    model: response.model,
  };
}

/**
 * 从 SDK 流式 chunk 提取 StreamEvent
 *
 * 处理 delta.content → text_delta 事件
 * 处理 delta.tool_calls → toolcall_delta 事件（含增量累积器更新）
 * 处理 chunk.usage → usage 信息
 */
export function fromSDKStreamChunk(
  chunk: ChatCompletionChunk,
  toolCallAccumulators: Map<string, ToolCallAccumulator>,
  onEvent: (event: StreamEvent) => void,
  appendContent: (text: string) => void,
  appendThinking: (text: string) => void,
  setUsage: (usage: UsageInfo) => void,
): void {
  // 提取 usage（通常在最后一个 chunk 中）
  if (chunk.usage) {
    setUsage({
      promptTokens: chunk.usage.prompt_tokens,
      completionTokens: chunk.usage.completion_tokens,
      totalTokens: chunk.usage.total_tokens,
    });
  }

  const delta = chunk.choices[0]?.delta;
  if (!delta) return;

  // text content delta
  if (typeof delta.content === "string" && delta.content) {
    appendContent(delta.content);
    onEvent({ type: "text_delta", text: delta.content });
  }

  // thinking delta (extended thinking, e.g. Anthropic)
  if (typeof (delta as Record<string, unknown>).thinking === "string") {
    const thinking = (delta as Record<string, unknown>).thinking as string;
    if (thinking) {
      appendThinking(thinking);
      onEvent({ type: "thinking_delta", thinking });
    }
  }

  // tool call deltas
  if (delta.tool_calls && Array.isArray(delta.tool_calls)) {
    for (const tcDelta of delta.tool_calls) {
      const id = tcDelta.id ?? "";
      const name = tcDelta.function?.name ?? "";
      const argsDelta = tcDelta.function?.arguments ?? "";

      // [DEBUG] 打印 tool call delta 详情
      console.log('[DEBUG][TypeMappers] toolcall_delta:', {
        id,
        name,
        argsDeltaLength: argsDelta.length,
        argsDeltaPreview: argsDelta.slice(0, 100),
        hasId: !!tcDelta.id,
        hasName: !!tcDelta.function?.name,
        hasArgs: !!tcDelta.function?.arguments,
      });

      // 累积工具调用
      if (id && name) {
        // 新的工具调用开始
        if (!toolCallAccumulators.has(id)) {
          toolCallAccumulators.set(id, { id, name, argumentsChunks: [] });
          console.log('[DEBUG][TypeMappers] 新 tool call 累积器创建:', { id, name });
        }
      }

      if (id && argsDelta) {
        const acc = toolCallAccumulators.get(id);
        if (acc) {
          acc.argumentsChunks.push(argsDelta);
        }
      }

      onEvent({
        type: "toolcall_delta",
        toolCall: {
          id: id || (toolCallAccumulators.size > 0 ? [...toolCallAccumulators.keys()].pop()! : ""),
          name,
          argumentsDelta: argsDelta,
        },
      });
    }
  }
}

/**
 * 从累积器构建 ToolCall 数组
 */
export function buildToolCallsFromAccumulators(accumulators: Map<string, ToolCallAccumulator>): ToolCall[] {
  const result: ToolCall[] = [];
  for (const acc of accumulators.values()) {
    const args = acc.argumentsChunks.join("");
    result.push({
      id: acc.id,
      type: "function" as const,
      function: {
        name: acc.name,
        arguments: args,
      },
    });
    // [DEBUG] 打印每个累积器构建的 tool call
    console.log('[DEBUG][TypeMappers] buildToolCall:', {
      id: acc.id,
      name: acc.name,
      chunkCount: acc.argumentsChunks.length,
      totalArgsLength: args.length,
      argsPreview: args.slice(0, 300),
      isValidJSON: (() => { try { JSON.parse(args); return true; } catch { return false; } })(),
    });
  }
  console.log('[DEBUG][TypeMappers] buildToolCallsFromAccumulators 完成, 总数:', result.length);
  return result;
}
