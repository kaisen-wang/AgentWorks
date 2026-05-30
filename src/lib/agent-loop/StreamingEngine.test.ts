import { describe, it, expect, vi, beforeEach } from "vitest";
import { DefaultStreamingEngine } from "./StreamingEngine";
import type { StreamEvent, StreamResult } from "./types";
import type { ChatMessage, LLMConfig, ToolDefinition } from "@/lib/llm";

// Mock callLLM for fallback
vi.mock("@/lib/llm", () => ({
  callLLM: vi.fn(),
}));

// Mock OpenAIClientFactory to control SDK client behavior
vi.mock("@/lib/llm/OpenAIClientFactory", () => ({
  OpenAIClientFactory: {
    getClient: vi.fn(),
    disposeClient: vi.fn(),
    disposeAll: vi.fn(),
  },
}));

import { callLLM } from "@/lib/llm";
import { OpenAIClientFactory } from "@/lib/llm/OpenAIClientFactory";

const mockedCallLLM = vi.mocked(callLLM);
const mockedGetClient = vi.mocked(OpenAIClientFactory.getClient);

const defaultConfig: LLMConfig = {
  endpoint: "https://api.example.com/v1",
  apiKey: "test-key",
  model: "test-model",
};

const emptyTools: ToolDefinition[] = [];

/** 创建模拟的 SDK 流式响应（async iterable） */
function createMockStream(chunks: Record<string, unknown>[]) {
  return {
    [Symbol.asyncIterator]() {
      let index = 0;
      return {
        async next() {
          if (index < chunks.length) {
            return { value: chunks[index++], done: false };
          }
          return { value: undefined, done: true };
        },
      };
    },
  };
}

describe("DefaultStreamingEngine", () => {
  let engine: DefaultStreamingEngine;

  beforeEach(() => {
    engine = new DefaultStreamingEngine();
    vi.clearAllMocks();
  });

  describe("降级为非流式调用", () => {
    it("流式请求失败时降级为 callLLM", async () => {
      mockedCallLLM.mockResolvedValue({
        content: "Hello world",
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        model: "test-model",
      });

      // Mock SDK client to throw
      mockedGetClient.mockReturnValue({
        chat: {
          completions: {
            create: vi.fn().mockRejectedValue(new Error("Network error")),
          },
        },
      } as unknown as ReturnType<typeof OpenAIClientFactory.getClient>);

      const events: StreamEvent[] = [];
      const result = await engine.streamResponse(
        [{ role: "user", content: "hi" }],
        defaultConfig,
        emptyTools,
        new AbortController().signal,
        (e) => events.push(e),
      );

      expect(result.content).toBe("Hello world");
      expect(result.model).toBe("test-model");
      expect(events.some((e) => e.type === "done")).toBe(true);
    });
  });

  describe("SDK 流式迭代", () => {
    it("正确解析 text_delta 事件", async () => {
      const streamChunks = [
        {
          model: "test-model",
          choices: [{ delta: { content: "Hello" }, index: 0 }],
        },
        {
          model: "test-model",
          choices: [{ delta: { content: " world" }, index: 0 }],
        },
      ];

      const mockStream = createMockStream(streamChunks);

      mockedGetClient.mockReturnValue({
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue(mockStream),
          },
        },
      } as unknown as ReturnType<typeof OpenAIClientFactory.getClient>);

      const events: StreamEvent[] = [];
      const result = await engine.streamResponse(
        [{ role: "user", content: "hi" }],
        defaultConfig,
        emptyTools,
        new AbortController().signal,
        (e) => events.push(e),
      );

      expect(result.content).toBe("Hello world");
      const textDeltas = events.filter((e) => e.type === "text_delta");
      expect(textDeltas).toHaveLength(2);
      expect((textDeltas[0] as { type: "text_delta"; text: string }).text).toBe("Hello");
      expect((textDeltas[1] as { type: "text_delta"; text: string }).text).toBe(" world");
    });

    it("正确解析 toolcall_delta 事件并累积", async () => {
      const streamChunks = [
        {
          model: "test-model",
          choices: [{
            delta: {
              tool_calls: [{ id: "tc_1", function: { name: "read_file", arguments: "" } }],
            },
            index: 0,
          }],
        },
        {
          model: "test-model",
          choices: [{
            delta: {
              tool_calls: [{ id: "tc_1", function: { name: "", arguments: '{"file_' } }],
            },
            index: 0,
          }],
        },
        {
          model: "test-model",
          choices: [{
            delta: {
              tool_calls: [{ id: "tc_1", function: { name: "", arguments: 'path":"a"}' } }],
            },
            index: 0,
          }],
        },
      ];

      const mockStream = createMockStream(streamChunks);

      mockedGetClient.mockReturnValue({
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue(mockStream),
          },
        },
      } as unknown as ReturnType<typeof OpenAIClientFactory.getClient>);

      const result = await engine.streamResponse(
        [{ role: "user", content: "read" }],
        defaultConfig,
        emptyTools,
        new AbortController().signal,
        () => {},
      );

      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].id).toBe("tc_1");
      expect(result.toolCalls[0].function.name).toBe("read_file");
      expect(result.toolCalls[0].function.arguments).toBe('{"file_path":"a"}');
    });

    it("正确解析 usage 信息", async () => {
      const streamChunks = [
        {
          model: "test-model",
          choices: [{ delta: { content: "hi" }, index: 0 }],
        },
        {
          model: "test-model",
          choices: [{ delta: {}, index: 0 }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        },
      ];

      const mockStream = createMockStream(streamChunks);

      mockedGetClient.mockReturnValue({
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue(mockStream),
          },
        },
      } as unknown as ReturnType<typeof OpenAIClientFactory.getClient>);

      const result = await engine.streamResponse(
        [{ role: "user", content: "hi" }],
        defaultConfig,
        emptyTools,
        new AbortController().signal,
        () => {},
      );

      expect(result.usage).toEqual({
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      });
    });
  });

  describe("AbortSignal 取消", () => {
    it("取消时中断流式请求并降级", async () => {
      mockedCallLLM.mockResolvedValue({
        content: "fallback",
        toolCalls: [],
        usage: { promptTokens: 5, completionTokens: 3, totalTokens: 8 },
        model: "test-model",
      });

      const controller = new AbortController();

      // Mock SDK client to throw on abort
      mockedGetClient.mockReturnValue({
        chat: {
          completions: {
            create: vi.fn().mockImplementation(() => {
              throw new DOMException("Aborted", "AbortError");
            }),
          },
        },
      } as unknown as ReturnType<typeof OpenAIClientFactory.getClient>);

      controller.abort();

      const result = await engine.streamResponse(
        [{ role: "user", content: "hi" }],
        defaultConfig,
        emptyTools,
        controller.signal,
        () => {},
      );

      // Should fallback to non-streaming
      expect(result).toBeDefined();
    });
  });
});
