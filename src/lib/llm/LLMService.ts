/**
 * LLM 调用层（Task 14: EXT-05）
 *
 * 提供：
 * - 统一 LLM 调用接口
 * - System Prompt 构造
 * - 返回结果解析与校验
 * - 匹配失败时的上报逻辑
 */

import type { AgentId, AgentCapability } from "@/types";

// ============================================================
// LLM 配置
// ============================================================

export interface LLMConfig {
  /** API 端点（如 OpenAI 兼容接口） */
  endpoint: string;
  /** API Key */
  apiKey: string;
  /** 模型名称 */
  model: string;
  /** 温度参数 */
  temperature?: number;
  /** 最大 token 数 */
  maxTokens?: number;
  /** 超时时间 ms */
  timeout?: number;
}

const DEFAULT_CONFIG: Partial<LLMConfig> = {
  temperature: 0.7,
  maxTokens: 8192, // 增加到 8192 以支持生成大型文件
  timeout: 60000, // 增加超时时间到 60 秒
};

// ============================================================
// LLM 请求/响应
// ============================================================

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string; // for tool messages
  tool_call_id?: string; // for tool messages
  tool_calls?: ToolCall[]; // for assistant messages with tool calls
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  model: string;
}

// ============================================================
// 任务拆解 Prompt 构造
// ============================================================

/** 下属信息 */
interface SubordinateInfo {
  id: AgentId;
  name: string;
  capabilities: AgentCapability[];
}

/**
 * 构造任务拆解 System Prompt
 *
 * 包含：角色定义、下属列表+能力标签、输出格式要求
 */
export function buildDecomposeSystemPrompt(subordinates: SubordinateInfo[]): string {
  const subordinateList = subordinates
    .map((s) => {
      const caps = s.capabilities.map((c) => `${c.name}(${c.description})`).join(", ");
      return `- ${s.name} [id: ${s.id}]: ${caps || "无能力标签"}`;
    })
    .join("\n");

  return `你是一个任务拆解专家。你的职责是将宏观任务拆解为可执行的子任务，并分配给最合适的下属 Agent。

## 下属 Agent 列表
${subordinateList}

## 输出格式要求
请严格按以下 JSON 格式输出，不要包含任何其他内容：
\`\`\`json
{
  "subTasks": [
    {
      "assigneeId": "下属Agent的ID",
      "title": "子任务标题（简短）",
      "description": "子任务详细描述"
    }
  ],
  "summary": "拆解总结"
}
\`\`\`

## 拆解原则
1. 每个子任务应明确、可独立执行
2. 根据下属能力标签选择最合适的 Agent
3. 如果没有下属能匹配某子任务，将该子任务的 assigneeId 设为 "UNMATCHED"
4. 子任务之间尽量减少依赖
5. 优先将任务分配给能力最匹配的下属`;
}

/**
 * 构造任务拆解 User Prompt
 */
export function buildDecomposeUserPrompt(taskDescription: string): string {
  return `请将以下宏观任务拆解为子任务并分配给合适的下属：

任务：${taskDescription}`;
}

// ============================================================
// LLM 调用
// ============================================================

/**
 * 调用 LLM（OpenAI 兼容接口）
 */
export async function callLLM(
  messages: ChatMessage[],
  config: LLMConfig,
  options?: { tools?: ToolDefinition[]; toolChoice?: "auto" | "none" | "required" }
): Promise<LLMResponse> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), fullConfig.timeout);

  try {
    const requestBody: any = {
      model: fullConfig.model,
      messages,
      temperature: fullConfig.temperature,
      max_tokens: fullConfig.maxTokens,
    };

    // 添加工具定义
    if (options?.tools && options.tools.length > 0) {
      requestBody.tools = options.tools;
      requestBody.tool_choice = options.toolChoice || "auto";
    }

    const response = await fetch(`${fullConfig.endpoint}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${fullConfig.apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`LLM API 错误: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message;

    // 打印完整的 LLM 响应用于调试
    console.log('📊 [LLM Response] 完整响应数据:');
    console.log('- Content length:', message?.content?.length || 0);
    console.log('- Tool calls count:', message?.tool_calls?.length || 0);
    
    if (message?.tool_calls && message.tool_calls.length > 0) {
      message.tool_calls.forEach((tc: any, index: number) => {
        console.log(`- Tool call ${index + 1}: ${tc.function.name}`);
        console.log(`  - Arguments length: ${tc.function.arguments?.length || 0}`);
        console.log(`  - Arguments preview:`, tc.function.arguments);
      });
    }

    // 解析工具调用
    const toolCalls: ToolCall[] | undefined = message?.tool_calls?.map((tc: any) => {
      // 验证 arguments 是否是有效的 JSON 字符串
      let args = tc.function.arguments;

      // 如果 arguments 不是字符串，尝试转换为 JSON
      if (typeof args !== 'string') {
        args = JSON.stringify(args);
      }

      return {
        id: tc.id,
        type: tc.type,
        function: {
          name: tc.function.name,
          arguments: args,
        },
      };
    });

    return {
      content: message?.content || "",
      toolCalls,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
      model: data.model || fullConfig.model,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================
// 流式调用
// ============================================================

/**
 * 流式调用 LLM（OpenAI 兼容接口）
 *
 * 发起 stream: true 的请求，返回原始 Response 对象，
 * 其 body 为 ReadableStream<Uint8Array>（SSE 字节流），
 * 供 StreamingEngine 消费解析。
 */
export async function callLLMStreaming(
  messages: ChatMessage[],
  config: LLMConfig,
  options?: {
    tools?: ToolDefinition[];
    toolChoice?: "auto" | "none" | "required";
    signal?: AbortSignal;
  },
): Promise<Response> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  const requestBody: Record<string, unknown> = {
    model: fullConfig.model,
    messages,
    temperature: fullConfig.temperature,
    max_tokens: fullConfig.maxTokens,
    stream: true,
  };

  if (options?.tools && options.tools.length > 0) {
    requestBody.tools = options.tools;
    requestBody.tool_choice = options.toolChoice || "auto";
  }

  const response = await fetch(`${fullConfig.endpoint}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${fullConfig.apiKey}`,
    },
    body: JSON.stringify(requestBody),
    signal: options?.signal,
  });

  if (!response.ok) {
    throw new Error(`LLM API 错误: ${response.status} ${response.statusText}`);
  }

  return response;
}

