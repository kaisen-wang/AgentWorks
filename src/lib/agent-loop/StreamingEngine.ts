/**
 * StreamingEngine - 流式响应引擎
 *
 * 使用 OpenAI SDK 的流式迭代器替代手动 SSE 解析，
 * 解析增量事件（text_delta、thinking_delta、toolcall_delta、done、error），
 * 累积内容并通过回调通知。
 * 支持降级为非流式调用和 AbortSignal 取消。
 */

import type { ChatMessage, LLMConfig, ToolCall, ToolDefinition } from "@/lib/llm";
import { callLLM } from "@/lib/llm";
import { OpenAIClientFactory } from "@/lib/llm/OpenAIClientFactory";
import { toSDKMessages, toSDKTools, toSDKToolChoice, fromSDKStreamChunk, buildToolCallsFromAccumulators } from "@/lib/llm/TypeMappers";
import type { ToolCallAccumulator } from "@/lib/llm/TypeMappers";
import type { IStreamingEngine, StreamEvent, StreamResult, UsageInfo } from "./types";
import type { ChatCompletionCreateParamsStreaming } from "openai/resources/chat/completions/completions";

export class DefaultStreamingEngine implements IStreamingEngine {
  /**
   * 流式调用 LLM
   *
   * 使用 OpenAI SDK 的流式迭代器替代手动 SSE 解析。
   * 若流式请求失败，降级为 callLLM 非流式调用。
   */
  async streamResponse(
    messages: ChatMessage[],
    config: LLMConfig,
    tools: ToolDefinition[],
    signal: AbortSignal,
    onEvent: (event: StreamEvent) => void,
  ): Promise<StreamResult> {
    try {
      return await this.streamWithSDK(messages, config, tools, signal, onEvent);
    } catch {
      // 降级为非流式调用
      return await this.fallbackToNonStreaming(messages, config, tools, onEvent);
    }
  }

  /**
   * 使用 OpenAI SDK 流式迭代器
   */
  private async streamWithSDK(
    messages: ChatMessage[],
    config: LLMConfig,
    tools: ToolDefinition[],
    signal: AbortSignal,
    onEvent: (event: StreamEvent) => void,
  ): Promise<StreamResult> {
    const client = OpenAIClientFactory.getClient(config);
    const sdkMessages = toSDKMessages(messages);

    const createParams: ChatCompletionCreateParamsStreaming = {
      model: config.model,
      messages: sdkMessages,
      stream: true,
      ...(config.temperature !== undefined && { temperature: config.temperature }),
      ...(config.maxTokens !== undefined && { max_tokens: config.maxTokens }),
      ...(tools.length > 0 && {
        tools: toSDKTools(tools),
        tool_choice: toSDKToolChoice("auto"),
      }),
    };

    // 传递 AbortSignal
    (createParams as unknown as Record<string, unknown>).signal = signal;

    // [DEBUG] 打印 LLM 流式请求参数
    console.log('[DEBUG][StreamingEngine] LLM 流式请求参数:', {
      model: createParams.model,
      messageCount: sdkMessages.length,
      messageRoles: sdkMessages.map(m => m.role),
      hasTools: !!(createParams.tools && createParams.tools.length > 0),
      toolCount: createParams.tools?.length ?? 0,
      toolNames: createParams.tools?.map(t => t.function?.name) ?? [],
      toolChoice: createParams.tool_choice,
      temperature: createParams.temperature,
      maxTokens: createParams.max_tokens,
    });

    const stream = await client.chat.completions.create(createParams);

    let content = "";
    let thinking = "";
    const toolCallAccumulators = new Map<string, ToolCallAccumulator>();
    let usage: UsageInfo | undefined;
    let model = "";

    // 使用 SDK 流式迭代器遍历响应
    for await (const chunk of stream) {
      // 提取 model
      if (chunk.model) {
        model = chunk.model;
      }

      // 使用 TypeMappers 处理每个 chunk
      fromSDKStreamChunk(
        chunk,
        toolCallAccumulators,
        onEvent,
        (text) => { content += text; },
        (think) => { thinking += think; },
        (u) => { usage = u; },
      );
    }

    // 发出 done 事件
    const toolCalls = buildToolCallsFromAccumulators(toolCallAccumulators);
    onEvent({ type: "done", usage });

    // [DEBUG] 打印流式响应结果摘要
    console.log('[DEBUG][StreamingEngine] 流式响应结果:', {
      model,
      contentLength: content.length,
      contentPreview: content.slice(0, 200),
      thinkingLength: thinking.length,
      toolCallCount: toolCalls.length,
      toolCalls: toolCalls.map(tc => ({
        id: tc.id,
        name: tc.function.name,
        argsLength: tc.function.arguments.length,
        argsPreview: tc.function.arguments.slice(0, 200),
      })),
      usage,
    });

    return { content, thinking: thinking || undefined, toolCalls, usage, model };
  }

  /**
   * 降级为非流式调用
   */
  private async fallbackToNonStreaming(
    messages: ChatMessage[],
    config: LLMConfig,
    tools: ToolDefinition[],
    onEvent: (event: StreamEvent) => void,
  ): Promise<StreamResult> {
    console.log('[DEBUG][StreamingEngine] 降级为非流式调用, tools数量:', tools.length);

    const response = await callLLM(messages, config, {
      tools: tools.length > 0 ? tools : undefined,
      toolChoice: tools.length > 0 ? "auto" : undefined,
    });

    // 模拟流式事件
    if (response.content) {
      onEvent({ type: "text_delta", text: response.content });
    }

    onEvent({ type: "done", usage: response.usage });

    // [DEBUG] 打印非流式降级响应结果
    console.log('[DEBUG][StreamingEngine] 非流式降级响应结果:', {
      model: response.model,
      contentLength: response.content.length,
      contentPreview: response.content.slice(0, 200),
      toolCallCount: response.toolCalls?.length ?? 0,
      toolCalls: response.toolCalls?.map(tc => ({
        id: tc.id,
        name: tc.function.name,
        argsLength: tc.function.arguments.length,
        argsPreview: tc.function.arguments.slice(0, 200),
      })),
      usage: response.usage,
    });

    return {
      content: response.content,
      toolCalls: response.toolCalls ?? [],
      usage: response.usage,
      model: response.model,
    };
  }
}
