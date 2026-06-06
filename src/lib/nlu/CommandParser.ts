/**
 * NLU 命令解析器 (ORG-01, SOLO-02, KNL-02)
 *
 * 将自然语言输入解析为结构化操作指令。
 * 支持的意图：
 * - create_agent: 创建 Agent
 * - update_config: 修改 Agent 配置
 * - update_knowledge: 更新知识库
 * - run_script: 运行剧本
 * - set_threshold: 设置决策阈值
 */

import type { AgentRole } from "@/types";
import { matchCapabilitiesFromList } from "@/lib/capability/CapabilityMatcher";
import type { AgentCapability } from "@/types";

// ============================================================
// 解析结果类型
// ============================================================

export type NLUIntent =
  | "create_agent"
  | "delete_agent"
  | "move_agent"
  | "update_config"
  | "update_knowledge"
  | "run_script"
  | "set_threshold"
  | "search_archive"
  | "add_capability"      // SOLO-02: 添加能力标签
  | "remove_capability"   // SOLO-02: 移除能力标签
  | "set_archive_policy"  // SOLO-02: 归档策略配置
  | "unknown";

export interface NLUParseResult {
  intent: NLUIntent;
  confidence: number; // 0-1
  params: Record<string, unknown>;
  raw: string;
}

// ============================================================
// 角色关键词映射
// ============================================================

const ROLE_KEYWORDS: Record<string, AgentRole> = {
  "主管": "supervisor",
  "经理": "supervisor",
  "总监": "supervisor",
  "负责人": "supervisor",
  "专员": "specialist",
  "设计师": "specialist",
  "工程师": "specialist",
  "助理": "specialist",
  "发布": "specialist",
  "运营": "specialist",
};

const MODEL_KEYWORDS: Record<string, string> = {
  "deepseek-v4-flash": "deepseek-v4-flash",
  "deepseek": "deepseek-v4-flash",
  "gpt-4o": "gpt-4o",
  "4o": "gpt-4o",
  "gpt-4": "deepseek-v4-flash",
  "gpt4": "deepseek-v4-flash",
  "gpt-3.5": "gpt-3.5-turbo",
  "gpt3.5": "gpt-3.5-turbo",
  "gpt-3": "gpt-3.5-turbo",
  "claude": "claude-3-sonnet",
  "sonnet": "claude-3-sonnet",
  "haiku": "claude-3-haiku",
};

// ============================================================
// 解析器
// ============================================================

/**
 * 解析自然语言输入，识别意图并提取参数
 */
export async function parseNaturalLanguage(input: string): Promise<NLUParseResult> {
  const text = input.trim();

  // 1. 创建 Agent 意图
  const createResult = await parseCreateAgent(text);
  if (createResult) return createResult;

  // 2. 删除 Agent 意图 (SOLO-02)
  const deleteResult = parseDeleteAgent(text);
  if (deleteResult) return deleteResult;

  // 3. 移动 Agent 意图 (SOLO-02)
  const moveResult = parseMoveAgent(text);
  if (moveResult) return moveResult;

  // 4. 设置决策阈值意图
  const thresholdResult = parseSetThreshold(text);
  if (thresholdResult) return thresholdResult;

  // 5. 更新知识库意图
  const knowledgeResult = parseUpdateKnowledge(text);
  if (knowledgeResult) return knowledgeResult;

  // 6. 运行剧本意图
  const scriptResult = parseRunScript(text);
  if (scriptResult) return scriptResult;

  // 7. 修改配置意图
  const configResult = parseUpdateConfig(text);
  if (configResult) return configResult;

  // 8. 归档检索意图 (KNL-03)
  const archiveResult = parseSearchArchive(text);
  if (archiveResult) return archiveResult;

  // 9. 添加能力标签意图 (SOLO-02)
  const addCapResult = parseAddCapability(text);
  if (addCapResult) return addCapResult;

  // 10. 移除能力标签意图 (SOLO-02)
  const removeCapResult = parseRemoveCapability(text);
  if (removeCapResult) return removeCapResult;

  // 11. 归档策略配置意图 (SOLO-02)
  const archivePolicyResult = parseSetArchivePolicy(text);
  if (archivePolicyResult) return archivePolicyResult;

  return { intent: "unknown", confidence: 0, params: {}, raw: text };
}

// ============================================================
// 意图解析器
// ============================================================

