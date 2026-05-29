# AgentWorks 项目架构分析报告

## 1. 项目概述

**AgentWorks** 是一个面向一人公司/独立创业者的 AI Agent 工作集管理平台，通过类聊天软件的方式管理虚拟团队。项目采用现代化的全栈技术栈，实现了企业级组织架构管理、双向工作流、LLM 自主规划等核心功能。

## 2. 整体目录结构

```
/home/carson/code/test/AgentWorks/
├── src/                          # 源代码主目录
│   ├── app/                      # Next.js App Router 应用目录
│   │   ├── api/                  # API 路由层
│   │   │   ├── agents/           # Agent 管理 API
│   │   │   ├── chat/             # 聊天 API
│   │   │   ├── messages/         # 消息 API
│   │   │   ├── skills/           # Skills 管理 API
│   │   │   ├── sync/             # 数据同步 API
│   │   │   ├── tasks/            # 任务管理 API
│   │   │   └── tools/            # Tools 管理 API
│   │   ├── layout.tsx            # 根布局组件
│   │   ├── page.tsx              # 主页面（IM 风格界面）
│   │   └── globals.css           # Glassmorphism 设计系统
│   ├── components/               # React 组件库
│   │   ├── chat/                 # 聊天相关组件
│   │   ├── common/               # 通用组件
│   │   └── org/                  # 组织架构组件
│   ├── lib/                      # 核心业务逻辑库
│   │   ├── agent/                # Agent 基类系统
│   │   ├── capability/           # 能力匹配引擎
│   │   ├── commands/             # 斜杠命令路由
│   │   ├── db/                   # SQLite 数据访问层
│   │   ├── llm/                  # LLM 服务集成
│   │   ├── nlu/                  # 自然语言理解
│   │   ├── skills/               # Skills 系统
│   │   ├── tools/                # 全局工具系统
│   │   ├── workflow/             # 工作流引擎
│   │   └── ws/                   # WebSocket 通信
│   ├── stores/                   # Zustand 状态管理
│   ├── styles/                   # 样式文件
│   └── types/                    # TypeScript 类型定义
├── docs/                         # 项目文档
├── data/                         # SQLite 数据库存储
├── .codeartsdoer/                # CodeArts 配置和示例
├── server.ts                     # WebSocket 服务器
├── package.json                  # 项目依赖配置
├── tsconfig.json                 # TypeScript 配置
├── vitest.config.ts              # 测试配置
└── next.config.ts                # Next.js 配置
```

## 3. 技术栈分析

### 3.1 核心框架与语言
- **前端框架**: Next.js 16 (App Router)
- **UI 库**: React 19
- **编程语言**: TypeScript 6
- **样式方案**: Tailwind CSS 4 + Glassmorphism 设计系统

### 3.2 状态管理与数据持久化
- **状态管理**: Zustand 5 (带 persist middleware)
- **数据库**: SQLite (better-sqlite3)
- **实时通信**: WebSocket (支持断线重连)

### 3.3 测试与开发工具
- **测试框架**: Vitest 4 + @testing-library/react 16
- **测试环境**: jsdom
- **代码规范**: ESLint 9

### 3.4 UI 增强
- **Markdown 渲染**: react-markdown + remark-gfm + rehype-sanitize
- **代码高亮**: react-syntax-highlighter
- **唯一标识**: uuid

## 4. 主要代码文件和模块

### 4.1 核心业务模块

| 模块路径 | 功能描述 | 关键文件 |
|---------|---------|---------|
| `/src/lib/agent/` | Agent 四动作基类系统 | BaseAgent.ts, SupervisorAgent.ts, SpecialistAgent.ts |
| `/src/lib/db/` | SQLite 数据访问层 | database.ts, agentRepo.ts, taskRepo.ts |
| `/src/lib/workflow/` | 双向工作流引擎 | WorkflowEngine.ts |
| `/src/lib/llm/` | LLM 服务集成 | LLMService.ts |
| `/src/lib/skills/` | Skills 注册与执行系统 | skillRegistry.ts, executor.ts |
| `/src/lib/tools/` | 全局工具系统 | ReadTool.ts, WriteTool.ts, EditTool.ts, BashTool.ts |
| `/src/lib/ws/` | WebSocket 通信 | ChatWebSocket.ts, useWebSocket.ts |

### 4.2 组件模块

| 组件路径 | 功能描述 | 关键组件 |
|---------|---------|---------|
| `/src/components/chat/` | 聊天界面 | ChatWindow, ChatInput, MessageBubble |
| `/src/components/org/` | 组织架构可视化 | OrgSidebar, OrgChartView |
| `/src/components/common/` | 通用功能面板 | CostPanel, KnowledgePanel, CreateAgentPanel |

### 4.3 API 路由

