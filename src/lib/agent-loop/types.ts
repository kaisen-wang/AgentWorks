/**
 * Agent Loop 运行时 - 公共类型定义
 *
 * 参考 pi 项目的 agent-loop 设计，定义双层循环架构所需的全部类型。
 */

import type { ChatMessage, LLMConfig, ToolCall, ToolDefinition } from "@/lib/llm";

// ============================================================
// Agent Message 类型
// ============================================================

/** Agent 消息角色 */
export type AgentMessageRole = "system" | "user" | "assistant" | "tool";

/** Agent 消息（内部格式，比 ChatMessage 更丰富） */
export interface AgentMessage {
  id: string;
  role: AgentMessageRole;
  content: string;
  /** 思考内容（extended thinking） */
  thinking?: string;
  /** assistant 消息中的工具调用 */
  toolCalls?: ToolCall[];
  /** tool 消息关联的 tool_call_id */
  toolCallId?: string;
  /** tool 消息的工具名称 */
  toolName?: string;
  /** 工具执行是否出错 */
  isError?: boolean;
  timestamp: number;
}

// ============================================================
// Agent Loop 配置
// ============================================================

/** 工具执行模式 */
export type ToolExecutionMode = "parallel" | "sequential";

/** 队列排空模式 */
export type QueueDrainMode = "all" | "one-at-a-time";

/** 上下文转换函数 */
export type TransformContextFn = (messages: AgentMessage[]) => AgentMessage[] | Promise<AgentMessage[]>;

/** 工具执行前钩子上下文 */
export interface BeforeToolCallContext {
  toolCall: ToolCall;
  args: string;
}

/** 工具执行前钩子结果 */
export interface BeforeToolCallResult {
  /** 是否阻止执行 */
  block?: boolean;
  /** 阻止原因 */
  reason?: string;
  /** 修改后的参数（JSON 字符串） */
  modifiedArgs?: string;
}

/** 工具执行前钩子 */
export type BeforeToolCallFn = (
  context: BeforeToolCallContext,
  signal?: AbortSignal,
) => Promise<BeforeToolCallResult | undefined> | BeforeToolCallResult | undefined;

/** 工具执行后钩子上下文 */
export interface AfterToolCallContext {
  toolCall: ToolCall;
  args: string;
  result: LoopToolExecutionResult;
  isError: boolean;
}

/** 工具执行后钩子结果 */
export interface AfterToolCallResult {
  /** 修改后的输出内容 */
  output?: string;
  /** 修改后的 terminate 标志 */
  terminate?: boolean;
  /** 修改后的 isError 标志 */
  isError?: boolean;
}

/** 工具执行后钩子 */
export type AfterToolCallFn = (
  context: AfterToolCallContext,
  signal?: AbortSignal,
) => Promise<AfterToolCallResult | undefined> | AfterToolCallResult | undefined;

/** Turn 间上下文准备钩子结果 */
export interface PrepareNextTurnResult {
  /** 覆盖模型 */
  model?: string;
  /** 覆盖 system prompt */
  systemPrompt?: string;
  /** 覆盖 reasoning 配置 */
  reasoning?: unknown;
}

/** Turn 上下文 */
export interface TurnContext {
  turnNumber: number;
  iteration: number;
  transcript: readonly AgentMessage[];
  lastAssistantMessage: AgentMessage | null;
}

/** Turn 间上下文准备钩子 */
export type PrepareNextTurnFn = (
  context: TurnContext,
  signal?: AbortSignal,
) => Promise<PrepareNextTurnResult | undefined> | PrepareNextTurnResult | undefined;

/** 自定义停止条件钩子 */
export type ShouldStopAfterTurnFn = (
  context: TurnContext,
) => Promise<boolean> | boolean;

/** Transcript 持久化回调 */
export type PersistTranscriptFn = (message: AgentMessage, seq: number) => void | Promise<void>;

/** Agent Loop 完整配置 */
export interface AgentLoopConfig {
  systemPrompt: string;
  llmConfig: LLMConfig;
  tools?: ToolDefinition[];
  /** 最大迭代次数，默认 50 */
  maxIterations?: number;
  /** 工具执行模式，默认 "parallel" */
  toolExecutionMode?: ToolExecutionMode;
  /** 上下文转换函数 */
  transformContext?: TransformContextFn;
  /** 工具执行前钩子 */
  beforeToolCall?: BeforeToolCallFn;
  /** 工具执行后钩子 */
  afterToolCall?: AfterToolCallFn;
  /** Turn 间上下文准备钩子 */
  prepareNextTurn?: PrepareNextTurnFn;
  /** 自定义停止条件钩子 */
  shouldStopAfterTurn?: ShouldStopAfterTurnFn;
  /** steering 队列排空模式，默认 "all" */
  steeringDrainMode?: QueueDrainMode;
  /** follow-up 队列排空模式，默认 "all" */
  followUpDrainMode?: QueueDrainMode;
  /** 预加载的 transcript（用于重启后恢复上下文） */
  initialTranscript?: AgentMessage[];
  /** Transcript 持久化回调（每新增一条消息时调用） */
  persistCallback?: PersistTranscriptFn;
}

