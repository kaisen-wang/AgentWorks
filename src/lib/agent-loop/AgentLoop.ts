/**
 * AgentLoop - 双层循环控制器
 *
 * 协调双层循环（外层 follow-up + 内层 tool calls），
 * 管理 transcript 和状态，集成 EventEmitter、StreamingEngine、
 * ToolExecutor、PendingMessageQueue、TurnManager。
 */

import type { ChatMessage, ToolCall } from "@/lib/llm";
import { AgentEventEmitter } from "./EventEmitter";
import { PendingMessageQueue } from "./PendingMessageQueue";
import { TurnManager } from "./TurnManager";
import type {
  AfterToolCallFn,
  AgentLoopConfig,
  AgentLoopResult,
  AgentLoopState,
  AgentLoopStatus,
  AgentMessage,
  BeforeToolCallFn,
  EventCallback,
  IStreamingEngine,
  IToolExecutor,
  LifecycleEvent,
  LoopToolExecutionResult,
  PrepareNextTurnFn,
  QueueDrainMode,
  ShouldStopAfterTurnFn,
  StreamEvent,
  ToolExecutionHooks,
  ToolExecutionMode,
  TransformContextFn,
  UnsubscribeFn,
} from "./types";
import { DefaultToolExecutor } from "./ToolExecutor";
import { DefaultStreamingEngine } from "./StreamingEngine";

/** 默认最大迭代次数 */
const DEFAULT_MAX_ITERATIONS = 50;

/** 生成唯一 ID */
function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** 创建 AgentMessage */
function createMessage(
  role: AgentMessage["role"],
  content: string,
  overrides?: Partial<AgentMessage>,
): AgentMessage {
  return {
    id: generateId(),
    role,
    content,
    timestamp: Date.now(),
    ...overrides,
  };
}

/** 将 AgentMessage 转为 ChatMessage（LLM 兼容格式） */
function convertToChatMessage(msg: AgentMessage): ChatMessage {
  if (msg.role === "tool") {
    return {
      role: "tool",
      content: msg.content,
      tool_call_id: msg.toolCallId,
      name: msg.toolName,
    };
  }
  if (msg.role === "assistant") {
    return {
      role: "assistant",
      content: msg.content,
      ...(msg.toolCalls && msg.toolCalls.length > 0 && { tool_calls: msg.toolCalls }),
    };
  }
  return {
    role: msg.role,
    content: msg.content,
  };
}

export class AgentLoop {
  // 配置
  private readonly config: AgentLoopConfig;
  private readonly maxIterations: number;
  private readonly toolExecutionMode: ToolExecutionMode;

  // 子模块
  private readonly eventEmitter: AgentEventEmitter;
  private readonly streamingEngine: IStreamingEngine;
  private readonly toolExecutor: IToolExecutor;
  private readonly steeringQueue: PendingMessageQueue;
  private readonly followUpQueue: PendingMessageQueue;
  private readonly turnManager: TurnManager;

  // 钩子
  private readonly transformContext?: TransformContextFn;
  private readonly beforeToolCall?: BeforeToolCallFn;
  private readonly afterToolCall?: AfterToolCallFn;

  // 运行时状态
  private transcript: AgentMessage[] = [];
  private streamingMessage: AgentMessage | null = null;
  private pendingToolCalls: ToolCall[] = [];
  private errorMessage: string | null = null;
  private status: AgentLoopStatus = "idle";
  private currentIteration = 0;
  private currentTurn = 0;
  private isStreaming = false;

  // 运行控制
  private abortController: AbortController | null = null;

  constructor(
    config: AgentLoopConfig,
    toolExecutor?: IToolExecutor,
    streamingEngine?: IStreamingEngine,
  ) {
    this.config = config;
    this.maxIterations = config.maxIterations ?? DEFAULT_MAX_ITERATIONS;
    this.toolExecutionMode = config.toolExecutionMode ?? "parallel";

    this.eventEmitter = new AgentEventEmitter();
    this.streamingEngine = streamingEngine ?? new DefaultStreamingEngine();
    this.toolExecutor = toolExecutor ?? new DefaultToolExecutor();
    this.steeringQueue = new PendingMessageQueue(config.steeringDrainMode ?? "all");
    this.followUpQueue = new PendingMessageQueue(config.followUpDrainMode ?? "all");
    this.turnManager = new TurnManager(config.prepareNextTurn, config.shouldStopAfterTurn);

    this.transformContext = config.transformContext;
    this.beforeToolCall = config.beforeToolCall;
    this.afterToolCall = config.afterToolCall;
  }

