/**
 * StreamingEngine - 流式响应引擎
 *
 * 调用 LLM 流式 API（SSE），解析增量事件（text_delta、thinking_delta、
 * toolcall_delta、done、error），累积内容并通过回调通知。
 * 支持降级为非流式调用和 AbortSignal 取消。
 */

import type { ChatMessage, LLMConfig, ToolCall, ToolDefinition } from "@/lib/llm";
import { callLLM } from "@/lib/llm";
import type { IStreamingEngine, StreamEvent, StreamResult, ToolCallDelta, UsageInfo } from "./types";

/** 工具调用增量累积器 */
interface ToolCallAccumulator {
  id: string;
  name: string;
  argumentsChunks: string[];
}

export class DefaultStreamingEngine implements IStreamingEngine {
  /**
   * 流式调用 LLM
   *
   * 使用 fetch 发起 stream: true 的请求，逐行解析 SSE 事件。
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
      return await this.streamWithFetch(messages, config, tools, signal, onEvent);
    } catch {
      // 降级为非流式调用
      return await this.fallbackToNonStreaming(messages, config, tools, onEvent);
    }
  }

  /**
   * 使用 fetch 发起流式请求
   */
  private async streamWithFetch(
    messages: ChatMessage[],
    config: LLMConfig,
    tools: ToolDefinition[],
    signal: AbortSignal,
    onEvent: (event: StreamEvent) => void,
  ): Promise<StreamResult> {
    const url = `${config.endpoint}/chat/completions`;
    const body = {
      model: config.model,
      messages,
      stream: true,
      ...(config.temperature !== undefined && { temperature: config.temperature }),
      ...(config.maxTokens !== undefined && { max_tokens: config.maxTokens }),
      ...(tools.length > 0 && {
        tools,
        tool_choice: "auto",
      }),
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      throw new Error(`LLM request failed: ${response.status} ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error("No response body for streaming");
    }

    return this.parseSSEStream(response.body, onEvent);
  }

  /**
   * 解析 SSE 流
   */
  private async parseSSEStream(
    body: ReadableStream<Uint8Array>,
    onEvent: (event: StreamEvent) => void,
  ): Promise<StreamResult> {
    let content = "";
    let thinking = "";
    const toolCallAccumulators = new Map<string, ToolCallAccumulator>();
    let usage: UsageInfo | undefined;
    let model = "";

    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // 保留未完成的行

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          const data = trimmed.slice(6); // 去掉 "data: "
          if (data === "[DONE]") {
            // 流结束
            continue;
          }

          try {
            const chunk = JSON.parse(data);
            this.processSSEChunk(chunk, onEvent, (text) => { content += text; }, (think) => { thinking += think; }, toolCallAccumulators, (u) => { usage = u; }, (m) => { model = m; });
          } catch {
            // 忽略无法解析的行
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // 发出 done 事件
    const toolCalls = this.buildToolCalls(toolCallAccumulators);
    onEvent({ type: "done", usage });

    return { content, thinking: thinking || undefined, toolCalls, usage, model };
  }

  /**
   * 处理单个 SSE chunk
   */
  private processSSEChunk(
    chunk: Record<string, unknown>,
    onEvent: (event: StreamEvent) => void,
    appendContent: (text: string) => void,
    appendThinking: (text: string) => void,
    toolCallAccumulators: Map<string, ToolCallAccumulator>,
    setUsage: (usage: UsageInfo) => void,
    setModel: (model: string) => void,
  ): void {
    // 提取 model
    if (typeof chunk.model === "string") {
      setModel(chunk.model);
    }

    // 提取 usage
    if (chunk.usage && typeof chunk.usage === "object") {
      const u = chunk.usage as Record<string, unknown>;
      setUsage({
        promptTokens: typeof u.prompt_tokens === "number" ? u.prompt_tokens : 0,
        completionTokens: typeof u.completion_tokens === "number" ? u.completion_tokens : 0,
        totalTokens: typeof u.total_tokens === "number" ? u.total_tokens : 0,
      });
    }

    const choices = chunk.choices as Array<Record<string, unknown>> | undefined;
    if (!choices || choices.length === 0) return;

    const choice = choices[0];
    const delta = choice.delta as Record<string, unknown> | undefined;
    if (!delta) return;

    // text content delta
    if (typeof delta.content === "string" && delta.content) {
      appendContent(delta.content);
      onEvent({ type: "text_delta", text: delta.content });
    }

    // thinking delta (extended thinking, e.g. Anthropic)
    if (typeof delta.thinking === "string" && delta.thinking) {
      appendThinking(delta.thinking);
      onEvent({ type: "thinking_delta", thinking: delta.thinking });
    }

    // tool call deltas
    const toolCallDeltas = delta.tool_calls as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(toolCallDeltas)) {
      for (const tcDelta of toolCallDeltas) {
        const id = String(tcDelta.id ?? "");
        const fn = tcDelta.function as Record<string, unknown> | undefined;
        const name = fn && typeof fn.name === "string" ? fn.name : "";
        const argsDelta = fn && typeof fn.arguments === "string" ? fn.arguments : "";

        // 累积工具调用
        if (id && name) {
          // 新的工具调用开始
          if (!toolCallAccumulators.has(id)) {
            toolCallAccumulators.set(id, { id, name, argumentsChunks: [] });
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
          toolCall: { id: id || (toolCallAccumulators.size > 0 ? [...toolCallAccumulators.keys()].pop()! : ""), name, argumentsDelta: argsDelta },
        });
      }
    }
  }

  /**
   * 从累积器构建 ToolCall 数组
   */
  private buildToolCalls(accumulators: Map<string, ToolCallAccumulator>): ToolCall[] {
    const result: ToolCall[] = [];
    for (const acc of accumulators.values()) {
      result.push({
        id: acc.id,
        type: "function",
        function: {
          name: acc.name,
          arguments: acc.argumentsChunks.join(""),
        },
      });
    }
    return result;
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
    const response = await callLLM(messages, config, {
      tools: tools.length > 0 ? tools : undefined,
      toolChoice: tools.length > 0 ? "auto" : undefined,
    });

    // 模拟流式事件
    if (response.content) {
      onEvent({ type: "text_delta", text: response.content });
    }

    onEvent({ type: "done", usage: response.usage });

    return {
      content: response.content,
      toolCalls: response.toolCalls ?? [],
      usage: response.usage,
      model: response.model,
    };
  }
}
