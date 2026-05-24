import { describe, it, expect } from "vitest";
import { parseNaturalLanguage } from "@/lib/nlu/CommandParser";

describe("CommandParser - NLU 自然语言解析", () => {
  // ============================================================
  // create_agent 意图
  // ============================================================
  describe("create_agent 意图", () => {
    it("解析'创建一名营销主管Agent'", () => {
      const result = parseNaturalLanguage("创建一名营销主管Agent");
      expect(result.intent).toBe("create_agent");
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
      expect(result.params.role).toBe("supervisor");
      expect(result.params.name).toBeTruthy();
    });

    it("解析'创建一名营销主管Agent，使用GPT-4'", () => {
      const result = parseNaturalLanguage("创建一名营销主管Agent，使用GPT-4");
      expect(result.intent).toBe("create_agent");
      expect(result.params.role).toBe("supervisor");
      expect(result.params.model).toBe("deepseek-v4-flash");
    });

    it("解析'新建一个设计专员Agent'", () => {
      const result = parseNaturalLanguage("新建一个设计专员Agent");
      expect(result.intent).toBe("create_agent");
      expect(result.params.role).toBe("specialist");
    });

    it("解析'添加Agent名叫平台发布'", () => {
      const result = parseNaturalLanguage("添加Agent名叫平台发布");
      expect(result.intent).toBe("create_agent");
      expect(result.params.name).toContain("平台发布");
    });

    it("解析带预算的创建命令", () => {
      const result = parseNaturalLanguage("创建一名营销主管Agent，预算$20");
      expect(result.intent).toBe("create_agent");
      expect(result.params.monthlyBudget).toBe(20);
    });

    it("解析GPT-4o模型", () => {
      const result = parseNaturalLanguage("创建一名设计专员Agent，使用GPT-4o");
      expect(result.intent).toBe("create_agent");
      expect(result.params.model).toBe("gpt-4o");
    });
  });

  // ============================================================
  // set_threshold 意图
  // ============================================================
  describe("set_threshold 意图", () => {
    it("解析'设置决策阈值为5元'", () => {
      const result = parseNaturalLanguage("设置决策阈值为5元");
      expect(result.intent).toBe("set_threshold");
      expect(result.params.threshold).toBe(5);
    });

    it("解析'营销主管对于5元以内的修改自行批准'", () => {
      const result = parseNaturalLanguage("营销主管对于5元以内的修改自行批准");
      expect(result.intent).toBe("set_threshold");
      expect(result.params.agentName).toContain("营销主管");
      expect(result.params.threshold).toBe(5);
    });

    it("解析'营销主管的决策阈值设为10'", () => {
      const result = parseNaturalLanguage("营销主管的决策阈值设为10");
      expect(result.intent).toBe("set_threshold");
      expect(result.params.agentName).toContain("营销主管");
      expect(result.params.threshold).toBe(10);
    });
  });

  // ============================================================
  // update_knowledge 意图
  // ============================================================
  describe("update_knowledge 意图", () => {
    it("解析'告诉营销主管品牌色是#00FF00'", () => {
      const result = parseNaturalLanguage("告诉营销主管品牌色是#00FF00");
      expect(result.intent).toBe("update_knowledge");
      expect(result.params.agentName).toContain("营销主管");
      expect(result.params.key).toBe("品牌色");
      expect(result.params.value).toBe("#00FF00");
      expect(result.params.scope).toBe("department");
    });

    it("解析'设置全局知识 brand_color = #00FF00'", () => {
      const result = parseNaturalLanguage("设置全局知识 brand_color = #00FF00");
      expect(result.intent).toBe("update_knowledge");
      expect(result.params.key).toBe("brand_color");
      expect(result.params.value).toBe("#00FF00");
      expect(result.params.scope).toBe("global");
    });
  });

  // ============================================================
  // run_script 意图
  // ============================================================
  describe("run_script 意图", () => {
    it("解析'运行剧本：新品宣发_标准流程'", () => {
      const result = parseNaturalLanguage("运行剧本：新品宣发_标准流程");
      expect(result.intent).toBe("run_script");
      expect(result.params.scriptName).toContain("新品宣发");
    });

    it("解析带替换的运行剧本", () => {
      const result = parseNaturalLanguage("运行剧本：新品宣发_标准流程，替换产品名为'赛博山水'");
      expect(result.intent).toBe("run_script");
      expect(result.params.scriptName).toContain("新品宣发");
      expect(result.params.replacements).toBeTruthy();
    });
  });

  // ============================================================
  // update_config 意图
  // ============================================================
  describe("update_config 意图", () => {
    it("解析'把营销主管模型改成GPT-3.5'", () => {
      const result = parseNaturalLanguage("把营销主管模型改成GPT-3.5");
      expect(result.intent).toBe("update_config");
      expect(result.params.agentName).toContain("营销主管");
      expect(result.params.field).toBe("model");
      expect(result.params.value).toBe("gpt-3.5-turbo");
    });

    it("解析'将设计专员预算调整为$15'", () => {
      const result = parseNaturalLanguage("将设计专员预算调整为$15");
      expect(result.intent).toBe("update_config");
      expect(result.params.agentName).toContain("设计专员");
      expect(result.params.field).toBe("monthlyBudget");
      expect(result.params.value).toBe(15);
    });
  });

  // ============================================================
  // unknown 意图
  // ============================================================
  describe("unknown 意图", () => {
    it("普通聊天消息返回 unknown", () => {
      const result = parseNaturalLanguage("你好，今天天气怎么样？");
      expect(result.intent).toBe("unknown");
    });

    it("空字符串返回 unknown", () => {
      const result = parseNaturalLanguage("");
      expect(result.intent).toBe("unknown");
    });

    it("斜杠命令不匹配 NLU", () => {
      const result = parseNaturalLanguage("/new_agent 测试");
      expect(result.intent).toBe("unknown");
    });

    it("纯数字返回 unknown", () => {
      const result = parseNaturalLanguage("12345");
      expect(result.intent).toBe("unknown");
    });

    it("纯空格返回 unknown", () => {
      const result = parseNaturalLanguage("   ");
      expect(result.intent).toBe("unknown");
    });
  });

  // ============================================================
  // 补充测试：边界场景和变体
  // ============================================================
  describe("create_agent 补充", () => {
    it("解析'新建一个运营专员Agent'", () => {
      const result = parseNaturalLanguage("新建一个运营专员Agent");
      expect(result.intent).toBe("create_agent");
      expect(result.params.role).toBe("specialist");
    });

    it("解析'创建一名经理Agent'", () => {
      const result = parseNaturalLanguage("创建一名经理Agent");
      expect(result.intent).toBe("create_agent");
      expect(result.params.role).toBe("supervisor");
    });

    it("解析'添加一名工程师Agent'", () => {
      const result = parseNaturalLanguage("添加一名工程师Agent");
      expect(result.intent).toBe("create_agent");
      expect(result.params.role).toBe("specialist");
    });

    it("raw 字段保留原始输入", () => {
      const input = "创建一名营销主管Agent";
      const result = parseNaturalLanguage(input);
      expect(result.raw).toBe(input);
    });
  });

  describe("set_threshold 补充", () => {
    it("解析'设定决策阈值为8元'", () => {
      const result = parseNaturalLanguage("设定决策阈值为8元");
      expect(result.intent).toBe("set_threshold");
      expect(result.params.threshold).toBe(8);
    });

    it("解析'配置阈值是3'", () => {
      const result = parseNaturalLanguage("配置阈值是3");
      expect(result.intent).toBe("set_threshold");
      expect(result.params.threshold).toBe(3);
    });
  });

  describe("update_knowledge 补充", () => {
    it("解析'设置部门知识 style = dark'", () => {
      const result = parseNaturalLanguage("设置部门知识 style = dark");
      expect(result.intent).toBe("update_knowledge");
      expect(result.params.key).toBe("style");
      expect(result.params.value).toBe("dark");
      expect(result.params.scope).toBe("department");
    });

    it("解析'更新知识 brand_font = Arial'", () => {
      const result = parseNaturalLanguage("更新知识 brand_font = Arial");
      expect(result.intent).toBe("update_knowledge");
      expect(result.params.key).toBe("brand_font");
      expect(result.params.value).toBe("Arial");
    });

    it("解析'设置个人知识 preference = light'", () => {
      const result = parseNaturalLanguage("设置个人知识 preference = light");
      expect(result.intent).toBe("update_knowledge");
      expect(result.params.scope).toBe("personal");
    });
  });

  describe("run_script 补充", () => {
    it("解析'执行剧本：测试流程'", () => {
      const result = parseNaturalLanguage("执行剧本：测试流程");
      expect(result.intent).toBe("run_script");
      expect(result.params.scriptName).toContain("测试流程");
    });

    it("解析'启动流程：部署'", () => {
      const result = parseNaturalLanguage("启动流程：部署");
      expect(result.intent).toBe("run_script");
      expect(result.params.scriptName).toContain("部署");
    });
  });

  describe("update_config 补充", () => {
    it("解析'把营销主管模型换成Claude'", () => {
      const result = parseNaturalLanguage("把营销主管模型换成Claude");
      expect(result.intent).toBe("update_config");
      expect(result.params.agentName).toContain("营销主管");
      expect(result.params.field).toBe("model");
      expect(result.params.value).toBe("claude-3-sonnet");
    });

    it("解析'将专员模型切换到Haiku'", () => {
      const result = parseNaturalLanguage("将专员模型切换到Haiku");
      expect(result.intent).toBe("update_config");
      expect(result.params.field).toBe("model");
      expect(result.params.value).toBe("claude-3-haiku");
    });

    it("解析'把设计专员预算设为$30'", () => {
      const result = parseNaturalLanguage("把设计专员预算设为$30");
      expect(result.intent).toBe("update_config");
      expect(result.params.agentName).toContain("设计专员");
      expect(result.params.field).toBe("monthlyBudget");
      expect(result.params.value).toBe(30);
    });

    it("解析'将专员预算改成￥25'", () => {
      const result = parseNaturalLanguage("将专员预算改成￥25");
      expect(result.intent).toBe("update_config");
      expect(result.params.field).toBe("monthlyBudget");
      expect(result.params.value).toBe(25);
    });
  });

  // ============================================================
  // SOLO-02 补充：更多配置项的 NLU 解析
  // ============================================================
  describe("update_config - SOLO-02 扩展配置", () => {
    it("解析'把专员超时设为60000'", () => {
      const result = parseNaturalLanguage("把专员超时设为60000");
      expect(result.intent).toBe("update_config");
      expect(result.params.field).toBe("timeout");
      expect(result.params.value).toBe(60000);
    });

    it("解析'将营销主管超时改成10'", () => {
      const result = parseNaturalLanguage("将营销主管超时改成10");
      expect(result.intent).toBe("update_config");
      expect(result.params.agentName).toContain("营销主管");
      expect(result.params.field).toBe("timeout");
      expect(result.params.value).toBe(10);
    });

    it("解析'把专员重试次数设为5'", () => {
      const result = parseNaturalLanguage("把专员重试次数设为5");
      expect(result.intent).toBe("update_config");
      expect(result.params.field).toBe("maxRetries");
      expect(result.params.value).toBe(5);
    });

    it("解析'将营销主管重试设为2'", () => {
      const result = parseNaturalLanguage("将营销主管重试设为2");
      expect(result.intent).toBe("update_config");
      expect(result.params.field).toBe("maxRetries");
      expect(result.params.value).toBe(2);
    });

    it("解析'把专员温度设为0.5'", () => {
      const result = parseNaturalLanguage("把专员温度设为0.5");
      expect(result.intent).toBe("update_config");
      expect(result.params.field).toBe("temperature");
      expect(result.params.value).toBe(0.5);
    });

    it("解析'将营销主管温度改成0.3'", () => {
      const result = parseNaturalLanguage("将营销主管温度改成0.3");
      expect(result.intent).toBe("update_config");
      expect(result.params.field).toBe("temperature");
      expect(result.params.value).toBe(0.3);
    });

    it("解析'把营销主管管理幅度设为8'", () => {
      const result = parseNaturalLanguage("把营销主管管理幅度设为8");
      expect(result.intent).toBe("update_config");
      expect(result.params.field).toBe("maxChildren");
      expect(result.params.value).toBe(8);
    });

    it("解析'将主管下属上限设为10'", () => {
      const result = parseNaturalLanguage("将主管下属上限设为10");
      expect(result.intent).toBe("update_config");
      expect(result.params.field).toBe("maxChildren");
      expect(result.params.value).toBe(10);
    });
  });

  // ============================================================
  // SOLO-02: NL 删除/移动 Agent
  // ============================================================
  describe("delete_agent 意图", () => {
    it("解析'删除Agent名叫设计专员'", () => {
      const result = parseNaturalLanguage("删除Agent名叫设计专员");
      expect(result.intent).toBe("delete_agent");
      expect(result.params.agentName).toContain("设计专员");
    });

    it("解析'移除一名营销主管Agent'", () => {
      const result = parseNaturalLanguage("移除一名营销主管Agent");
      expect(result.intent).toBe("delete_agent");
      expect(result.params.agentName).toBeTruthy();
    });

    it("解析'去掉设计专员'", () => {
      const result = parseNaturalLanguage("去掉设计专员");
      expect(result.intent).toBe("delete_agent");
      expect(result.params.agentName).toContain("设计");
    });
  });

  describe("move_agent 意图", () => {
    it("解析'把设计专员移到营销主管下'", () => {
      const result = parseNaturalLanguage("把设计专员移到营销主管下");
      expect(result.intent).toBe("move_agent");
      expect(result.params.agentName).toContain("设计专员");
      expect(result.params.targetParentName).toContain("营销主管");
    });

    it("解析'将专员A调到主管B下面'", () => {
      const result = parseNaturalLanguage("将专员A调到主管B下面");
      expect(result.intent).toBe("move_agent");
      expect(result.params.agentName).toContain("专员A");
      expect(result.params.targetParentName).toContain("主管B");
    });
  });

  // ============================================================
  // KNL-03: 归档 NLU 检索
  // ============================================================
  describe("search_archive 意图", () => {
    it("解析'查找归档中设计海报'", () => {
      const result = parseNaturalLanguage("查找归档中设计海报");
      expect(result.intent).toBe("search_archive");
      expect(result.params.query).toContain("设计海报");
    });

    it("解析'搜索历史关于营销'", () => {
      const result = parseNaturalLanguage("搜索历史关于营销");
      expect(result.intent).toBe("search_archive");
      expect(result.params.query).toContain("营销");
    });

    it("解析'归档中查询预算'", () => {
      const result = parseNaturalLanguage("归档中查询预算");
      expect(result.intent).toBe("search_archive");
      expect(result.params.query).toContain("预算");
    });
  });
});