/** 解析"创建Agent"意图 */
async function parseCreateAgent(text: string): Promise<NLUParseResult | null> {
  // 匹配模式：创建/新建/添加 + Agent/agent/员工/助手 + 名称 + 可选配置
  const createPatterns = [
    /(?:创建|新建|添加)(?:一名|一个|个)?Agent(?:名叫|名为|叫)(.+)/,
    /(?:创建|新建|添加)(?:一名|一个|个)?Agent\s+(.+)/,
    /创建(?:一名|一个|个)?(.+?)(?:Agent|agent|员工|助手|专员)/,
    /新建(?:一名|一个|个)?(.+?)(?:Agent|agent|员工|助手|专员)/,
    /添加(?:一名|一个|个)?(.+?)(?:Agent|agent|员工|助手|专员)/,
  ];

  for (const pattern of createPatterns) {
    const match = text.match(pattern);
    if (match) {
      const namePart = match[1].trim();
      const params: Record<string, unknown> = {};

      // 提取角色
      let role: AgentRole = "specialist";
      for (const [keyword, r] of Object.entries(ROLE_KEYWORDS)) {
        if (namePart.includes(keyword)) {
          role = r;
          break;
        }
      }
      params.role = role;

      // 提取名称（去掉名称开头的角色关键词）
      let name = namePart;
      for (const keyword of Object.keys(ROLE_KEYWORDS)) {
        if (name.startsWith(keyword)) {
          name = name.slice(keyword.length);
        }
      }
      name = name.trim() || namePart;
      params.name = name;

      // 提取模型
      for (const [keyword, model] of Object.entries(MODEL_KEYWORDS)) {
        if (text.toLowerCase().includes(keyword)) {
          params.model = model;
          break;
        }
      }

      // 提取预算
      const budgetMatch = text.match(/预算\s*[$￥]?\s*(\d+)/);
      if (budgetMatch) {
        params.monthlyBudget = Number(budgetMatch[1]);
      }

      // ORG-01/ACT-05: 从自然语言中提取能力标签
      // 通过 API 获取 skills 数据，使用 matchCapabilitiesFromList 匹配
      let allCaps: AgentCapability[] = [];
      try {
        const res = await fetch("/api/skills");
        const data = await res.json();
        if (data.success && Array.isArray(data.skills)) {
          allCaps = data.skills.map((s: any) => ({
            name: s.name,
            description: s.description || `Skill: ${s.name}`,
            tools: s.tags || [],
          }));
        }
      } catch {
        // API 不可用时静默跳过
      }

      const capabilityNames = matchCapabilitiesFromList(namePart, allCaps);
      if (capabilityNames.length > 0) {
        const capabilities: AgentCapability[] = capabilityNames
          .map((name) => allCaps.find((c) => c.name === name))
          .filter((c): c is AgentCapability => c !== undefined);
        params.capabilities = capabilities;
      }

      return {
        intent: "create_agent",
        confidence: 0.85,
        params,
        raw: text,
      };
    }
  }

  return null;
}

/** 解析"设置决策阈值"意图 */
function parseSetThreshold(text: string): NLUParseResult | null {
  // 匹配："以后营销主管对于5元以内的修改自行批准"
  // 或："设置决策阈值为5元"
  const patterns = [
    /(?:设置|设定|配置)(?:决策)?阈值(?:为|是|到)\s*[$￥]?\s*(\d+)/,
    /(\S+?)(?:对于|对)\s*[$￥]?\s*(\d+)\s*元?(?:以内|以下|之内)(?:的)?(?:修改|操作|变更)?(?:自行|自动|自己)(?:批准|处理|决定)/,
    /(\S+?)(?:的)?(?:决策)?阈值(?:设为|设到|改为|改成)\s*[$￥]?\s*(\d+)/,
  ];

  for (let i = 0; i < patterns.length; i++) {
    const match = text.match(patterns[i]);
    if (match) {
      const params: Record<string, unknown> = {};
      if (i === 0) {
        params.threshold = Number(match[1]);
      } else {
        params.agentName = match[1];
        params.threshold = Number(match[2]);
      }
      return {
        intent: "set_threshold",
        confidence: 0.8,
        params,
        raw: text,
      };
    }
  }

  return null;
}

