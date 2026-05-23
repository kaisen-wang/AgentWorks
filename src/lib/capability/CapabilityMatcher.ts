/**
 * 能力标签库与匹配引擎（Task 10: ACT-05）
 *
 * 提供：
 * - 预置常用标签库
 * - 任务关键词到能力标签的映射
 * - 根据能力标签自动匹配下属 Agent
 */

import type { Agent, AgentCapability, AgentId } from "@/types";

// ============================================================
// 预置标签库
// ============================================================

export const PRESET_CAPABILITIES: AgentCapability[] = [
  // 内容创作
  { name: "文案撰写", description: "撰写营销文案、产品描述、社交媒体帖子", tools: ["llm"] },
  { name: "图像生成", description: "生成图片、海报、Banner 等视觉内容", tools: ["midjourney", "dalle"] },
  { name: "视频制作", description: "制作短视频、动画、视频剪辑", tools: ["video_editor"] },
  { name: "翻译", description: "多语言翻译", tools: ["llm"] },

  // 营销运营
  { name: "社交媒体发布", description: "发布内容到社交媒体平台", tools: ["twitter_api", "weibo_api"] },
  { name: "SEO优化", description: "搜索引擎优化", tools: ["seo_tool"] },
  { name: "数据分析", description: "数据统计、报表生成、趋势分析", tools: ["python", "sql"] },
  { name: "用户运营", description: "用户增长、留存、活跃度管理", tools: ["analytics"] },

  // 技术开发
  { name: "前端开发", description: "Web/移动端前端开发", tools: ["react", "vue"] },
  { name: "后端开发", description: "服务端 API 开发", tools: ["nodejs", "python"] },
  { name: "测试", description: "自动化测试、QA", tools: ["pytest", "jest"] },
  { name: "部署", description: "CI/CD、服务器部署", tools: ["docker", "k8s"] },

  // 行政财务
  { name: "邮件发送", description: "发送邮件通知", tools: ["gmail", "smtp"] },
  { name: "文档处理", description: "文档撰写、格式转换", tools: ["notion", "docs"] },
  { name: "支付处理", description: "处理支付和订阅", tools: ["stripe"] },
  { name: "客户服务", description: "客户咨询、工单处理", tools: ["zendesk"] },
];

// ============================================================
// 任务关键词 → 能力标签映射
// ============================================================

const KEYWORD_TO_CAPABILITY: Record<string, string[]> = {
  // 内容创作
  "文案|写作|撰写|写|文章|帖子": ["文案撰写"],
  "图|图片|海报|banner|设计|视觉|封面": ["图像生成"],
  "视频|剪辑|动画|短片": ["视频制作"],
  "翻译|多语言|国际化|i18n": ["翻译"],

  // 营销运营
  "发布|推送|发帖|小红书|抖音|公众号|微博": ["社交媒体发布"],
  "SEO|搜索|排名|关键词优化": ["SEO优化"],
  "数据|统计|报表|分析|图表|指标": ["数据分析"],
  "用户|增长|留存|活跃|拉新": ["用户运营"],

  // 技术开发
  "前端|页面|UI|组件|样式": ["前端开发"],
  "后端|API|接口|服务|数据库": ["后端开发"],
  "测试|QA|质量|bug|回归": ["测试"],
  "部署|上线|CI|CD|发布到生产": ["部署"],

  // 行政财务
  "邮件|通知|发送邮件": ["邮件发送"],
  "文档|报告|文档处理|格式": ["文档处理"],
  "支付|付款|订阅|收费": ["支付处理"],
  "客户|咨询|工单|客服": ["客户服务"],
};

/**
 * 从任务描述中提取匹配的能力标签
 */
export function matchCapabilitiesFromTask(taskDescription: string): string[] {
  const matched = new Set<string>();

  for (const [keywordPattern, capabilities] of Object.entries(KEYWORD_TO_CAPABILITY)) {
    const keywords = keywordPattern.split("|");
    for (const keyword of keywords) {
      if (taskDescription.toLowerCase().includes(keyword.toLowerCase())) {
        for (const cap of capabilities) {
          matched.add(cap);
        }
        break; // 该模式已匹配，跳到下一个模式
      }
    }
  }

  return Array.from(matched);
}

/**
 * 根据能力标签匹配最合适的下属 Agent
 *
 * 返回按匹配度排序的 Agent 列表（匹配标签数多的排前面）。
 * 如果无匹配，返回空数组。
 */
export function matchAgentByCapability(
  requiredCapabilities: string[],
  candidates: Agent[]
): { agent: Agent; matchScore: number; matchedTags: string[] }[] {
  const results: { agent: Agent; matchScore: number; matchedTags: string[] }[] = [];

  for (const agent of candidates) {
    const agentTagNames = agent.capabilities.map((c) => c.name);
    const matchedTags = requiredCapabilities.filter((req) =>
      agentTagNames.some((tag) => tag === req || tag.includes(req) || req.includes(tag))
    );

    if (matchedTags.length > 0) {
      results.push({
        agent,
        matchScore: matchedTags.length / requiredCapabilities.length,
        matchedTags,
      });
    }
  }

  // 按匹配度降序排序
  results.sort((a, b) => b.matchScore - a.matchScore);
  return results;
}

/**
 * 查找最佳匹配 Agent（匹配度最高的）
 */
export function findBestMatchAgent(
  requiredCapabilities: string[],
  candidates: Agent[]
): Agent | null {
  const matches = matchAgentByCapability(requiredCapabilities, candidates);
  return matches.length > 0 ? matches[0].agent : null;
}
