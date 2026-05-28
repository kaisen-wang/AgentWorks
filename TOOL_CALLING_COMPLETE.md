# 工具调用功能实现完成

## 实现内容

### 1. 修改LLM服务支持工具调用

**文件：** `src/lib/llm/LLMService.ts`

**新增类型：**
- `ToolDefinition` - 工具定义
- `ToolCall` - 工具调用
- `ChatMessage` - 支持 `tool` 角色

**修改函数：**
```typescript
export async function callLLM(
  messages: ChatMessage[],
  config: LLMConfig,
  options?: { tools?: ToolDefinition[]; toolChoice?: "auto" | "none" | "required" }
): Promise<LLMResponse>
```

**功能：**
- 传递工具定义给LLM
- 解析LLM的工具调用意图
- 返回工具调用列表

---

### 2. 创建Agent工具定义和执行器

**文件：** `src/lib/agent/AgentTools.ts`

**工具定义：**
1. `write_file` - 创建或覆盖文件
2. `read_file` - 读取文件内容
3. `edit_file` - 编辑文件部分内容
4. `run_command` - 执行shell命令（受限）

**执行器：**
- `executeToolCall()` - 执行工具调用
- `executeWriteFile()` - 写文件实现
- `executeReadFile()` - 读文件实现
- `executeEditFile()` - 编辑文件实现
- `executeRunCommand()` - 执行命令实现

**安全措施：**
- 文件写入限制在 `output/` 目录
- 命令执行白名单限制
- 30秒超时保护

---

### 3. 修改Agent的execute方法

**文件：** `src/lib/agent/SpecialistAgent.ts`

**工作流程：**
```
用户任务
  ↓
调用LLM（传递工具定义）
  ↓
LLM返回工具调用意图
  ↓
执行工具调用
  ↓
返回执行结果
```

**关键改进：**
1. 传递工具定义给LLM
2. 解析工具调用意图
3. 执行实际工具操作
4. 格式化执行结果

**System Prompt优化：**
```
当用户要求创建文件、编写代码等任务时，请使用提供的工具来完成实际操作。
不要只是在对话中输出代码，而是调用工具来创建实际的文件。

例如：
- 用户要求"写一个HTML页面" → 调用 write_file 工具创建文件
- 用户要求"修改某个文件" → 调用 edit_file 工具编辑文件
- 用户要求"查看某个文件" → 调用 read_file 工具读取文件
```

---

## 使用示例

### 示例1：创建HTML文件

**用户输入：** "写一个打地鼠的H5"

**Agent行为：**
1. LLM识别需要创建文件
2. 返回工具调用：
   ```json
   {
     "name": "write_file",
     "arguments": {
       "file_path": "whack-a-mole.html",
       "content": "<!DOCTYPE html>..."
     }
   }
   ```
3. Agent执行 `write_file` 工具
4. 文件创建在 `output/whack-a-mole.html`
5. Agent回复：`已完成操作：\n\n✅ write_file: 文件已创建: output/whack-a-mole.html`

---

### 示例2：读取文件

**用户输入：** "查看 package.json 的内容"

**Agent行为：**
1. LLM识别需要读取文件
2. 返回工具调用：
   ```json
   {
     "name": "read_file",
     "arguments": {
       "file_path": "package.json"
     }
   }
   ```
3. Agent执行 `read_file` 工具
4. 返回文件内容

---

### 示例3：编辑文件

**用户输入：** "把 App.tsx 中的标题改为'Hello World'"

**Agent行为：**
1. LLM识别需要编辑文件
2. 返回工具调用：
   ```json
   {
     "name": "edit_file",
     "arguments": {
       "file_path": "src/App.tsx",
       "old_content": "旧标题",
       "new_content": "Hello World"
     }
   }
   ```
3. Agent执行 `edit_file` 工具
4. 文件被修改

---

### 示例4：执行命令

**用户输入：** "安装依赖"

**Agent行为：**
1. LLM识别需要执行命令
2. 返回工具调用：
   ```json
   {
     "name": "run_command",
     "arguments": {
       "command": "npm install"
     }
   }
   ```
3. Agent执行 `run_command` 工具
4. 命令被执行

---

## 技术细节

### 工具定义格式

