import { describe, it, expect, vi, beforeEach } from "vitest";
import { DefaultToolExecutor } from "./ToolExecutor";
import type { ToolCall } from "@/lib/llm";
import type { LoopToolExecutionResult, ToolExecutionHooks } from "./types";

// Mock AgentTools
vi.mock("@/lib/agent/AgentTools", () => ({
  executeToolCall: vi.fn(),
}));

import { executeToolCall } from "@/lib/agent/AgentTools";

const mockedExecuteToolCall = vi.mocked(executeToolCall);

function makeToolCall(name: string, args: string, id = "tc_1"): ToolCall {
  return {
    id,
    type: "function",
    function: { name, arguments: args },
  };
}

describe("DefaultToolExecutor", () => {
  let executor: DefaultToolExecutor;

  beforeEach(() => {
    executor = new DefaultToolExecutor();
    vi.clearAllMocks();
  });

  describe("三阶段生命周期", () => {
    it("依次经过 prepare→execute→finalize 三阶段", async () => {
      mockedExecuteToolCall.mockResolvedValue({ success: true, output: "file content" });

      const result = await executor.executeToolCall(
        makeToolCall("read_file", '{"file_path": "/tmp/test.txt"}'),
        {},
        new AbortController().signal,
      );

      expect(mockedExecuteToolCall).toHaveBeenCalledWith("read_file", '{"file_path": "/tmp/test.txt"}');
      expect(result.isError).toBe(false);
      expect(result.output).toBe("file content");
      expect(result.terminate).toBe(false);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it("prepare 阶段：解析 JSON 参数失败时返回 isError: true", async () => {
      const result = await executor.executeToolCall(
        makeToolCall("read_file", "invalid json{"),
        {},
        new AbortController().signal,
      );

      expect(result.isError).toBe(true);
      expect(result.output).toContain("Invalid JSON arguments");
      expect(mockedExecuteToolCall).not.toHaveBeenCalled();
    });

    it("execute 阶段：工具执行异常被捕获为 isError: true", async () => {
      mockedExecuteToolCall.mockRejectedValue(new Error("disk error"));

      const result = await executor.executeToolCall(
        makeToolCall("read_file", '{"file_path": "/tmp/test.txt"}'),
        {},
        new AbortController().signal,
      );

      expect(result.isError).toBe(true);
      expect(result.output).toBe("disk error");
    });

    it("execute 阶段：工具返回失败结果", async () => {
      mockedExecuteToolCall.mockResolvedValue({ success: false, error: "file not found" });

      const result = await executor.executeToolCall(
        makeToolCall("read_file", '{"file_path": "/tmp/missing.txt"}'),
        {},
        new AbortController().signal,
      );

      expect(result.isError).toBe(true);
      expect(result.output).toBe("file not found");
    });
  });

  describe("beforeToolCall 钩子", () => {
    it("钩子可修改参数", async () => {
      mockedExecuteToolCall.mockResolvedValue({ success: true, output: "ok" });

      const hooks: ToolExecutionHooks = {
        beforeToolCall: vi.fn().mockResolvedValue({
          modifiedArgs: '{"file_path": "/tmp/modified.txt"}',
        }),
      };

      await executor.executeToolCall(
        makeToolCall("read_file", '{"file_path": "/tmp/test.txt"}'),
        hooks,
        new AbortController().signal,
      );

      expect(mockedExecuteToolCall).toHaveBeenCalledWith("read_file", '{"file_path": "/tmp/modified.txt"}');
    });

    it("钩子返回 block 时跳过执行", async () => {
      const hooks: ToolExecutionHooks = {
        beforeToolCall: vi.fn().mockResolvedValue({
          block: true,
          reason: "Not allowed",
        }),
      };

      const result = await executor.executeToolCall(
        makeToolCall("run_command", '{"command": "rm -rf /"}'),
        hooks,
        new AbortController().signal,
      );

      expect(result.isError).toBe(true);
      expect(result.output).toBe("Not allowed");
      expect(mockedExecuteToolCall).not.toHaveBeenCalled();
    });

    it("钩子抛出异常时返回错误结果", async () => {
      const hooks: ToolExecutionHooks = {
        beforeToolCall: vi.fn().mockRejectedValue(new Error("hook error")),
      };

      const result = await executor.executeToolCall(
        makeToolCall("read_file", '{"file_path": "/tmp/test.txt"}'),
        hooks,
        new AbortController().signal,
      );

      expect(result.isError).toBe(true);
      expect(result.output).toBe("hook error");
      expect(mockedExecuteToolCall).not.toHaveBeenCalled();
    });
  });

  describe("afterToolCall 钩子", () => {
    it("钩子在执行后被调用", async () => {
      mockedExecuteToolCall.mockResolvedValue({ success: true, output: "ok" });

      const afterHook = vi.fn().mockResolvedValue(undefined);
      const hooks: ToolExecutionHooks = {
        afterToolCall: afterHook,
      };

      await executor.executeToolCall(
        makeToolCall("read_file", '{"file_path": "/tmp/test.txt"}'),
        hooks,
        new AbortController().signal,
      );

      expect(afterHook).toHaveBeenCalledTimes(1);
    });

    it("钩子可修改 terminate 标志", async () => {
      mockedExecuteToolCall.mockResolvedValue({ success: true, output: "done" });

      const hooks: ToolExecutionHooks = {
        afterToolCall: vi.fn().mockResolvedValue({ terminate: true }),
      };

      const result = await executor.executeToolCall(
        makeToolCall("read_file", '{"file_path": "/tmp/test.txt"}'),
        hooks,
        new AbortController().signal,
      );

      expect(result.terminate).toBe(true);
    });
  });

  describe("AbortSignal", () => {
    it("已取消时返回 aborted 错误", async () => {
      const controller = new AbortController();
      controller.abort();

      const result = await executor.executeToolCall(
        makeToolCall("read_file", '{"file_path": "/tmp/test.txt"}'),
        {},
        controller.signal,
      );

      expect(result.isError).toBe(true);
      expect(result.output).toBe("Operation aborted");
      expect(mockedExecuteToolCall).not.toHaveBeenCalled();
    });
  });

  describe("executeToolCalls - parallel 模式", () => {
    it("并发执行所有工具调用", async () => {
      mockedExecuteToolCall
        .mockResolvedValueOnce({ success: true, output: "result1" })
        .mockResolvedValueOnce({ success: true, output: "result2" });

      const results = await executor.executeToolCalls(
        [makeToolCall("read_file", '{"file_path":"a"}', "tc1"), makeToolCall("read_file", '{"file_path":"b"}', "tc2")],
        "parallel",
        {},
        new AbortController().signal,
      );

      expect(results).toHaveLength(2);
      expect(results[0].output).toBe("result1");
      expect(results[1].output).toBe("result2");
    });

    it("单个工具失败不影响其他", async () => {
      mockedExecuteToolCall
        .mockResolvedValueOnce({ success: true, output: "ok" })
        .mockRejectedValueOnce(new Error("fail"));

      const results = await executor.executeToolCalls(
        [makeToolCall("read_file", '{"file_path":"a"}', "tc1"), makeToolCall("read_file", '{"file_path":"b"}', "tc2")],
        "parallel",
        {},
        new AbortController().signal,
      );

      expect(results).toHaveLength(2);
      expect(results[0].isError).toBe(false);
      expect(results[1].isError).toBe(true);
    });
  });

  describe("executeToolCalls - sequential 模式", () => {
    it("逐个执行工具调用", async () => {
      mockedExecuteToolCall
        .mockResolvedValueOnce({ success: true, output: "result1" })
        .mockResolvedValueOnce({ success: true, output: "result2" });

      const results = await executor.executeToolCalls(
        [makeToolCall("read_file", '{"file_path":"a"}', "tc1"), makeToolCall("read_file", '{"file_path":"b"}', "tc2")],
        "sequential",
        {},
        new AbortController().signal,
      );

      expect(results).toHaveLength(2);
      expect(results[0].output).toBe("result1");
      expect(results[1].output).toBe("result2");
    });

    it("terminate 时提前跳出", async () => {
      const afterHook = vi.fn().mockResolvedValue({ terminate: true });
      mockedExecuteToolCall
        .mockResolvedValueOnce({ success: true, output: "result1" })
        .mockResolvedValueOnce({ success: true, output: "result2" });

      const hooks: ToolExecutionHooks = {
        afterToolCall: afterHook,
      };

      const results = await executor.executeToolCalls(
        [makeToolCall("read_file", '{"file_path":"a"}', "tc1"), makeToolCall("read_file", '{"file_path":"b"}', "tc2")],
        "sequential",
        hooks,
        new AbortController().signal,
      );

      // 第一个工具 terminate 后，第二个不应执行
      expect(results).toHaveLength(1);
      expect(results[0].terminate).toBe(true);
    });
  });
});