  /**
   * 启动 Agent Loop
   *
   * 双层循环：
   * - 外层：检查 follow-up 队列，有则注入消息继续
   * - 内层：调用 LLM，处理 tool calls，直到无 tool calls
   */
  async run(message: string): Promise<AgentLoopResult> {
    // 验证初始消息非空
    if (!message || message.trim().length === 0) {
      throw new Error("Initial message cannot be empty");
    }

    // 防止重复运行
    if (this.status === "running") {
      throw new Error("AgentLoop is already running");
    }

    // 初始化
    this.resetState();
    this.abortController = new AbortController();
    this.status = "running";
    this.isStreaming = true;

    const signal = this.abortController.signal;

    // 初始化 transcript
    this.transcript = [
      createMessage("system", this.config.systemPrompt),
      createMessage("user", message),
    ];

    // 发出 agent_start
    this.emit({
      type: "agent_start",
      data: { systemPrompt: this.config.systemPrompt },
      timestamp: Date.now(),
    });

    let stopReason = "completed";

    try {
      // 外层循环
      while (true) {
        if (signal.aborted) {
          stopReason = "cancelled";
          break;
        }

        // 内层循环
        let hasMoreToolCalls = true;
        let pendingSteering = this.steeringQueue.drain();

        while (hasMoreToolCalls || pendingSteering.length > 0) {
          if (signal.aborted) {
            stopReason = "cancelled";
            break;
          }

          // 注入 steering 消息
          if (pendingSteering.length > 0) {
            for (const steeringMsg of pendingSteering) {
              const msg = createMessage("user", steeringMsg);
              this.transcript.push(msg);
              this.emit({ type: "message_start", data: { role: "user" }, timestamp: Date.now() });
              this.emit({ type: "message_end", data: { message: msg }, timestamp: Date.now() });
            }
            pendingSteering = [];
          }

          // 发出 turn_start
          this.currentTurn++;
          this.emit({
            type: "turn_start",
            data: { turnNumber: this.currentTurn, iteration: this.currentIteration },
            timestamp: Date.now(),
          });

          const turnStartTime = Date.now();

          // 流式调用 LLM
          const assistantMessage = await this.streamAssistantResponse(signal);

          if (assistantMessage.role === "assistant" && assistantMessage.content) {
            this.transcript.push(assistantMessage);
          }

          // 检查错误/取消（status 可能被 streamAssistantResponse 内部的 error 事件修改）
          if ((this.status as AgentLoopStatus) === "error" || signal.aborted) {
            if (signal.aborted) stopReason = "cancelled";
            this.emit({
              type: "turn_end",
              data: {
                turnNumber: this.currentTurn,
                iteration: this.currentIteration,
                duration: Date.now() - turnStartTime,
                toolCallCount: 0,
              },
              timestamp: Date.now(),
            });
            break;
          }

          // 检查 tool calls
          const toolCalls = assistantMessage.toolCalls ?? [];
          const toolResults: LoopToolExecutionResult[] = [];
          hasMoreToolCalls = false;

          if (toolCalls.length > 0) {
            // 执行工具调用
            const hooks: ToolExecutionHooks = {
              beforeToolCall: this.beforeToolCall,
              afterToolCall: this.afterToolCall,
            };

            // 发出 tool_execution_start 事件
            for (const tc of toolCalls) {
              this.emit({
                type: "tool_execution_start",
                data: { toolCallId: tc.id, toolName: tc.function.name, args: tc.function.arguments },
                timestamp: Date.now(),
              });
            }

            const executedResults = await this.toolExecutor.executeToolCalls(
              toolCalls,
              this.toolExecutionMode,
              hooks,
              signal,
            );

            // 处理工具结果
            for (const result of executedResults) {
              toolResults.push(result);

              // 发出 tool_execution_end 事件
              this.emit({
                type: "tool_execution_end",
                data: { toolCallId: result.toolCallId, toolName: result.toolName, result },
                timestamp: Date.now(),
              });

              // 追加 tool result 消息到 transcript
              const toolMsg = createMessage("tool", result.output, {
                toolCallId: result.toolCallId,
                toolName: result.toolName,
                isError: result.isError,
              });
              this.transcript.push(toolMsg);
              this.emit({ type: "message_start", data: { role: "tool" }, timestamp: Date.now() });
              this.emit({ type: "message_end", data: { message: toolMsg }, timestamp: Date.now() });
            }

            // 检查 terminate 信号
            const shouldTerminate = executedResults.some((r) => r.terminate);
            if (shouldTerminate) {
              stopReason = "tool_terminated";
              hasMoreToolCalls = false;
            } else {
              hasMoreToolCalls = true;
            }
          }

          // 发出 turn_end
          this.emit({
            type: "turn_end",
            data: {
              turnNumber: this.currentTurn,
              iteration: this.currentIteration,
              duration: Date.now() - turnStartTime,
              toolCallCount: toolResults.length,
            },
            timestamp: Date.now(),
          });

          this.currentIteration++;

          // 检查最大迭代次数
          if (this.currentIteration >= this.maxIterations) {
            stopReason = "max_iterations_reached";
            break;
          }

          // 检查 shouldStopAfterTurn
          const turnContext = this.createTurnContext(assistantMessage);
          if (await this.turnManager.shouldStopAfterTurn(turnContext)) {
            stopReason = "should_stop_after_turn";
            break;
          }

          // prepareNextTurn
          const nextTurnResult = await this.turnManager.prepareNextTurn(turnContext);
          if (nextTurnResult.model) {
            this.config.llmConfig.model = nextTurnResult.model;
          }
          if (nextTurnResult.systemPrompt) {
            this.config.systemPrompt = nextTurnResult.systemPrompt;
          }

          // 检查 steering 消息
          pendingSteering = this.steeringQueue.drain();
        }

        // 内层循环结束，检查是否需要跳出外层
        if (stopReason !== "completed") break;

        // 检查 follow-up 消息
        const followUpMessages = this.followUpQueue.drain();
        if (followUpMessages.length > 0) {
          for (const followUpMsg of followUpMessages) {
            const msg = createMessage("user", followUpMsg);
            this.transcript.push(msg);
            this.emit({ type: "message_start", data: { role: "user" }, timestamp: Date.now() });
            this.emit({ type: "message_end", data: { message: msg }, timestamp: Date.now() });
          }
          continue; // 继续外层循环
        }

        // 无 follow-up 消息，退出外层循环
        break;
      }
    } catch (err) {
      this.status = "error";
      this.errorMessage = err instanceof Error ? err.message : String(err);
      stopReason = "error";
    }

    // 最终状态
    this.isStreaming = false;
    this.streamingMessage = null;
    if (this.status === "running") {
      this.status = stopReason === "cancelled" ? "cancelled" : "idle";
    }

    // 发出 agent_end
    this.emit({
      type: "agent_end",
      data: {
        status: this.status,
        reason: stopReason,
        totalIterations: this.currentIteration,
        totalTurns: this.currentTurn,
      },
      timestamp: Date.now(),
    });

    // 返回结果
    const lastAssistantMessage = this.findLastAssistantMessage();
    return {
      status: this.status,
      transcript: [...this.transcript],
      lastAssistantMessage,
      totalIterations: this.currentIteration,
      totalTurns: this.currentTurn,
      errorMessage: this.errorMessage,
      stopReason,
    };
  }

