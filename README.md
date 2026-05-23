# AgentWorks

一人公司 AI Agent 工作集工具 — 用聊天的方式管理你的虚拟团队。

## 项目简介

AgentWorks 为一人公司/独立创业者提供**类聊天软件**的 AI Agent 管理平台。用户可通过自然语言与单个 Agent 对话、拉群协作，并基于**企业级组织架构**（有限管理幅度、双向工作流、标准化行为）来放大个人管理半径，实现"一个人 + AI 组织"的高效运作。

### 核心特性

- **组织架构管理** — 树形层级、管理幅度限制（默认5）、临时豁免、可视化架构图
- **Agent 四动作闭环** — 执行、汇总、上报、归档，每个 Agent 必须实现
- **双向工作流** — Top-down 任务拆解分配 + Bottom-up 异常上报决策
- **LLM 自主规划** — 主管 Agent 使用大语言模型动态拆解任务
- **项目化工作流** — 多项目隔离任务/归档/剧本，Agent 全局共享
- **IM 风格界面** — 单聊/群聊、任务卡片、上报卡片、斜杠命令
- **成本控制** — 按 Agent/项目统计预算，超额告警与降级
- **可靠性保障** — 超时重试、Dry-run、心跳检测、循环上报检测、API 幂等性

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) |
| UI | React 19 + TypeScript 6 + Tailwind CSS 4 |
| 状态管理 | Zustand 5 (persist middleware) |
| 数据库 | SQLite (better-sqlite3) |
| 实时通信 | WebSocket (断线重连) |
| 测试 | Vitest 4 + @testing-library/react 16 |
| 设计风格 | Glassmorphism (玻璃拟物) |

## 快速开始

### 安装

```bash
git clone <repo-url>
cd AgentWorks
npm install
```

### 环境配置

```bash
cp .env.example .env.local
```

编辑 `.env.local` 填入实际配置：

```env
# LLM API（OpenAI 兼容接口）
NEXT_PUBLIC_LLM_ENDPOINT=https://api.openai.com/v1
LLM_API_KEY=sk-xxx

# WebSocket（可选，不配置则使用本地模式）
NEXT_PUBLIC_WS_URL=
```

### 开发

```bash
npm run dev
```

访问 `http://localhost:3000`，点击"加载演示场景"即可体验。

### 测试

```bash
npm test          # 单次运行
npm run test:watch # 监听模式
```

### 构建

```bash
npm run build
npm start
```

## 项目结构

```
src/
├── app/                    # Next.js App Router
│   ├── api/                # API Routes (agents/chat/messages/tasks/sync)
│   ├── globals.css         # Glassmorphism 设计系统
│   ├── layout.tsx          # 根布局
│   └── page.tsx            # 主页面 (IM 风格布局)
├── components/
│   ├── chat/               # 聊天组件 (ChatWindow/ChatInput/MessageBubble)
│   ├── common/             # 通用组件 (CostPanel/KnowledgePanel/ToolAuthPanel/Icons)
│   └── org/                # 组织架构组件 (OrgSidebar/OrgChartView)
├── lib/
│   ├── agent/              # Agent 基类 (BaseAgent/SupervisorAgent/SpecialistAgent)
│   ├── capability/         # 能力标签匹配引擎
│   ├── commands/           # 斜杠命令路由
│   ├── db/                 # SQLite 数据访问层 (database/agentRepo/taskRepo/projectRepo/auditLogRepo)
│   ├── llm/                # LLM 调用服务 (OpenAI 兼容)
│   ├── nlu/                # 自然语言命令解析器
│   ├── reliability/        # 可靠性 (IdempotencyManager 幂等性)
│   ├── scheduler/          # Agent 独立任务队列 (优先级+抢占)
│   ├── workflow/           # 双向工作流引擎
│   └── ws/                 # WebSocket 实时通信 (ChatWebSocket/useWebSocket)
├── stores/
│   └── appStore.ts         # Zustand 全局状态 (persist → localStorage)
└── types/
    └── index.ts            # TypeScript 全局类型定义
```

## 需求覆盖

| 需求组 | 数量 | 状态 |
|--------|------|------|
| ORG 组织架构 | 9 | FULL |
| ACT Agent 行为 | 5 | FULL |
| TDN Top-down 工作流 | 6 | FULL |
| BUP Bottom-up 工作流 | 7 | FULL |
| UI 聊天界面 | 7 | FULL |
| KNL 知识管理 | 7 | FULL |
| RFT 可靠性 | 6 | FULL |
| EXT 扩展性 | 5 | FULL |
| SOLO 一人公司 | 7 | FULL |
| **合计** | **44** | **FULL + TESTED** |

15 个测试文件，321 个用例，通过率 100%。

## 用户故事

> **张三** 一人公司老板，同时经营"壁纸品牌"和"T恤品牌"两个项目。

1. 创建 Agent：`营销主管`（GPT-4）、`图文本设计`（图像生成+文案）、`平台发布`（社交媒体发布）
2. 设定架构：营销主管 → 图文本设计 + 平台发布，管理幅度 5
3. 创建项目："壁纸品牌"、"T恤品牌"
4. 在群聊中下达任务：`@营销主管 下周五前，发布"赛博山景"壁纸到小红书、抖音、公众号`
5. 营销主管自动拆解 → 分配给图文本设计和平台发布
6. 执行中遇到问题 → 上报卡片带决策按钮 → 张三一键决策
7. 完成后归档，按项目查看成本

## 许可证

Private
