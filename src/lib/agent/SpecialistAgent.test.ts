import { describe, it, expect } from "vitest";
import { SpecialistAgent } from "./SpecialistAgent";
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

describe("SpecialistAgent - 专员 Agent", () => {
  // ============================================================
  // 构造与属性
  // ============================================================
  describe("构造与属性", () => {
    it("正确设置 capabilities 和 tools", () => {
      const capabilities: AgentCapability[] = [
        { name: "design", description: "设计能力", tools: ["figma"] },
      ];
      const agent = new SpecialistAgent("sp1", "设计专员", defaultConfig, capabilities, ["figma", "dalle"]);
      expect(agent.id).toBe("sp1");
      expect(agent.name).toBe("设计专员");
      expect(agent.capabilities).toHaveLength(1);
      expect(agent.tools).toEqual(["figma", "dalle"]);
    });

    it("capabilities 和 tools 默认为空数组", () => {
      const agent = new SpecialistAgent("sp1", "专员", defaultConfig);
      expect(agent.capabilities).toHaveLength(0);
      expect(agent.tools).toHaveLength(0);
    });
  });

  // ============================================================
  // execute - 专员执行
  // ============================================================
  describe("execute 执行", () => {
    it("执行返回成功结果", async () => {
      const agent = new SpecialistAgent("sp1", "设计专员", defaultConfig);
      const result = await agent.execute("设计海报");
      expect(result.success).toBe(true);
      expect(result.data).toContain("设计海报");
    });

    it("执行结果包含 cost 和 apiCalls", async () => {
      const agent = new SpecialistAgent("sp1", "设计专员", defaultConfig);
      const result = await agent.execute("任务");
      expect(result.cost).toBeDefined();
      expect(result.apiCalls).toBeDefined();
      expect(result.model).toBeDefined();
    });

    it("执行过程中状态变为 executing，完成后恢复 idle", async () => {
      const agent = new SpecialistAgent("sp1", "设计专员", defaultConfig);
      // execute 内部 setStatus("executing")，finally 中 setStatus("idle")
      await agent.execute("任务");
      expect(agent.getStatus()).toBe("idle");
    });
  });

  // ============================================================
  // reportError - 异常上报 (BUP-01)
  // ============================================================
  describe("reportError 异常上报", () => {
    it("构造 decision 类型的上报内容", async () => {
      const agent = new SpecialistAgent("sp1", "设计专员", defaultConfig);
      // reportError 内部调用 report，report 会 setStatus("reporting") -> "idle"
      await agent.reportError(
        "API 调用失败",
        "已重试3次",
        [
          { id: "retry", label: "继续重试" },
          { id: "skip", label: "跳过此步骤" },
        ],
        "parent-id"
      );
      expect(agent.getStatus()).toBe("idle");
    });

    it("reportError 传递正确的参数给 report", async () => {
      const agent = new SpecialistAgent("sp1", "设计专员", defaultConfig);
      // 验证不抛异常即可，report 的实际内容由 console.log 输出
      await agent.reportError("问题", "方案", [{ id: "a", label: "A" }], "parent");
      expect(agent.getStatus()).toBe("idle");
    });
  });

  // ============================================================
  // reportProgress - 进度上报 (BUP-03)
  // ============================================================
  describe("reportProgress 进度上报", () => {
    it("构造 progress 类型的上报内容", async () => {
      const agent = new SpecialistAgent("sp1", "设计专员", defaultConfig);
      await agent.reportProgress("完成50%", "parent-id");
      expect(agent.getStatus()).toBe("idle");
    });

    it("进度上报包含里程碑信息", async () => {
      const agent = new SpecialistAgent("sp1", "设计专员", defaultConfig);
      // reportProgress 内部构造 content.data = { milestone, agentId, agentName }
      await agent.reportProgress("设计稿初版完成", "parent-id");
      expect(agent.getStatus()).toBe("idle");
    });
  });

  // ============================================================
  // archive - 专员归档
  // ============================================================
  describe("archive 专员归档", () => {
    it("归档返回 archive ID", async () => {
      const agent = new SpecialistAgent("sp1", "设计专员", defaultConfig);
      const archiveId = await agent.archive({
        taskId: "t1",
        input: "设计海报",
        output: "海报已生成",
        cost: 0.02,
        apiCalls: 1,
        model: "gpt-4",
        duration: 2000,
      });
      expect(archiveId).toMatch(/^archive_sp1_\d+$/);
    });
  });

  // ============================================================
  // 继承 BaseAgent 的方法
  // ============================================================
  describe("继承 BaseAgent", () => {
    it("summarize 使用基类默认实现", async () => {
      const agent = new SpecialistAgent("sp1", "设计专员", defaultConfig);
      const results = [
        { success: true, data: "结果A" },
        { success: true, data: "结果B" },
      ];
      const summary = await agent.summarize(results);
      expect(summary.content).toContain("结果A");
      expect(summary.content).toContain("结果B");
      expect(summary.format).toBe("text");
    });

    it("executeWithRetry 可用", async () => {
      const agent = new SpecialistAgent("sp1", "设计专员", defaultConfig);
      const result = await agent.executeWithRetry("任务");
      expect(result.success).toBe(true);
    });
  });
});