  /**
   * 取消 Agent Loop
   */
  abort(): void {
    this.abortController?.abort();
  }

  /**
   * 获取当前状态快照（只读）
   */
  getState(): AgentLoopState {
    return {
      status: this.status,
      transcript: [...this.transcript],
      streamingMessage: this.streamingMessage,
      pendingToolCalls: [...this.pendingToolCalls],
      errorMessage: this.errorMessage,
      currentIteration: this.currentIteration,
      currentTurn: this.currentTurn,
      isStreaming: this.isStreaming,
    };
  }

  /**
   * 添加 steering 消息
   */
  addSteeringMessage(message: string): void {
    this.steeringQueue.push(message);
  }

  /**
   * 添加 follow-up 消息
   */
  addFollowUpMessage(message: string): void {
    this.followUpQueue.push(message);
  }

  /**
   * 订阅生命周期事件
   */
  on(callback: EventCallback): UnsubscribeFn {
    return this.eventEmitter.on(callback);
  }

  /**
   * 取消订阅生命周期事件
   */
  off(callback: EventCallback): void {
    this.eventEmitter.off(callback);
  }

  // ---- 私有方法 ----

  private resetState(): void {
    this.transcript = [];
    this.streamingMessage = null;
    this.pendingToolCalls = [];
    this.errorMessage = null;
    this.status = "idle";
    this.currentIteration = 0;
    this.currentTurn = 0;
    this.isStreaming = false;
  }

