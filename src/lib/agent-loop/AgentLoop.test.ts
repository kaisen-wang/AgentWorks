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
import type { ChatMessage, LLMConfig, ToolCall, ToolDefinition } from "@/lib/llm";

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

/** 创建 Mock StreamingEngine */
function createMockStreamingEngine(responses: StreamResult[]): IStreamingEngine {
  let callIndex = 0;
  return {
    streamResponse: vi.fn().mockImplementation(async () => {
      const result = responses[callIndex++] ?? { content: "", toolCalls: [], model: "test-model" };
      return result;
    }),
  };
}

/** 创建 Mock ToolExecutor */
function createMockToolExecutor(results: LoopToolExecutionResult[][]): IToolExecutor {
  let callIndex = 0;
  return {
    executeToolCall: vi.fn(),
    executeToolCalls: vi.fn().mockImplementation(async () => {
      return results[callIndex++] ?? [];
    }),
  };
}

function makeToolCall(name: string, args: string, id = "tc_1"): ToolCall {
  return { id, type: "function", function: { name, arguments: args } };
}

describe("AgentLoop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("run() 基本流程", () => {
    it("空消息时抛出错误", async () => {
      const loop = new AgentLoop(makeConfig());
      await expect(loop.run("")).rejects.toThrow("Initial message cannot be empty");
      await expect(loop.run("   ")).rejects.toThrow("Initial message cannot be empty");
    });

    it("LLM 返回纯文本时正常结束", async () => {
      const streamingEngine = createMockStreamingEngine([
        { content: "Hello! How can I help?", toolCalls: [], model: "test-model" },
      ]);

      const loop = new AgentLoop(makeConfig(), undefined, streamingEngine);
      const result = await loop.run("Hi");

      expect(result.status).toBe("idle");
      expect(result.stopReason).toBe("completed");
      expect(result.lastAssistantMessage?.content).toBe("Hello! How can I help?");
      expect(result.totalIterations).toBe(1);
    });

    it("初始化 transcript 包含 system prompt 和 user message", async () => {
      const streamingEngine = createMockStreamingEngine([
        { content: "ok", toolCalls: [], model: "test-model" },
      ]);

      const loop = new AgentLoop(makeConfig(), undefined, streamingEngine);
      const result = await loop.run("test");

      expect(result.transcript[0].role).toBe("system");
      expect(result.transcript[1].role).toBe("user");
      expect(result.transcript[1].content).toBe("test");
    });
  });

  describe("内层工具调用循环", () => {
    it("LLM 返回 tool_calls 时执行工具并继续", async () => {
      const streamingEngine = createMockStreamingEngine([
        { content: "", toolCalls: [makeToolCall("read_file", '{"file_path":"a"}', "tc1")], model: "test-model" },
        { content: "File content is: hello", toolCalls: [], model: "test-model" },
      ]);

      const toolExecutor = createMockToolExecutor([
        [{ toolCallId: "tc1", toolName: "read_file", output: "hello", isError: false, terminate: false, duration: 10 }],
      ]);

      const loop = new AgentLoop(makeConfig(), toolExecutor, streamingEngine);
      const result = await loop.run("read the file");

      expect(result.status).toBe("idle");
      expect(result.stopReason).toBe("completed");
      expect(result.totalIterations).toBe(2);
      expect(result.lastAssistantMessage?.content).toBe("File content is: hello");
    });

    it("多轮工具调用", async () => {
      const streamingEngine = createMockStreamingEngine([
        { content: "", toolCalls: [makeToolCall("read_file", '{"file_path":"a"}', "tc1")], model: "test-model" },
        { content: "", toolCalls: [makeToolCall("edit_file", '{"file_path":"a","old":"x","new":"y"}', "tc2")], model: "test-model" },
        { content: "Done!", toolCalls: [], model: "test-model" },
      ]);

      const toolExecutor = createMockToolExecutor([
        [{ toolCallId: "tc1", toolName: "read_file", output: "content", isError: false, terminate: false, duration: 10 }],
        [{ toolCallId: "tc2", toolName: "edit_file", output: "ok", isError: false, terminate: false, duration: 10 }],
      ]);

      const loop = new AgentLoop(makeConfig(), toolExecutor, streamingEngine);
      const result = await loop.run("read and edit");

      expect(result.totalIterations).toBe(3);
      expect(result.lastAssistantMessage?.content).toBe("Done!");
    });
  });

  describe("maxIterations 保护", () => {
    it("达到最大迭代次数时强制结束", async () => {
      // 每次都返回 tool_call，模拟无限循环
      const streamingEngine = createMockStreamingEngine(
        Array(10).fill({ content: "", toolCalls: [makeToolCall("read_file", '{"file_path":"a"}')], model: "test-model" }),
      );

      const toolExecutor = createMockToolExecutor(
        Array(10).fill([{ toolCallId: "tc_1", toolName: "read_file", output: "ok", isError: false, terminate: false, duration: 10 }]),
      );

      const loop = new AgentLoop(makeConfig({ maxIterations: 3 }), toolExecutor, streamingEngine);
      const result = await loop.run("loop forever");

      expect(result.stopReason).toBe("max_iterations_reached");
      expect(result.totalIterations).toBe(3);
    });
  });

  describe("工具终止信号", () => {
    it("工具返回 terminate: true 时循环停止", async () => {
      const streamingEngine = createMockStreamingEngine([
        { content: "", toolCalls: [makeToolCall("read_file", '{"file_path":"a"}', "tc1")], model: "test-model" },
      ]);

      const toolExecutor = createMockToolExecutor([
        [{ toolCallId: "tc1", toolName: "read_file", output: "done", isError: false, terminate: true, duration: 10 }],
      ]);

      const loop = new AgentLoop(makeConfig(), toolExecutor, streamingEngine);
      const result = await loop.run("read and stop");

      expect(result.stopReason).toBe("tool_terminated");
    });
  });

  describe("follow-up 消息", () => {
    it("follow-up 队列有消息时继续外层循环", async () => {
      const streamingEngine = createMockStreamingEngine([
        { content: "First response", toolCalls: [], model: "test-model" },
        { content: "Second response", toolCalls: [], model: "test-model" },
      ]);

      const events: LifecycleEvent[] = [];
      const loop = new AgentLoop(makeConfig(), undefined, streamingEngine);
      loop.on((e) => events.push(e));

      // 在 agent_start 后添加 follow-up
      const waitForStart = new Promise<void>((resolve) => {
        loop.on((e) => {
          if (e.type === "agent_start") {
            loop.addFollowUpMessage("continue?");
            resolve();
          }
        });
      });

      const resultPromise = loop.run("start");
      await waitForStart;
      const result = await resultPromise;

      expect(result.totalTurns).toBeGreaterThanOrEqual(2);
    });
  });

  describe("steering 消息", () => {
    it("steering 消息在 turn 间注入", async () => {
      const streamingEngine = createMockStreamingEngine([
        { content: "", toolCalls: [makeToolCall("read_file", '{"file_path":"a"}', "tc1")], model: "test-model" },
        { content: "After steering", toolCalls: [], model: "test-model" },
      ]);

      const toolExecutor = createMockToolExecutor([
        [{ toolCallId: "tc1", toolName: "read_file", output: "ok", isError: false, terminate: false, duration: 10 }],
      ]);

      const loop = new AgentLoop(makeConfig(), toolExecutor, streamingEngine);

      // 添加 steering 消息
      loop.addSteeringMessage("Focus on this");

      const result = await loop.run("read file");

      // steering 消息应被注入到 transcript 中
      const steeringMsg = result.transcript.find((m) => m.role === "user" && m.content === "Focus on this");
      expect(steeringMsg).toBeDefined();
    });
  });

  describe("abort() 取消", () => {
    it("abort 后发出 agent_end(cancelled) 事件", async () => {
      // 创建一个不会自动完成的 streaming engine
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

      // 等一小段时间后 abort
      await new Promise((r) => setTimeout(r, 10));
      loop.abort();

      // resolve the stream so the loop can continue
      resolveStream!({ content: "ok", toolCalls: [], model: "test-model" });

      const result = await resultPromise;
      expect(result.stopReason).toBe("cancelled");
    });
  });

  describe("生命周期事件", () => {
    it("发出正确的事件序列", async () => {
      const streamingEngine = createMockStreamingEngine([
        { content: "Hello!", toolCalls: [], model: "test-model" },
      ]);

      const loop = new AgentLoop(makeConfig(), undefined, streamingEngine);
      const events: LifecycleEvent[] = [];
      loop.on((e) => events.push(e));

      await loop.run("hi");

      const eventTypes = events.map((e) => e.type);
      expect(eventTypes).toContain("agent_start");
      expect(eventTypes).toContain("turn_start");
      expect(eventTypes).toContain("message_start");
      expect(eventTypes).toContain("message_end");
      expect(eventTypes).toContain("turn_end");
      expect(eventTypes).toContain("agent_end");
    });
  });

  describe("getState()", () => {
    it("返回正确的状态快照", async () => {
      const streamingEngine = createMockStreamingEngine([
        { content: "ok", toolCalls: [], model: "test-model" },
      ]);

      const loop = new AgentLoop(makeConfig(), undefined, streamingEngine);
      const state0 = loop.getState();
      expect(state0.status).toBe("idle");

      await loop.run("test");

      const state1 = loop.getState();
      expect(state1.status).toBe("idle");
      expect(state1.currentIteration).toBe(1);
    });
  });

  describe("shouldStopAfterTurn", () => {
    it("返回 true 时循环停止", async () => {
      const streamingEngine = createMockStreamingEngine([
        { content: "", toolCalls: [makeToolCall("read_file", '{"file_path":"a"}', "tc1")], model: "test-model" },
        { content: "After tool", toolCalls: [], model: "test-model" },
      ]);

      const toolExecutor = createMockToolExecutor([
        [{ toolCallId: "tc1", toolName: "read_file", output: "ok", isError: false, terminate: false, duration: 10 }],
      ]);

      const loop = new AgentLoop(
        makeConfig({
          shouldStopAfterTurn: async () => true,
        }),
        toolExecutor,
        streamingEngine,
      );

      const result = await loop.run("test");
      expect(result.stopReason).toBe("should_stop_after_turn");
    });
  });
});
