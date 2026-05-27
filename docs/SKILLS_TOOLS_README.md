# Skills 和 Tools 架构设计

## 概述

本实现提供了完整的 Agent-Skills-Tools 架构，支持：

- **Agent 一对多 Skills 一对多 Tools**
- **Agent 直接一对多 Tools**
- **Skills 分全局和 Agent 私有**
- **Tools 分全局和 Agent 私有**

## 核心概念

### 1. Skill（技能）

Skill 是 Agent 的高级能力封装，可以依赖多个 Tools。

```typescript
interface SkillDefinition {
  meta: SkillMeta;              // 元数据
  inputSchema: JSONSchema;      // 输入参数 Schema
  outputSchema: JSONSchema;     // 输出结果 Schema
  dependencies: ToolDependency[]; // 依赖的 Tools
  executor: SkillExecutor;      // 执行函数
  config?: Record<string, any>; // 配置
}
```

### 2. Tool（工具）

Tool 是底层执行单元，分为 MCP Tool 和 Custom Tool。

```typescript
// MCP Tool
interface MCPToolDefinition {
  type: 'mcp';
  meta: ToolMeta;
  endpoint: string;             // MCP 服务器端点
  toolName: string;             // MCP 工具名称
  inputSchema: JSONSchema;
  outputSchema: JSONSchema;
  authType?: 'bearer' | 'basic' | 'none';
  authConfig?: {...};
  timeout?: number;
}

// Custom Tool
interface CustomToolDefinition {
  type: 'custom';
  meta: ToolMeta;
  inputSchema: JSONSchema;
  outputSchema: JSONSchema;
  executor: ToolExecutor;       // 自定义执行函数
  config?: Record<string, any>;
}
```

### 3. 资源范围

- **全局资源（global）**：所有 Agent 可访问
- **私有资源（private）**：仅所有者 Agent 可访问

## 架构设计

### 核心组件

```
┌─────────────────────────────────────────────────────────┐
│                    Agent                                 │
│  ┌──────────────────────────────────────────────────┐  │
│  │  skillIds: ['skill-1', 'skill-2']                │  │
│  │  toolIds: ['tool-1', 'tool-2']                   │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              SkillRegistry                              │
│  - register(skill, scope, agentId?)                    │
│  - find(agentId, skillId)                              │
│  - load(skillId) → LoadedSkill                         │
│  - healthCheck(skillId)                                │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              ToolRegistry                               │
│  - register(tool, scope, agentId?)                     │
│  - find(agentId, toolId)                               │
│  - execute(toolId, params)                             │
│  - healthCheck(toolId)                                 │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              ResourceManager                            │
│  - GlobalPool                                          │
│  - PrivatePool                                         │
│  - find(agentId, resourceId)                           │
└─────────────────────────────────────────────────────────┘
```

### 数据流

```
1. 注册 Skill
   SkillDefinition → SkillRegistry → ResourceManager → Database

2. 加载 Skill
   skillId → SkillRegistry.load() → DependencyResolver → ToolRegistry → LoadedSkill

3. 执行 Skill
   (agentId, skillId, params) → SkillExecutor → LoadedSkill.executor() → SkillResult

4. 执行 Tool
   (toolId, params) → ToolExecutor → ToolRegistry.execute() → ToolResult
```

## 使用指南

### 1. 初始化

```typescript
import { createSkillsToolsManager } from '@/lib/skills';

const manager = createSkillsToolsManager();
```

### 2. 注册 Tool

```typescript
// 全局 Tool
await manager.toolRegistry.register({
  type: 'custom',
  meta: {
    id: 'weather-tool',
    name: 'Weather Tool',
    description: 'Get weather information',
    version: '1.0.0',
  },
  inputSchema: {
    type: 'object',
    properties: { city: { type: 'string' } },
    required: ['city'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      temperature: { type: 'number' },
      condition: { type: 'string' },
    },
  },
  executor: async (params) => {
    // 实现逻辑
    return { success: true, data: { temperature: 25, condition: 'Sunny' } };
  },
}, 'global');

// 私有 Tool
await manager.toolRegistry.register(toolDefinition, 'private', 'agent-001');
```

### 3. 注册 Skill

```typescript
await manager.skillRegistry.register({
  meta: {
    id: 'weather-report-skill',
    name: 'Weather Report Skill',
    description: 'Generate weather report',
    version: '1.0.0',
  },
  inputSchema: {
    type: 'object',
    properties: { city: { type: 'string' } },
    required: ['city'],
  },
  outputSchema: {
    type: 'object',
    properties: { report: { type: 'string' } },
  },
  dependencies: [
    { toolId: 'weather-tool', required: true },
  ],
  executor: async (context, params) => {
    const weatherTool = context.tools.get('weather-tool');
    const result = await weatherTool.execute({ city: params.city });
    
    return {
      success: true,
      data: { report: `Weather: ${result.data.temperature}°C` },
    };
  },
}, 'global');
```

### 4. 执行