// ============================================================
// Agent Loop 状态
// ============================================================

/** Agent Loop 运行状态 */
export type AgentLoopStatus = "idle" | "running" | "error" | "cancelled";

/** Agent Loop 状态快照（只读） */
export interface AgentLoopState {
  status: AgentLoopStatus;
  transcript: readonly AgentMessage[];
  streamingMessage: AgentMessage | null;
  pendingToolCalls: readonly ToolCall[];
  errorMessage: string | null;
  currentIteration: number;
  currentTurn: number;
  isStreaming: boolean;
}

// ============================================================
// 工具执行结果
// ============================================================

/** 工具执行结果（Agent Loop 内部格式） */
export interface LoopToolExecutionResult {
  toolCallId: string;
  toolName: string;
  output: string;
  isError: boolean;
  /** 终止信号 */
  terminate: boolean;
  /** 执行耗时 ms */
  duration: number;
}

// ============================================================
// 生命周期事件
// ============================================================

/** 生命周期事件类型 */
export type LifecycleEventType =
  | "agent_start"
  | "turn_start"
  | "message_start"
  | "message_update"
  | "message_end"
  | "tool_execution_start"
  | "tool_execution_update"
  | "tool_execution_end"
  | "turn_end"
  | "agent_end";

/** 各事件类型对应的数据类型映射 */
export interface EventDataMap {
  agent_start: { systemPrompt: string };
  turn_start: { turnNumber: number; iteration: number };
  message_start: { role: AgentMessageRole };
  message_update: { delta: string; deltaType: "text" | "thinking" | "tool_call" };
  message_end: { message: AgentMessage; error?: string };
  tool_execution_start: { toolCallId: string; toolName: string; args: string };
  tool_execution_update: { toolCallId: string; progress: string };
  tool_execution_end: { toolCallId: string; toolName: string; result: LoopToolExecutionResult };
  turn_end: { turnNumber: number; iteration: number; duration: number; toolCallCount: number };
  agent_end: { status: AgentLoopStatus; reason: string; totalIterations: number; totalTurns: number };
}

/** 生命周期事件 */
export interface LifecycleEvent {
  type: LifecycleEventType;
  data: EventDataMap[LifecycleEventType];
  timestamp: number;
}

// ============================================================
// Agent Loop 结果
// ============================================================

/** Agent Loop 运行结果 */
export interface AgentLoopResult {
  status: AgentLoopStatus;
  transcript: AgentMessage[];
  lastAssistantMessage: AgentMessage | null;
  totalIterations: number;
  totalTurns: number;
  errorMessage: string | null;
  stopReason: string;
}

// ============================================================
// 事件订阅
// ============================================================

/** 事件回调类型 */
export type EventCallback = (event: LifecycleEvent) => void;

/** 取消订阅函数 */
export type UnsubscribeFn = () => void;

// ============================================================
// 流式引擎接口
// ============================================================

/** 流式事件增量 - 工具调用 */
export interface ToolCallDelta {
  id: string;
  name: string;
  argumentsDelta: string;
}

/** 流式事件 */
export type StreamEvent =
  | { type: "text_delta"; text: string }
  | { type: "thinking_delta"; thinking: string }
  | { type: "toolcall_delta"; toolCall: ToolCallDelta }
  | { type: "done"; usage?: UsageInfo }
  | { type: "error"; error: string };

/** 用量信息 */
export interface UsageInfo {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/** 流式结果 */
export interface StreamResult {
  content: string;
  thinking?: string;
  toolCalls: ToolCall[];
  usage?: UsageInfo;
  model: string;
}

/** 流式引擎接口 */
export interface IStreamingEngine {
  streamResponse(
    messages: ChatMessage[],
    config: LLMConfig,
    tools: ToolDefinition[],
    signal: AbortSignal,
    onEvent: (event: StreamEvent) => void,
  ): Promise<StreamResult>;
}

// ============================================================
// 工具执行器接口
// ============================================================

/** 工具执行钩子 */
export interface ToolExecutionHooks {
  beforeToolCall?: BeforeToolCallFn;
  afterToolCall?: AfterToolCallFn;
}

/** 工具执行器接口 */
export interface IToolExecutor {
  executeToolCall(
    toolCall: ToolCall,
    hooks: ToolExecutionHooks,
    signal: AbortSignal,
  ): Promise<LoopToolExecutionResult>;

  executeToolCalls(
    toolCalls: ToolCall[],
    mode: ToolExecutionMode,
    hooks: ToolExecutionHooks,
    signal: AbortSignal,
  ): Promise<LoopToolExecutionResult[]>;
}
