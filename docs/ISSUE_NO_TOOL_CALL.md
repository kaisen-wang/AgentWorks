# 问题分析：Agent没有调用工具

## 问题描述

用户报告"没有调用工具"，通过截图分析发现：
- Agent"张三"成功响应了用户请求"写一个打地鼠的H5"
- Agent直接在对话中输出了HTML代码
- **但没有使用工具调用机制**（如Write工具写入文件）

## 根本原因

### 当前实现

**文件：** `src/lib/agent/SpecialistAgent.ts`

```typescript
async execute(task: string, context?: Record<string, unknown>): Promise<ExecutionResult> {
  // 策略 1: 使用 LLM 真正执行
  const response = await callLLM([
    { role: "system", content: systemPrompt },
    { role: "user", content: task },
  ], llmConfig);

  // 直接返回LLM的文本回复
  return {
    success: true,
    data: response.content,  // ← 只是文本，没有工具调用
    cost,
    apiCalls: 1,
  };
}
```

**问题：**
1. Agent只调用LLM生成文本
2. 没有解析LLM的工具调用意图
3. 没有执行实际的工具（Write、Bash等）
4. 结果只是文本输出，没有实际文件操作

### 期望行为

```
用户："写一个打地鼠的H5"
  ↓
Agent调用LLM
  ↓
LLM返回工具调用意图：
{
  "tool_calls": [
    {
      "name": "write",
      "arguments": {
        "file_path": "/tmp/whack-a-mole.html",
        "content": "<!DOCTYPE html>..."
      }
    }
  ]
}
  ↓
Agent执行Write工具
  ↓
文件被创建
  ↓
Agent回复："已创建文件 /tmp/whack-a-mole.html"
```

## 系统已有的工具机制

### 1. 工具注册

**文件：** `src/lib/tools/GlobalToolsRegistry.ts`

已注册的工具：
- `Read` - 读取文件
- `Write` - 写入文件
- `Edit` - 编辑文件
- `Bash` - 执行命令

### 2. 工具执行器

**文件：** `src/lib/skills/executor.ts`

提供工具执行能力。

### 3. 工具类型定义

**文件：** `src/types/index.ts`

定义了工具相关的类型。

## 为什么没有调用工具？

### 原因1：LLM调用方式不正确

当前代码：
```typescript
const response = await callLLM([
  { role: "system", content: systemPrompt },
  { role: "user", content: task },
], llmConfig);
```

**问题：**
- 没有传递工具定义给LLM
- LLM不知道有哪些工具可用
- LLM无法返回工具调用意图

### 原因2：没有工具调用解析

即使LLM返回了工具调用，当前代码也没有解析：
```typescript
return {
  success: true,
  data: response.content,  // ← 只取文本内容
};
```

### 原因3：没有工具执行逻辑

缺少工具执行的代码：
```typescript
// 缺少这部分
for (const toolCall of response.toolCalls) {
  const result = await toolExecutor.execute(toolCall.name, toolCall.arguments);
  // ...
}
```

## 修复方案

### 方案一：完整实现工具调用（推荐）

#### 1. 修改LLM调用，传递工具定义

```typescript
// src/lib/agent/SpecialistAgent.ts

async execute(task: string, context?: Record<string, unknown>): Promise<ExecutionResult> {
  // 获取可用工具
  const tools = await this.getAvailableTools();
  
  // 调用LLM，传递工具定义
  const response = await callLLM(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: task },
    ],
    llmConfig,
    { tools }  // ← 传递工具定义
  );

  // 检查是否有工具调用
  if (response.toolCalls && response.toolCalls.length > 0) {
    // 执行工具调用
    const toolResults = await this.executeTools(response.toolCalls);
    
    // 返回工具执行结果
    return {
      success: true,
      data: this.formatToolResults(toolResults),
      toolCalls: response.toolCalls,
      toolResults,
    };
  }

  // 没有工具调用，返回文本
  return {
    success: true,
    data: response.content,
  };
}
```

#### 2. 实现工具执行方法