/** 解析"更新知识库"意图 */
function parseUpdateKnowledge(text: string): NLUParseResult | null {
  // 匹配："告诉营销主管品牌色是#00FF00"
  // 或："设置全局知识 brand_color = #00FF00"

  // 模式1: "告诉XXX" — 需要找到第一个"是/为/="来分割
  if (text.startsWith("告诉")) {
    const rest = text.slice(2);
    const sepIdx = rest.search(/是|为|=/);
    if (sepIdx > 0) {
      const fullKey = rest.slice(0, sepIdx).trim();
      const value = rest.slice(sepIdx + 1).trim();
      if (fullKey && value) {
        const params: Record<string, unknown> = { value, scope: "department" };
        // 从 fullKey 中分离 agentName 和 key
        const lastSpaceIdx = fullKey.lastIndexOf(" ");
        if (lastSpaceIdx > 0) {
          params.agentName = fullKey.slice(0, lastSpaceIdx).trim();
          params.key = fullKey.slice(lastSpaceIdx + 1).trim();
        } else {
          // 没有空格，按角色关键词拆分
          let splitIdx = -1;
          for (const keyword of Object.keys(ROLE_KEYWORDS)) {
            const idx = fullKey.indexOf(keyword);
            if (idx >= 0) {
              splitIdx = idx + keyword.length;
              break;
            }
          }
          if (splitIdx > 0 && splitIdx < fullKey.length) {
            params.agentName = fullKey.slice(0, splitIdx).trim();
            params.key = fullKey.slice(splitIdx).trim();
          } else {
            params.agentName = fullKey;
            params.key = "";
          }
        }
        return { intent: "update_knowledge", confidence: 0.75, params, raw: text };
      }
    }
  }

  // 模式2: "设置/更新/添加知识"
  const pattern = /(?:设置|更新|添加)(?:全局|部门|个人)?知识(?:库)?\s+(\S+)\s*(?:是|为|=)\s*(.+)/;
  const match = text.match(pattern);
  if (match) {
    const params: Record<string, unknown> = {
      key: match[1],
      value: match[2].trim(),
    };
    if (text.includes("全局")) params.scope = "global";
    else if (text.includes("个人")) params.scope = "personal";
    else params.scope = "department";
    return { intent: "update_knowledge", confidence: 0.75, params, raw: text };
  }

  return null;
}

/** 解析"运行剧本"意图 */
function parseRunScript(text: string): NLUParseResult | null {
  const patterns = [
    /(?:运行|执行|启动)(?:剧本|流程)?[:：]?\s*(.+?)(?:，|,|\s+(?:替换|改为|换成))\s*(.+)/,
    /(?:运行|执行|启动)(?:剧本|流程)?[:：]?\s*(.+)/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const params: Record<string, unknown> = {
        scriptName: match[1].trim(),
      };
      if (match[2]) {
        params.replacements = match[2].trim();
      }
      return {
        intent: "run_script",
        confidence: 0.8,
        params,
        raw: text,
      };
    }
  }

  return null;
}

