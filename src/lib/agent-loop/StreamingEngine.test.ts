import { describe, it, expect, vi, beforeEach } from "vitest";
import { DefaultStreamingEngine } from "./StreamingEngine";
import type { StreamEvent, StreamResult } from "./types";
import type { ChatMessage, LLMConfig, ToolDefinition } from "@/lib/llm";

// Mock callLLM for fallback
vi.mock("@/lib/llm", () => ({
  callLLM: vi.fn(),
}));

import { callLLM } from "@/lib/llm";

const mockedCallLLM = vi.mocked(callLLM);

const defaultConfig: LLMConfig = {
  endpoint: "https://api.example.com/v1",
  apiKey: "test-key",
  model: "test-model",
};

const emptyTools: ToolDefinition[] = [];

function createSSEBody(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const lines = chunks.map((c) => `data: ${c}\n\n`).join("");
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(lines));
      controller.close();
    },
  });
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

      // Mock fetch to throw
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));

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

  describe("SSE 解析", () => {
    it("正确解析 text_delta 事件", async () => {
      const sseChunks = [
        JSON.stringify({
          model: "test-model",
          choices: [{ delta: { content: "Hello" }, index: 0 }],
        }),
        JSON.stringify({
          model: "test-model",
          choices: [{ delta: { content: " world" }, index: 0 }],
        }),
        "[DONE]",
      ];

      const mockResponse = {
        ok: true,
        body: createSSEBody(sseChunks),
        status: 200,
        statusText: "OK",
      };

      vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse as Response);

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
      const sseChunks = [
        JSON.stringify({
          model: "test-model",
          choices: [{
            delta: {
              tool_calls: [{ id: "tc_1", function: { name: "read_file", arguments: "" } }],
            },
            index: 0,
          }],
        }),
        JSON.stringify({
          model: "test-model",
          choices: [{
            delta: {
              tool_calls: [{ id: "tc_1", function: { name: "", arguments: '{"file_' } }],
            },
            index: 0,
          }],
        }),
        JSON.stringify({
          model: "test-model",
          choices: [{
            delta: {
              tool_calls: [{ id: "tc_1", function: { name: "", arguments: 'path":"a"}' } }],
            },
            index: 0,
          }],
        }),
        "[DONE]",
      ];

      const mockResponse = {
        ok: true,
        body: createSSEBody(sseChunks),
        status: 200,
        statusText: "OK",
      };

      vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse as Response);

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
      const sseChunks = [
        JSON.stringify({
          model: "test-model",
          choices: [{ delta: { content: "hi" }, index: 0 }],
        }),
        JSON.stringify({
          model: "test-model",
          choices: [{ delta: {}, index: 0 }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
        "[DONE]",
      ];

      const mockResponse = {
        ok: true,
        body: createSSEBody(sseChunks),
        status: 200,
        statusText: "OK",
      };

      vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse as Response);

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
    it("取消时中断 fetch 请求", async () => {
      const controller = new AbortController();
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((_url, options) => {
        return new Promise((_resolve, reject) => {
          const signal = (options as RequestInit).signal as AbortSignal;
          if (signal.aborted) {
            reject(new DOMException("Aborted", "AbortError"));
          }
          signal.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      });

      controller.abort();

      await expect(
        engine.streamResponse(
          [{ role: "user", content: "hi" }],
          defaultConfig,
          emptyTools,
          controller.signal,
          () => {},
        ),
      ).resolves.toBeDefined(); // 降级为非流式

      expect(fetchSpy).toHaveBeenCalled();
    });
  });
});