```typescript
// 执行 Tool
const toolResult = await manager.toolExecutor.execute('weather-tool', {
  city: 'Beijing',
});

// 执行 Skill
const skillResult = await manager.skillExecutor.execute(
  'agent-001',
  'weather-report-skill',
  { city: 'Shanghai' }
);
```

### 5. 查询

```typescript
// 列出可访问的 Tools
const tools = await manager.toolRegistry.listAccessible('agent-001');

// 列出可访问的 Skills
const skills = await manager.skillRegistry.listAccessible('agent-001');

// 健康检查
const health = await manager.toolRegistry.healthCheck('weather-tool');
```

## API 接口

### Skills API

- `POST /api/skills` - 注册 Skill
- `GET /api/skills?agentId=xxx&skillId=yyy` - 查找 Skill
- `GET /api/skills?agentId=xxx` - 列出可访问的 Skills
- `DELETE /api/skills?skillId=xxx&scope=global|private&agentId=xxx` - 注销 Skill
- `POST /api/skills/execute` - 执行 Skill

### Tools API

- `POST /api/tools` - 注册 Tool
- `GET /api/tools?agentId=xxx&toolId=yyy` - 查找 Tool
- `GET /api/tools?agentId=xxx` - 列出可访问的 Tools
- `DELETE /api/tools?toolId=xxx&scope=global|private&agentId=xxx` - 注销 Tool
- `POST /api/tools/execute` - 执行 Tool

## 配置管理

### 配置文件格式

```json
{
  "skills": {
    "global": [...],
    "private": {
      "agent-001": [...]
    }
  },
  "tools": {
    "global": [...],
    "private": {
      "agent-001": [...]
    }
  },
  "mcp": {
    "servers": [
      {
        "id": "mcp-server-1",
        "name": "MCP Server 1",
        "endpoint": "http://localhost:8080",
        "authType": "bearer",
        "authConfig": {
          "token": "your-token"
        }
      }
    ]
  }
}
```

### 使用配置管理器

```typescript
import { ConfigManager, loadFromConfig } from '@/lib/skills/configManager';

const configManager = new ConfigManager('./config/skills-tools.json');
await loadFromConfig(configManager, manager.skillRegistry, manager.toolRegistry);
```

## 数据库表结构

### skills 表

```sql
CREATE TABLE skills (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  version TEXT NOT NULL,
  scope TEXT NOT NULL CHECK(scope IN ('global', 'private')),
  owner_id TEXT,
  dependencies TEXT NOT NULL,
  ...
);
```

### tools 表

```sql
CREATE TABLE tools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('mcp', 'custom')),
  scope TEXT NOT NULL CHECK(scope IN ('global', 'private')),
  owner_id TEXT,
  ...
);
```

## 特性

### 1. 依赖解析

- 自动解析 Skill 的 Tool 依赖
- 检测循环依赖
- 拓扑排序

### 2. 资源池管理

- 全局资源池：所有 Agent 可访问
- 私有资源池：仅所有者可访问
- LRU 缓存策略
- 自动路由（私有优先）

### 3. 执行引擎

- 参数验证（JSON Schema）
- 结果验证
- 执行日志记录
- 并发控制
- 任务调度

### 4. MCP 协议支持

- 连接管理
- 自动重连
- 认证支持（Bearer、Basic）
- 工具调用
- 资源访问

### 5. 健康检查

- Tool 健康检查
- Skill 健康检查
- 依赖健康检查

## 最佳实践

1. **优先使用全局资源**：除非有特殊需求，否则使用全局资源
2. **合理设计依赖**：避免循环依赖，减少依赖数量
3. **参数验证**：使用 JSON Schema 严格验证输入输出
4. **错误处理**：提供清晰的错误信息
5. **日志记录**：记录关键操作和错误
6. **健康检查**：定期检查资源健康状态

## 扩展性

### 添加新的 Tool 类型

1. 定义新的 Tool 类型
2. 实现 ToolExecutor
3. 在 ToolRegistry 中添加路由逻辑

### 添加新的 Skill 类型

1. 定义新的 Skill 类型
2. 实现 SkillExecutor
3. 在 SkillRegistry 中添加路由逻辑

## 性能优化

1. **缓存**：使用 LRU 缓存减少数据库查询
2. **并发控制**：限制并发执行数量
3. **批量执行**：支持批量执行 Tools
4. **懒加载**：按需加载 Skills 和 Tools

## 安全性

1. **认证**：支持 Bearer 和 Basic 认证
2. **授权**：基于 Agent ID 的访问控制
3. **加密**：敏感信息加密存储
4. **审计**：完整的执行日志

## 监控

1. **健康检查**：定期检查资源健康状态
2. **执行日志**：记录所有执行操作
3. **性能指标**：执行时间、成功率等

## 故障排查

1. 检查依赖是否可用
2. 检查权限配置
3. 查看执行日志
4. 检查健康状态

## 未来扩展

1. **分布式支持**：支持分布式部署
2. **版本管理**：支持多版本管理
3. **回滚机制**：支持版本回滚
4. **插件系统**：支持插件扩展
5. **可视化**：提供可视化界面