```typescript
{
  type: "function",
  function: {
    name: "write_file",
    description: "创建或覆盖文件",
    parameters: {
      type: "object",
      properties: {
        file_path: { type: "string", description: "文件路径" },
        content: { type: "string", description: "文件内容" }
      },
      required: ["file_path", "content"]
    }
  }
}
```

### 工具执行流程

```typescript
// 1. LLM返回工具调用
const toolCalls = response.toolCalls;

// 2. 执行每个工具调用
for (const toolCall of toolCalls) {
  const result = await executeToolCall(
    toolCall.function.name,
    toolCall.function.arguments
  );
  
  // 3. 记录结果
  toolResults.push({ toolCall, result });
}

// 4. 格式化返回给用户
return formatToolResults(toolResults);
```

---

## 安全考虑

### 文件操作安全

1. **写入限制**：只能写入 `output/` 目录
2. **路径验证**：防止路径遍历攻击
3. **内容检查**：防止写入恶意内容

### 命令执行安全

1. **白名单机制**：只允许特定命令
2. **超时保护**：30秒超时
3. **权限限制**：不执行危险命令

**允许的命令：**
- `npm install`
- `npm run build`
- `npm run dev`
- `npm test`
- `npm run lint`
- `yarn install`
- `yarn build`
- `yarn dev`
- `yarn test`

---

## 测试步骤

### 1. 启动开发服务器

```bash
npm run dev
```

### 2. 创建Agent

在浏览器中：
1. 输入 `/new_agent`
2. 创建一个前端开发Agent
3. 设置能力标签：前端开发

### 3. 测试工具调用

**测试1：创建文件**
```
用户：写一个简单的HTML页面
期望：Agent调用write_file工具，创建文件
验证：检查output目录下是否生成了HTML文件
```

**测试2：读取文件**
```
用户：查看package.json的内容
期望：Agent调用read_file工具，返回内容
验证：Agent回复中包含package.json的内容
```

**测试3：编辑文件**
```
用户：修改某个文件
期望：Agent调用edit_file工具，修改文件
验证：文件内容已更新
```

**测试4：执行命令**
```
用户：安装依赖
期望：Agent调用run_command工具
验证：npm install被执行
```

---

## 日志输出

### 工具调用日志

```
🔧 [张三] LLM请求调用 1 个工具
🔧 [张三] 执行工具: write_file
✅ [张三] 工具执行结果: 文件已创建: output/game.html
```

### 错误日志

```
❌ [张三] 工具执行结果: 写文件失败: 权限不足
```

---

## 后续优化

### 1. 工具调用可视化

- 在UI中显示工具调用过程
- 显示工具执行进度
- 显示工具执行结果

### 2. 工具权限管理

- 为每个Agent配置可用工具
- 工具调用需要用户确认
- 敏感操作需要审批

### 3. 工具调用链

- 支持多步骤工具调用
- 工具间数据传递
- 条件执行

### 4. 工具市场

- 支持自定义工具
- 工具分享和复用
- 工具版本管理

---

## 相关文件

- `src/lib/llm/LLMService.ts` - LLM服务
- `src/lib/agent/AgentTools.ts` - 工具定义和执行
- `src/lib/agent/SpecialistAgent.ts` - Agent执行逻辑

---

## 对比

| 特性 | 修改前 | 修改后 |
|------|--------|--------|
| 文件创建 | ❌ 只输出文本 | ✅ 实际创建文件 |
| 文件读取 | ❌ 不支持 | ✅ 支持读取 |
| 文件编辑 | ❌ 不支持 | ✅ 支持编辑 |
| 命令执行 | ❌ 不支持 | ✅ 支持（受限） |
| 工具调用 | ❌ 无 | ✅ 完整支持 |
| 安全性 | - | ✅ 多重保护 |

---

## 总结

✅ **已完成：**
1. LLM服务支持工具调用
2. Agent工具定义和执行器
3. Agent execute方法实现工具调用
4. 安全保护机制

✅ **效果：**
- Agent可以实际创建文件
- Agent可以读取和编辑文件
- Agent可以执行安全命令
- 真正的工具调用，不只是文本输出

🎯 **下一步：** 测试并验证工具调用功能