// ============================================================
// 拆解结果解析与校验
// ============================================================

/** 拆解结果 */
export interface DecompositionResult {
  subTasks: {
    assigneeId: AgentId;
    title: string;
    description: string;
  }[];
  summary: string;
  unmatchedTasks?: string[]; // 无法匹配下属的子任务描述
}

/**
 * 解析 LLM 返回的拆解结果
 *
 * 从 LLM 响应中提取 JSON，校验格式，识别 UNMATCHED 任务。
 */
export function parseDecompositionResponse(llmContent: string): DecompositionResult {
  // 提取 JSON（可能被 ```json ``` 包裹）
  let jsonStr = llmContent.trim();

  // 去除 markdown 代码块包裹
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(`LLM 返回内容无法解析为 JSON: ${jsonStr.slice(0, 200)}`);
  }

  // 校验结构
  if (!parsed || typeof parsed !== "object") {
    throw new Error("LLM 返回内容不是有效对象");
  }

  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj.subTasks)) {
    throw new Error("LLM 返回内容缺少 subTasks 数组");
  }

  const subTasks = obj.subTasks as Array<Record<string, unknown>>;
  const unmatchedTasks: string[] = [];

  const validSubTasks = subTasks
    .filter((sub) => {
      const hasRequired = sub.assigneeId && sub.title && sub.description;
      if (!hasRequired) return false;
      // 检查 UNMATCHED
      if (sub.assigneeId === "UNMATCHED") {
        unmatchedTasks.push(String(sub.description));
        return false;
      }
      return true;
    })
    .map((sub) => ({
      assigneeId: String(sub.assigneeId),
      title: String(sub.title),
      description: String(sub.description),
    }));

  return {
    subTasks: validSubTasks,
    summary: String(obj.summary || `拆解为 ${validSubTasks.length} 个子任务`),
    unmatchedTasks: unmatchedTasks.length > 0 ? unmatchedTasks : undefined,
  };
}

// ============================================================
// 完整拆解流程
// ============================================================

/**
 * 使用 LLM 执行任务拆解
 *
 * 完整流程：构造 Prompt → 调用 LLM → 解析结果 → 校验 assigneeId
 */
export async function decomposeWithLLM(
  taskDescription: string,
  subordinates: SubordinateInfo[],
  llmConfig: LLMConfig
): Promise<DecompositionResult> {
  const systemPrompt = buildDecomposeSystemPrompt(subordinates);
  const userPrompt = buildDecomposeUserPrompt(taskDescription);

  const response = await callLLM(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    llmConfig
  );

  const result = parseDecompositionResponse(response.content);

  // 校验 assigneeId 是否在下属列表中
  const validIds = new Set(subordinates.map((s) => s.id));
  const invalidTasks = result.subTasks.filter((sub) => !validIds.has(sub.assigneeId));

  if (invalidTasks.length > 0) {
    // 将无效 ID 的任务标记为 UNMATCHED
    for (const task of invalidTasks) {
      if (!result.unmatchedTasks) result.unmatchedTasks = [];
      result.unmatchedTasks.push(`${task.title}: ${task.description}（assigneeId ${task.assigneeId} 不在下属列表中）`);
    }
    result.subTasks = result.subTasks.filter((sub) => validIds.has(sub.assigneeId));
  }

  return result;
}
