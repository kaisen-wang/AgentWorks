/**
 * 集成测试 - 覆盖 spec.md 中的 8 个验收测试场景
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { AgentLoop } from "./AgentLoop";
import type {
  AgentLoopConfig,
  AgentLoopResult,
  IStreamingEngine,
  IToolExecutor,
  LifecycleEvent,
  LoopToolExecutionResult,
  StreamResult,
} from "./types";
import type { LLMConfig, ToolCall } from "@/lib/llm";

// Mock AgentTools and LLM
vi.mock("@/lib/agent/AgentTools", () => ({
  executeToolCall: vi.fn(),
  getAgentToolDefinitions: vi.fn().mockReturnValue([]),
}));
vi.mock("@/lib/llm", () => ({
  callLLM: vi.fn(),
}));

const defaultLLMConfig: LLMConfig = {
  endpoint: "https://api.example.com/v1",
  apiKey: "test-key",
  model: "test-model",
};

function makeConfig(overrides?: Partial<AgentLoopConfig>): AgentLoopConfig {
  return {
    systemPrompt: "You are a helpful assistant.",
    llmConfig: defaultLLMConfig,
    ...overrides,
  };
}

function makeToolCall(name: string, args: string, id = "tc_1"): ToolCall {
  return { id, type: "function", function: { name, arguments: args } };
}

function createMockStreamingEngine(responses: StreamResult[]): IStreamingEngine {
  let callIndex = 0;
  return {
    streamResponse: vi.fn().mockImplementation(async () => {
      const result = responses[callIndex++] ?? { content: "", toolCalls: [], model: "test-model" };
      return result;
    }),
  };
}

function createMockToolExecutor(results: LoopToolExecutionResult[][]): IToolExecutor {
  let callIndex = 0;
  return {
    executeToolCall: vi.fn(),
    executeToolCalls: vi.fn().mockImplementation(async () => {
      return results[callIndex++] ?? [];
    }),
  };
}

describe("集成测试", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("场景1: 基本工具调用循环", async () => {
    const streamingEngine = createMockStreamingEngine([
      { content: "", toolCalls: [makeToolCall("write_file", '{"file_path":"hello.txt","content":"hello"}', "tc1")], model: "test-model" },
      { content: "I've created hello.txt for you.", toolCalls: [], model: "test-model" },
    ]);

    const toolExecutor = createMockToolExecutor([
      [{ toolCallId: "tc1", toolName: "write_file", output: "File created successfully", isError: false, terminate: false, duration: 10 }],
    ]);

    const events: LifecycleEvent[] = [];
    const loop = new AgentLoop(makeConfig(), toolExecutor, streamingEngine);
    loop.on((e) => events.push(e));

    const result = await loop.run("创建一个 hello.txt 文件");

    expect(result.status).toBe("idle");
    expect(result.stopReason).toBe("completed");
    expect(result.lastAssistantMessage?.content).toBe("I've created hello.txt for you.");
    expect(result.totalIterations).toBe(2);

    // 验证事件序列
    const eventTypes = events.map((e) => e.type);
    expect(eventTypes).toContain("agent_start");
    expect(eventTypes).toContain("agent_end");
    expect(eventTypes).toContain("tool_execution_start");
    expect(eventTypes).toContain("tool_execution_end");
  });

  it("场景2: 多轮工具调用", async () => {
    const streamingEngine = createMockStreamingEngine([
      { content: "", toolCalls: [makeToolCall("read_file", '{"file_path":"config.json"}', "tc1")], model: "test-model" },
      { content: "", toolCalls: [makeToolCall("edit_file", '{"file_path":"config.json","old":"v1","new":"v2"}', "tc2")], model: "test-model" },
      { content: "Config updated successfully.", toolCalls: [], model: "test-model" },
    ]);

    const toolExecutor = createMockToolExecutor([
      [{ toolCallId: "tc1", toolName: "read_file", output: '{"version":"v1"}', isError: false, terminate: false, duration: 10 }],
      [{ toolCallId: "tc2", toolName: "edit_file", output: "File edited", isError: false, terminate: false, duration: 10 }],
    ]);

    const loop = new AgentLoop(makeConfig(), toolExecutor, streamingEngine);
    const result = await loop.run("读取 config.json 并修改版本号");

    expect(result.status).toBe("idle");
    expect(result.totalIterations).toBe(3);
    expect(result.lastAssistantMessage?.content).toBe("Config updated successfully.");
  });

  it("场景3: Follow-up 消息继续循环", async () => {
    const streamingEngine = createMockStreamingEngine([
      { content: "First response", toolCalls: [], model: "test-model" },
      { content: "Follow-up response", toolCalls: [], model: "test-model" },
    ]);

    const loop = new AgentLoop(makeConfig(), undefined, streamingEngine);

    // 在 agent_start 后添加 follow-up
    const waitForStart = new Promise<void>((resolve) => {
      loop.on((e) => {
        if (e.type === "agent_start") {
          loop.addFollowUpMessage("Can you elaborate?");
          resolve();
        }
      });
    });

    const resultPromise = loop.run("Tell me about X");
    await waitForStart;
    const result = await resultPromise;

    expect(result.totalTurns).toBeGreaterThanOrEqual(2);
    // follow-up 消息应在 transcript 中
    const followUpMsg = result.transcript.find((m) => m.role === "user" && m.content === "Can you elaborate?");
    expect(followUpMsg).toBeDefined();
  });

  it("场景4: Steering 消息注入", async () => {
    const streamingEngine = createMockStreamingEngine([
      { content: "", toolCalls: [makeToolCall("read_file", '{"file_path":"a"}', "tc1")], model: "test-model" },
      { content: "After steering", toolCalls: [], model: "test-model" },
    ]);

    const toolExecutor = createMockToolExecutor([
      [{ toolCallId: "tc1", toolName: "read_file", output: "ok", isError: false, terminate: false, duration: 10 }],
    ]);

    const loop = new AgentLoop(makeConfig(), toolExecutor, streamingEngine);
    loop.addSteeringMessage("Focus on this aspect");

    const result = await loop.run("Read the file");

    const steeringMsg = result.transcript.find((m) => m.role === "user" && m.content === "Focus on this aspect");
    expect(steeringMsg).toBeDefined();
  });

  it("场景5: 工具终止信号", async () => {
    const streamingEngine = createMockStreamingEngine([
      { content: "", toolCalls: [makeToolCall("read_file", '{"file_path":"a"}', "tc1")], model: "test-model" },
    ]);

    const toolExecutor = createMockToolExecutor([
      [{ toolCallId: "tc1", toolName: "read_file", output: "done", isError: false, terminate: true, duration: 10 }],
    ]);

    const loop = new AgentLoop(makeConfig(), toolExecutor, streamingEngine);
    const result = await loop.run("Read and stop");

    expect(result.stopReason).toBe("tool_terminated");
    // 已执行的工具结果仍在 transcript 中
    const toolMsg = result.transcript.find((m) => m.role === "tool" && m.content === "done");
    expect(toolMsg).toBeDefined();
  });

  it("场景6: 取消 Agent Loop", async () => {
    let resolveStream: (result: StreamResult) => void;
    const streamPromise = new Promise<StreamResult>((resolve) => {
      resolveStream = resolve;
    });

    const streamingEngine: IStreamingEngine = {
      streamResponse: vi.fn().mockReturnValue(streamPromise),
    };

    const loop = new AgentLoop(makeConfig(), undefined, streamingEngine);
    const events: LifecycleEvent[] = [];
    loop.on((e) => events.push(e));

    const resultPromise = loop.run("test");

    await new Promise((r) => setTimeout(r, 10));
    loop.abort();
    resolveStream!({ content: "ok", toolCalls: [], model: "test-model" });

    const result = await resultPromise;
    expect(result.stopReason).toBe("cancelled");

    // agent_end 事件存在
    const agentEnd = events.find((e) => e.type === "agent_end");
    expect(agentEnd).toBeDefined();
  });

  it("场景7: 错误处理", async () => {
    const streamingEngine = createMockStreamingEngine([
      { content: "", toolCalls: [makeToolCall("read_file", '{"file_path":"missing"}', "tc1")], model: "test-model" },
      { content: "The file was not found. Let me try another approach.", toolCalls: [], model: "test-model" },
    ]);

    const toolExecutor = createMockToolExecutor([
      [{ toolCallId: "tc1", toolName: "read_file", output: "File not found", isError: true, terminate: false, duration: 10 }],
    ]);

    const loop = new AgentLoop(makeConfig(), toolExecutor, streamingEngine);
    const result = await loop.run("Read missing file");

    // 工具错误被捕获，LLM 根据错误信息决定后续行为
    expect(result.status).toBe("idle");
    expect(result.lastAssistantMessage?.content).toBe("The file was not found. Let me try another approach.");

    // 错误的 tool result 在 transcript 中
    const toolMsg = result.transcript.find((m) => m.role === "tool" && m.isError === true);
    expect(toolMsg).toBeDefined();
  });

  it("场景8: 与 SpecialistAgent 集成 (ExecutionResult 兼容)", async () => {
    // 验证 AgentLoop 的结果可以正确转换为 ExecutionResult
    const streamingEngine = createMockStreamingEngine([
      { content: "Task completed successfully", toolCalls: [], model: "test-model" },
    ]);

    const loop = new AgentLoop(makeConfig(), undefined, streamingEngine);
    const loopResult = await loop.run("Do something");

    // 模拟 SpecialistAgent 中的转换逻辑
    const executionResult = {
      success: loopResult.status !== "error",
      data: loopResult.lastAssistantMessage?.content ?? "",
      apiCalls: loopResult.totalIterations,
      model: defaultLLMConfig.model,
      error: loopResult.errorMessage ?? undefined,
    };

    expect(executionResult.success).toBe(true);
    expect(executionResult.data).toBe("Task completed successfully");
    expect(executionResult.apiCalls).toBe(1);
    expect(executionResult.model).toBe("test-model");
    expect(executionResult.error).toBeUndefined();
  });
});