/** 解析"修改配置"意图 */
function parseUpdateConfig(text: string): NLUParseResult | null {
  // 匹配："把营销主管的模型改成GPT-3.5"
  // 或："将设计专员的预算调整为$15"

  // 检查模型修改
  const modelKeywords = ["模型改成", "模型改为", "模型换成", "模型切换到", "模型切换成"];
  for (const kw of modelKeywords) {
    const idx = text.indexOf(kw);
    if (idx > 0) {
      const before = text.slice(0, idx).replace(/^(把|将)\s*/, "").replace(/的$/, "").trim();
      const after = text.slice(idx + kw.length).trim();
      if (before && after) {
        const model = MODEL_KEYWORDS[after.toLowerCase()] || after;
        return {
          intent: "update_config",
          confidence: 0.8,
          params: { agentName: before, field: "model", value: model },
          raw: text,
        };
      }
    }
  }

  // 检查预算修改
  const budgetKeywords = ["预算改成", "预算改为", "预算设为", "预算调整到", "预算调整为"];
  for (const kw of budgetKeywords) {
    const idx = text.indexOf(kw);
    if (idx > 0) {
      const before = text.slice(0, idx).replace(/^(把|将)\s*/, "").replace(/的$/, "").trim();
      const after = text.slice(idx + kw.length).replace(/^[$￥]\s*/, "").trim();
      const budget = parseInt(after, 10);
      if (before && !isNaN(budget)) {
        return {
          intent: "update_config",
          confidence: 0.8,
          params: { agentName: before, field: "monthlyBudget", value: budget },
          raw: text,
        };
      }
    }
  }

  // 检查超时修改 (SOLO-02)
  const timeoutKeywords = ["超时改成", "超时改为", "超时设为", "超时调整到", "超时设置为"];
  for (const kw of timeoutKeywords) {
    const idx = text.indexOf(kw);
    if (idx > 0) {
      const before = text.slice(0, idx).replace(/^(把|将)\s*/, "").replace(/的$/, "").trim();
      const after = text.slice(idx + kw.length).trim();
      const timeout = parseInt(after, 10);
      if (before && !isNaN(timeout)) {
        return {
          intent: "update_config",
          confidence: 0.8,
          params: { agentName: before, field: "timeout", value: timeout },
          raw: text,
        };
      }
    }
  }

  // 检查重试次数修改 (SOLO-02)
  const retryKeywords = ["重试次数改成", "重试次数改为", "重试次数设为", "重试设为"];
  for (const kw of retryKeywords) {
    const idx = text.indexOf(kw);
    if (idx > 0) {
      const before = text.slice(0, idx).replace(/^(把|将)\s*/, "").replace(/的$/, "").trim();
      const after = text.slice(idx + kw.length).trim();
      const maxRetries = parseInt(after, 10);
      if (before && !isNaN(maxRetries)) {
        return {
          intent: "update_config",
          confidence: 0.8,
          params: { agentName: before, field: "maxRetries", value: maxRetries },
          raw: text,
        };
      }
    }
  }

  // 检查温度修改 (SOLO-02)
  const tempKeywords = ["温度改成", "温度改为", "温度设为", "温度调整到"];
  for (const kw of tempKeywords) {
    const idx = text.indexOf(kw);
    if (idx > 0) {
      const before = text.slice(0, idx).replace(/^(把|将)\s*/, "").replace(/的$/, "").trim();
      const after = text.slice(idx + kw.length).trim();
      const temperature = parseFloat(after);
      if (before && !isNaN(temperature)) {
        return {
          intent: "update_config",
          confidence: 0.8,
          params: { agentName: before, field: "temperature", value: temperature },
          raw: text,
        };
      }
    }
  }

  // 检查管理幅度修改 (SOLO-02, ORG-03)
  const maxChildrenKeywords = ["管理幅度改成", "管理幅度改为", "管理幅度设为", "下属上限设为"];
  for (const kw of maxChildrenKeywords) {
    const idx = text.indexOf(kw);
    if (idx > 0) {
      const before = text.slice(0, idx).replace(/^(把|将)\s*/, "").replace(/的$/, "").trim();
      const after = text.slice(idx + kw.length).trim();
      const maxChildren = parseInt(after, 10);
      if (before && !isNaN(maxChildren)) {
        return {
          intent: "update_config",
          confidence: 0.8,
          params: { agentName: before, field: "maxChildren", value: maxChildren },
          raw: text,
        };
      }
    }
  }

  // 检查上报频率修改 (BUP-03)
  const reportFreqKeywords = ["上报频率改成", "上报频率改为", "上报频率设为", "上报频率设置为"];
  for (const kw of reportFreqKeywords) {
    const idx = text.indexOf(kw);
    if (idx > 0) {
      const before = text.slice(0, idx).replace(/^(把|将)\s*/, "").replace(/的$/, "").trim();
      const after = text.slice(idx + kw.length).trim();
      const freqMap: Record<string, string> = { "完成时": "on_completion", "每日": "daily", "每天": "daily", "每周": "weekly", "每星期": "weekly" };
      const freq = freqMap[after] || after;
      if (before && freq) {
        return {
          intent: "update_config",
          confidence: 0.8,
          params: { agentName: before, field: "reportFrequency", value: freq },
          raw: text,
        };
      }
    }
  }

  return null;
}

/** 解析"删除Agent"意图 (SOLO-02) */
function parseDeleteAgent(text: string): NLUParseResult | null {
  const patterns = [
    /(?:删除|移除|去掉)(?:一名|一个|个)?Agent(?:名叫|名为|叫)?(.+)/,
    /(?:删除|移除|去掉)(?:一名|一个|个)?(.+?)(?:Agent|agent|员工|助手|专员|主管)/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const namePart = match[1].trim();
      return {
        intent: "delete_agent",
        confidence: 0.85,
        params: { agentName: namePart },
        raw: text,
      };
    }
  }

  return null;
}