```typescript
private async executeTools(toolCalls: ToolCall[]): Promise<ToolResult[]> {
  const results: ToolResult[] = [];
  
  for (const toolCall of toolCalls) {
    try {
      // 获取工具执行器
      const executor = await this.getToolExecutor(toolCall.name);
      
      // 执行工具
      const result = await executor.execute(toolCall.arguments);
      
      results.push({
        toolName: toolCall.name,
        success: true,
        output: result,
      });
    } catch (error) {
      results.push({
        toolName: toolCall.name,
        success: false,
        error: error.message,
      });
    }
  }
  
  return results;
}
```

#### 3. 修改LLM服务，支持工具调用

```typescript
// src/lib/llm/LLMService.ts

export async function callLLM(
  messages: ChatMessage[],
  config: LLMConfig,
  options?: { tools?: ToolDefinition[] }
): Promise<LLMResponse> {
  const requestBody: any = {
    model: config.model,
    messages,
  };

  // 添加工具定义
  if (options?.tools) {
    requestBody.tools = options.tools;
    requestBody.tool_choice = "auto";  // 让LLM决定是否调用工具
  }

  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  const data = await response.json();

  // 解析工具调用
  const toolCalls = data.choices[0].message.tool_calls?.map((tc: any) => ({
    id: tc.id,
    name: tc.function.name,
    arguments: JSON.parse(tc.function.arguments),
  }));

  return {
    content: data.choices[0].message.content || "",
    toolCalls,
    usage: data.usage,
  };
}
```

### 方案二：简化实现（快速修复）

如果暂时不想完整实现工具调用，可以：

#### 1. 在System Prompt中明确指示

```typescript
const systemPrompt = `你是 ${this.name}，一个专员 Agent。${capabilityDesc}

重要：当用户要求创建文件、执行代码等操作时，请：
1. 先说明你要做什么
2. 然后输出完整的内容
3. 最后说明用户如何使用

例如：
- 创建HTML文件：输出完整HTML代码，说明"请将此代码保存为xxx.html文件"
- 执行命令：说明命令内容，提示用户手动执行
`;
```

#### 2. 添加特殊消息类型

```typescript
// 在消息中标记代码块
store.sendMessage(chatId, "code", agentId, result.data, {
  language: "html",
  filename: "whack-a-mole.html",
  executable: true,
});
```

## 实现优先级

### 阶段一：快速修复（1-2小时）
- 修改System Prompt，明确指示Agent行为
- 添加代码块格式化
- 提供用户友好的提示

### 阶段二：部分工具支持（1-2天）
- 实现Write工具调用
- 实现Bash工具调用（受限）
- 添加工具调用日志

### 阶段三：完整工具支持（1周）
- 实现所有工具调用
- 添加工具权限管理
- 实现工具调用链
- 添加工具调用可视化

## 测试用例

### 测试1：创建文件

**输入：** "写一个打地鼠的H5"

**期望输出（方案一）：**
```
已创建文件：/tmp/whack-a-mole.html

文件内容：
[HTML代码]

您可以在浏览器中打开此文件查看效果。
```

**期望输出（方案二）：**
```
我将为您创建一个打地鼠H5游戏。以下是完整的HTML代码：

```html
[HTML代码]
```

请将此代码保存为 `whack-a-mole.html` 文件，然后在浏览器中打开即可游玩。
```

### 测试2：执行命令

**输入：** "列出当前目录的文件"

**期望输出（方案一）：**
```
执行命令：ls -la

结果：
- file1.txt
- file2.js
- ...
```

**期望输出（方案二）：**
```
请在终端执行以下命令查看当前目录文件：

\`\`\`bash
ls -la
\`\`\`

这将列出当前目录的所有文件和详细信息。
```

## 相关文件

- `src/lib/agent/SpecialistAgent.ts` - Agent执行逻辑
- `src/lib/llm/LLMService.ts` - LLM调用服务
- `src/lib/tools/GlobalToolsRegistry.ts` - 工具注册
- `src/lib/skills/executor.ts` - 工具执行器
- `src/types/index.ts` - 类型定义

## 建议

**短期：** 采用方案二（快速修复），改善用户体验

**长期：** 采用方案一（完整实现），实现真正的工具调用

---

**当前状态：** Agent可以生成内容，但没有实际执行工具操作

**下一步：** 根据需求选择方案并实现