  private emit(event: LifecycleEvent): void {
    this.eventEmitter.emit(event);
  }

  /**
   * 流式调用 LLM 并构建 assistant 消息
   */
  private async streamAssistantResponse(signal: AbortSignal): Promise<AgentMessage> {
    // 应用 transformContext
    let messages = this.transcript;
    if (this.transformContext) {
      messages = await this.transformContext(messages);
    }

    // 转为 LLM 兼容格式
    const chatMessages: ChatMessage[] = messages.map(convertToChatMessage);

    // 流式调用
    let content = "";
    let thinking = "";
    const toolCallMap = new Map<string, { id: string; name: string; args: string[] }>();

    const streamResult = await this.streamingEngine.streamResponse(
      chatMessages,
      this.config.llmConfig,
      this.config.tools ?? [],
      signal,
      (event: StreamEvent) => {
        switch (event.type) {
          case "text_delta":
            content += event.text;
            this.streamingMessage = createMessage("assistant", content);
            this.emit({
              type: "message_update",
              data: { delta: event.text, deltaType: "text" },
              timestamp: Date.now(),
            });
            break;

          case "thinking_delta":
            thinking += event.thinking;
            this.emit({
              type: "message_update",
              data: { delta: event.thinking, deltaType: "thinking" },
              timestamp: Date.now(),
            });
            break;

          case "toolcall_delta": {
            const tc = event.toolCall;
            if (tc.id && tc.name) {
              toolCallMap.set(tc.id, { id: tc.id, name: tc.name, args: [] });
            }
            if (tc.id && tc.argumentsDelta) {
              const acc = toolCallMap.get(tc.id);
              if (acc) acc.args.push(tc.argumentsDelta);
            }
            this.emit({
              type: "message_update",
              data: { delta: tc.argumentsDelta, deltaType: "tool_call" },
              timestamp: Date.now(),
            });
            break;
          }

          case "error":
            this.errorMessage = event.error;
            this.status = "error";
            break;
        }
      },
    );

    // 发出 message_start 和 message_end
    const toolCalls: ToolCall[] = [];
    for (const acc of toolCallMap.values()) {
      toolCalls.push({
        id: acc.id,
        type: "function",
        function: { name: acc.name, arguments: acc.args.join("") },
      });
    }

    // 使用 streamResult 中的 toolCalls（更完整）
    const finalToolCalls = streamResult.toolCalls.length > 0 ? streamResult.toolCalls : toolCalls;

    const assistantMessage = createMessage("assistant", streamResult.content || content, {
      thinking: streamResult.thinking || thinking || undefined,
      toolCalls: finalToolCalls.length > 0 ? finalToolCalls : undefined,
    });

    this.emit({ type: "message_start", data: { role: "assistant" }, timestamp: Date.now() });
    this.emit({ type: "message_end", data: { message: assistantMessage }, timestamp: Date.now() });

    this.streamingMessage = null;
    return assistantMessage;
  }

  private createTurnContext(lastAssistantMessage: AgentMessage) {
    return {
      turnNumber: this.currentTurn,
      iteration: this.currentIteration,
      transcript: this.transcript,
      lastAssistantMessage,
    };
  }

  private findLastAssistantMessage(): AgentMessage | null {
    for (let i = this.transcript.length - 1; i >= 0; i--) {
      if (this.transcript[i].role === "assistant") {
        return this.transcript[i];
      }
    }
    return null;
  }
}