/** 解析"移动Agent"意图 (SOLO-02) */
function parseMoveAgent(text: string): NLUParseResult | null {
  // 匹配："把设计专员移到营销主管下" / "将专员A调到主管B下面"
  const patterns = [
    /(?:把|将)\s*(.+?)(?:移到|移至|调到|调至|移到.+?下|调到.+?下)\s*(.+)/,
    /(.+?)(?:移到|调到|移至|调至)\s*(.+)/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const agentName = match[1].replace(/^(把|将)\s*/, "").trim();
      const targetPart = match[2].replace(/下(面)?$/, "").trim();
      if (agentName && targetPart) {
        return {
          intent: "move_agent",
          confidence: 0.8,
          params: { agentName, targetParentName: targetPart },
          raw: text,
        };
      }
    }
  }

  return null;
}

/** 解析"归档检索"意图 (KNL-03) */
function parseSearchArchive(text: string): NLUParseResult | null {
  const patterns = [
    /(?:查找|搜索|查询|检索|查看)(?:归档|历史|记录)(?:中|里)?(?:的|关于|包含)?(.+)/,
    /(?:归档|历史|记录)(?:中|里)?(?:查找|搜索|查询|检索)(.+)/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const query = match[1].trim();
      if (query) {
        return {
          intent: "search_archive",
          confidence: 0.85,
          params: { query },
          raw: text,
        };
      }
    }
  }

  return null;
}

/** 解析"添加能力标签"意图 (SOLO-02) */
function parseAddCapability(text: string): NLUParseResult | null {
  // 匹配："给营销主管添加文案撰写能力" / "让设计专员具备图像生成能力"
  const patterns = [
    /(?:给|为|让)(.+?)(?:添加|增加|赋予|具备)(.+?)(?:能力|标签|技能)/,
    /(?:添加|增加|赋予)(.+?)(?:能力|标签|技能)(?:给|到|至)(.+)/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const agentName = match[1].trim();
      const capabilityStr = match[2].trim();
      // 直接使用能力描述作为标签名（精确匹配需通过 API，此处简化处理）
      const matchedNames = [capabilityStr];
      return {
        intent: "add_capability",
        confidence: 0.8,
        params: { agentName, capabilityNames: matchedNames.length > 0 ? matchedNames : [capabilityStr] },
        raw: text,
      };
    }
  }

  return null;
}

/** 解析"移除能力标签"意图 (SOLO-02) */
function parseRemoveCapability(text: string): NLUParseResult | null {
  // 匹配："移除营销主管的文案撰写能力" / "去掉设计专员的图像生成标签"
  const patterns = [
    /(?:移除|去掉|删除|取消)(.+?)(?:的)?(.+?)(?:能力|标签|技能)/,
    /(?:给|为)(.+?)(?:移除|去掉|删除|取消)(.+?)(?:能力|标签|技能)/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const agentName = match[1].trim();
      const capabilityStr = match[2].trim();
      const matchedNames = [capabilityStr];
      return {
        intent: "remove_capability",
        confidence: 0.8,
        params: { agentName, capabilityNames: matchedNames.length > 0 ? matchedNames : [capabilityStr] },
        raw: text,
      };
    }
  }

  return null;
}

/** 解析"归档策略配置"意图 (SOLO-02) */
function parseSetArchivePolicy(text: string): NLUParseResult | null {
  // 匹配："设置归档保留30天" / "归档策略改为自动清理" / "设置归档自动清理90天"
  const patterns = [
    /(?:设置|配置|设定)(?:归档)?(?:保留|保存|清理)(?:期|时间|天数)?(?:为|到|设为)?\s*(\d+)\s*天/,
    /(?:归档)(?:策略|规则|配置)(?:改为|设为|设置为)\s*(.+)/,
    /(?:设置|配置)(?:归档)(?:策略|规则|自动清理)(?:为|到)?\s*(.+)/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const params: Record<string, unknown> = {};
      const value = match[1].trim();
      const days = parseInt(value, 10);
      if (!isNaN(days)) {
        params.retentionDays = days;
      } else {
        params.policy = value;
      }
      return {
        intent: "set_archive_policy",
        confidence: 0.8,
        params,
        raw: text,
      };
    }
  }

  return null;
}
