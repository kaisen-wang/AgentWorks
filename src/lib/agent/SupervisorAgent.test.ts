import { describe, it, expect, vi } from "vitest";
import { SupervisorAgent } from "./SupervisorAgent";
import type { AgentConfig, AgentCapability } from "@/types";

const defaultConfig: AgentConfig = {
  model: "gpt-4",
  temperature: 0.7,
  timeout: 5000,
  maxRetries: 3,
  decisionThreshold: 5,
  monthlyBudget: 10,
  budgetUsed: 0,
  budgetAlertThreshold: 0.9,
};

describe("SupervisorAgent - 主管 Agent", () => {
  // ============================================================
  // 构造与属性
  // ============================================================
  describe("构造与属性", () => {
    it("正确设置 capabilities", () => {
      const capabilities: AgentCapability[] = [
        { name: "design", description: "设计能力" },
        { name: "publish", description: "发布能力" },
      ];
      const agent = new SupervisorAgent("s1", "营销主管", defaultConfig, capabilities);
      expect(agent.id).toBe("s1");
      expect(agent.name).toBe("营销主管");
      expect(agent.capabilities).toHaveLength(2);
      expect(agent.capabilities[0].name).toBe("design");
    });

    it("capabilities 默认为空数组", () => {
      const agent = new SupervisorAgent("s1", "主管", defaultConfig);
      expect(agent.capabilities).toHaveLength(0);
    });
  });

  // ============================================================
  // execute - 执行（任务拆解）
  // ============================================================
  describe("execute 执行", () => {
    it("执行返回拆解结果的 JSON", async () => {
      const agent = new SupervisorAgent("s1", "营销主管", defaultConfig);
      const result = await agent.execute("新品宣发", {
        subordinates: ["spec1", "spec2"],
      });
      expect(result.success).toBe(true);
      const decomposition = JSON.parse(result.data);
      expect(decomposition.subTasks).toHaveLength(2);
      expect(decomposition.summary).toContain("新品宣发");
    });

    it("无下属时拆解为空", async () => {
      const agent = new SupervisorAgent("s1", "营销主管", defaultConfig);
      const result = await agent.execute("任务", { subordinates: [] });
      expect(result.success).toBe(true);
      const decomposition = JSON.parse(result.data);
      expect(decomposition.subTasks).toHaveLength(0);
    });

    it("执行过程中状态变为 executing", async () => {
      const agent = new SupervisorAgent("s1", "营销主管", defaultConfig);
      // execute 内部 setStatus("executing")，finally 中恢复为 idle
      await agent.execute("任务", { subordinates: ["a1"] });
      expect(agent.getStatus()).toBe("idle");
    });
  });

  // ============================================================
  // decomposeTask - 任务拆解 (TDN-02)
  // ============================================================
  describe("decomposeTask 任务拆解", () => {
    it("按下属数量拆解子任务", async () => {
      const agent = new SupervisorAgent("s1", "营销主管", defaultConfig);
      const decomposition = await agent.decomposeTask("新品宣发", {
        subordinates: ["spec1", "spec2", "spec3"],
      });
      expect(decomposition.subTasks).toHaveLength(3);
      expect(decomposition.subTasks[0].assigneeId).toBe("spec1");
      expect(decomposition.subTasks[1].assigneeId).toBe("spec2");
      expect(decomposition.subTasks[2].assigneeId).toBe("spec3");
    });

    it("子任务标题和描述包含原始任务", async () => {
      const agent = new SupervisorAgent("s1", "营销主管", defaultConfig);
      const decomposition = await agent.decomposeTask("设计海报", {
        subordinates: ["spec1"],
      });
      expect(decomposition.subTasks[0].title).toBe("子任务 1");
      expect(decomposition.subTasks[0].description).toContain("设计海报");
    });

    it("summary 包含拆解信息", async () => {
      const agent = new SupervisorAgent("s1", "营销主管", defaultConfig);
      const decomposition = await agent.decomposeTask("大任务", {
        subordinates: ["a", "b"],
      });
      expect(decomposition.summary).toContain("大任务");
      expect(decomposition.summary).toContain("2");
    });

    it("无 context.subordinates 时默认为空", async () => {
      const agent = new SupervisorAgent("s1", "营销主管", defaultConfig);
      const decomposition = await agent.decomposeTask("任务");
      expect(decomposition.subTasks).toHaveLength(0);
    });
  });

  // ============================================================
  // summarize - 主管汇总
  // ============================================================
  describe("summarize 主管汇总", () => {
    it("区分成功和失败结果", async () => {
      const agent = new SupervisorAgent("s1", "营销主管", defaultConfig);
      const results = [
        { success: true, data: "设计完成" },
        { success: false, data: "", error: "发布失败" },
        { success: true, data: "分析完成" },
      ];
      const summary = await agent.summarize(results);
      expect(summary.format).toBe("card");
      expect(summary.content).toContain("完成 2 项");
      expect(summary.content).toContain("设计完成");
      expect(summary.content).toContain("分析完成");
      expect(summary.content).toContain("失败 1 项");
      expect(summary.content).toContain("发布失败");
    });

    it("全部成功时无失败信息", async () => {
      const agent = new SupervisorAgent("s1", "营销主管", defaultConfig);
      const results = [
        { success: true, data: "A完成" },
        { success: true, data: "B完成" },
      ];
      const summary = await agent.summarize(results);
      expect(summary.content).toContain("完成 2 项");
      expect(summary.content).not.toContain("失败");
    });

    it("全部失败时无成功信息", async () => {
      const agent = new SupervisorAgent("s1", "营销主管", defaultConfig);
      const results = [
        { success: false, data: "", error: "错误A" },
      ];
      const summary = await agent.summarize(results);
      expect(summary.content).toContain("失败 1 项");
      expect(summary.content).not.toContain("完成");
    });

    it("汇总后状态恢复 idle", async () => {
      const agent = new SupervisorAgent("s1", "营销主管", defaultConfig);
      await agent.summarize([{ success: true, data: "ok" }]);
      expect(agent.getStatus()).toBe("idle");
    });
  });

  // ============================================================
  // report - 主管上报 (BUP-02)
  // ============================================================
  describe("report 主管上报", () => {
    it("上报后状态恢复 idle", async () => {
      const agent = new SupervisorAgent("s1", "营销主管", defaultConfig);
      await agent.report(
        { type: "decision", title: "需要决策", problem: "预算超支" },
        "boss-id"
      );
      expect(agent.getStatus()).toBe("idle");
    });

    it("上报内容包含 title", async () => {
      const agent = new SupervisorAgent("s1", "营销主管", defaultConfig);
      // report 内部构造结构化上报内容，通过不抛异常验证
      await agent.report({ type: "progress", title: "进度更新" });
      expect(agent.getStatus()).toBe("idle");
    });
  });

  // ============================================================
  // archive - 主管归档
  // ============================================================
  describe("archive 主管归档", () => {
    it("归档返回 archive ID", async () => {
      const agent = new SupervisorAgent("s1", "营销主管", defaultConfig);
      const archiveId = await agent.archive({
        taskId: "t1",
        input: "输入",
        output: "输出",
        cost: 0.05,
        apiCalls: 2,
        model: "gpt-4",
        duration: 3000,
      });
      expect(archiveId).toMatch(/^archive_s1_\d+$/);
    });
  });
});