| API 路径 | 功能描述 |
|---------|---------|
| `/api/agents/` | Agent CRUD 操作 |
| `/api/chat/` | 聊天会话管理 |
| `/api/messages/` | 消息发送与接收 |
| `/api/tasks/` | 任务管理 |
| `/api/skills/` | Skills 管理 |
| `/api/tools/` | Tools 管理 |
| `/api/sync/` | 数据同步 |

## 5. 关键配置文件

### 5.1 项目配置
- **package.json**: 定义了 6 个 npm 脚本
- **tsconfig.json**: TypeScript 严格模式配置，路径别名 `@/*` 映射到 `./src/*`
- **next.config.ts**: Next.js 配置
- **vitest.config.ts**: Vitest 测试配置，包含 React 插件和路径别名

### 5.2 环境配置
- **.env.example**: 环境变量模板，包含：
  - LLM API 配置（DeepSeek/OpenAI 兼容接口）
  - WebSocket URL 配置
  - SQLite 数据库路径
  - 短信网关配置（用于休息模式）

### 5.3 设计系统
- **globals.css**: Glassmorphism 设计系统，包含玻璃拟物效果、动画、颜色变量

## 6. 项目主要功能模块划分

### 6.1 组织架构管理 (ORG)
- 树形层级结构
- 管理幅度限制（默认 5）
- 临时豁免机制
- 可视化架构图

### 6.2 Agent 行为系统 (ACT)
- **四动作闭环**: 执行、汇总、上报、归档
- **BaseAgent 基类**: 提供超时重试、指数退避、审计日志
- **SupervisorAgent**: 主管 Agent，负责任务拆解和分配
- **SpecialistAgent**: 专家 Agent，负责具体任务执行

### 6.3 双向工作流 (TDN/BUP)
- **Top-down**: 任务拆解分配、优先级继承
- **Bottom-up**: 异常上报、决策请求、跨部门协作

### 6.4 聊天界面 (UI)
- IM 风格界面（单聊/群聊）
- 任务卡片、上报卡片
- 斜杠命令支持
- Markdown 渲染和代码高亮

### 6.5 Skills & Tools 系统
- **Skills**: 可复用的能力单元，支持依赖声明
- **Tools**: 底层工具（MCP/Custom），支持全局/私有范围
- **全局工具**: Read、Write、Edit、Bash 四大工具
- **资源池**: 全局资源池和私有资源池管理

### 6.6 可靠性保障 (RFT)
- 超时重试机制
- 幂等性管理
- 心跳检测
- 循环上报检测
- 审计日志

### 6.7 知识管理 (KNL)
- 三级知识库：全局、部门、个人
- 剧本系统
- 归档管理

### 6.8 扩展性 (EXT)
- 插件市场
- Webhook 事件触发
- A/B 测试框架

## 7. 数据库架构

项目使用 SQLite 数据库，包含以下核心表：

| 表名 | 功能描述 |
|-----|---------|
| agents | Agent 实体存储 |
| projects | 项目目录 |
| tasks | 任务管理 |
| reports | 上报记录 |
| archives | 归档记录 |
| skills | Skills 定义 |
| tools | Tools 定义 |
| agent_skill_bindings | Agent-Skill 绑定关系 |
| agent_tool_bindings | Agent-Tool 绑定关系 |
| execution_logs | 执行日志 |
| audit_logs | 审计日志 |

## 8. 测试覆盖

- **测试文件数量**: 16 个
- **测试框架**: Vitest + @testing-library/react
- **测试覆盖**: 321 个用例，通过率 100%
- **测试类型**: 单元测试、组件测试

## 9. 项目特色

1. **企业级组织架构**: 实现了有限管理幅度、双向工作流、标准化行为
2. **LLM 自主规划**: 主管 Agent 使用大语言模型动态拆解任务
3. **Glassmorphism 设计**: 玻璃拟物风格，现代化 UI
4. **全栈 TypeScript**: 类型安全贯穿前后端
5. **模块化架构**: Skills/Tools 系统支持灵活扩展
6. **可靠性设计**: 完善的重试、幂等性、审计机制

## 10. 开发工作流

```bash
# 开发
npm run dev          # 启动 Next.js 开发服务器
npm run dev:ws       # 启动 WebSocket 服务器

# 测试
npm test             # 单次运行测试
npm run test:watch   # 监听模式

# 构建
npm run build        # 生产构建
npm start            # 启动生产服务器
```

---

**总结**: AgentWorks 是一个架构清晰、技术栈现代化的全栈 AI Agent 管理平台。项目采用 Next.js App Router 架构，实现了从组织架构管理到工作流引擎的完整功能闭环，代码组织规范，测试覆盖完善，是一个高质量的企业级应用项目。
