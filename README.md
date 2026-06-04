

# AgentWorks

一人公司 AI Agent 工作集工具 —— 用聊天的方式管理你的虚拟团队。

## 项目简介

AgentWorks 为一人公司/独立创业者提供**类聊天软件**的 AI Agent 管理平台。用户可通过自然语言与单个 Agent 对话、拉群协作，并基于**企业级组织架构**（有限管理幅度、双向工作流、标准化行为）来放大个人管理半径，实现"一个人 + AI 组织"的高效运作。

> 🎯 核心理念：让一个人能够通过 AI Agents 组成的虚拟团队来扩展自己的能力和影响力。

### 核心特性

| 功能 | 描述 |
|------|------|
| **组织架构管理** | 树形层级、管理幅度限制（默认5）、临时豁免、支持可视化架构图 |
| **Agent 四动作闭环** | 执行 → 汇总 → 上报 → 归档，每个 Agent 必须实现完整的工作流 |
| **双向工作流** | Top-down 任务拆解分配 + Bottom-up 异常上报决策机制 |
| **LLM 自主规划** | 主管 Agent 使用大语言模型动态拆解任务 |
| **项目化工作流** | 多项目隔离、任务/归档/剧本管理，Agent 全局共享 |
| **IM 风格界面** | 单聊/群聊模式、任务卡片、上报卡片、斜杠命令 |
| **成本控制** | 按 Agent/项目统计预算，超额告警与降级处理 |
| **可靠性保障** | 超时重试、Dry-run 验证、心跳检测、循环上报检测、API 幂等性 |

## 技术栈

### 核心技术

| 层次 | 技术选型 |
|------|----------|
| 框架 | Next.js 16 (App Router) |
| 语言 | TypeScript 6 |
| UI | React 19 + Tailwind CSS 4 |
| 状态管理 | Zustand 5 (persist middleware) |
| 数据库 | SQLite (better-sqlite3) |
| 实时通信 | WebSocket (断线重连机制) |
| 测试 | Vitest 4 + @testing-library/react 16 |

### 设计风格

采用 **Glassmorphism（玻璃拟物）** 设计语言，打造现代、通透的视觉体验。

## 快速开始

### 安装

```bash
git clone https://github.com/kaisen-wang/AgentWorks.git
# 国内
git clone https://gitee.com/kaisen-wang/AgentWorks.git
cd AgentWorks
npm install
```

### 环境配置

复制示例环境配置文件：

```bash
cp .env.example .env.local
```

编辑 `.env.local` 配置以下必需项：

#### LLM API 配置（OpenAI 兼容接口）

```env
NEXT_PUBLIC_LLM_ENDPOINT=https://api.openai.com/v1
LLM_API_KEY=sk-your-api-key-here
```

#### WebSocket 配置（可选）

不配置则使用本地模式：

```env
NEXT_PUBLIC_WS_URL=
```

### 启动开发服务器

```bash
npm run dev
```

访问 `http://localhost:3000`，点击"加载演示场景"即可体验完整功能。

### 运行测试

```bash
npm test          # 单次运行
npm run test:watch # 监听模式
```

### 构建生产版本

```bash
npm run build
npm start
```

## 项目结构

```
src/
├── app/                    # Next.js App Router
│   ├── api/                # API 路由
│   │   ├── agents/         # Agent 管理接口
│   │   ├── chat/           # 聊天功能接口
│   │   ├── messages/       # 消息接口
│   │   ├── tasks/          # 任务接口
│   │   ├── skills/        # Skill 执行/安装
│   │   ├── tools/         # 工具执行
│   │   ├── sync/          # 数据同步
│   │   └── workflow/       # 工作流引擎
│   ├── globals.css         # Glassmorphism 设计系统
│   ├── layout.tsx         # 根布局
│   └── page.tsx            # 主页面 (IM 风格布局)
├── components/
│   ├── chat/              # 聊天组件 (ChatWindow/ChatInput/MessageBubble)
│   ├── common/           # 通用组件 (CostPanel/KnowledgePanel/ToolAuthPanel)
│   └── org/              # 组织架构组件 (OrgSidebar/OrgChartView)
├── lib/
│   ├── agent/            # Agent 基类 (BaseAgent/SupervisorAgent/SpecialistAgent)
│   ├── agent-loop/       # Agent 执行循环核心
│   ├── capability/       # 能力标签匹配引擎
│   ├── commands/         # 斜杠命令路由
│   ├── db/               # SQLite 数据访问层
│   │   ├── agentRepo.ts
│   │   ├── chatRepo.ts
│   │   ├── taskRepo.ts
│   │   ├── projectRepo.ts
│   │   └── ...
│   ├── llm/              # LLM 调用服务 (OpenAI 兼容)
│   ├── nlu/              # 自然语言命令解析器
│   ├── reliability/       # 可靠性保障 (幂等性管理器等)
│   ├── scheduler/         # Agent 独立任务队列
│   ├── skills/           # Skills 架构 (注册表/资源池/执行引擎)
│   ├── tools/            # 全局工具 (Read/Write/Edit/Bash)
│   ├── workflow/         # 双向工作流引擎
│   ├── ws/               # WebSocket 实时通信
│   └── install/          # Skill 安装系统
├── stores/
│   └── appStore.ts       # Zustand 全局状态
└── types/
    └── index.ts          # TypeScript 类型定义
```

## 全局工具

AgentWorks 提供四个内置全局工具，所有 Agent 均可访问使用：

### 快速使用

```typescript
import { toolRegistry } from '@/lib/tools';

// 读取文件
const result = await toolRegistry.execute('read', {
  file_path: '/path/to/file.txt'
});

// 写入文件
await toolRegistry.execute('write', {
  file_path: '/path/to/file.txt',
  content: 'Hello, World!'
});

// 编辑文件
await toolRegistry.execute('edit', {
  file_path: '/path/to/file.txt',
  old_string: 'old text',
  new_string: 'new text'
});

// 执行命令
await toolRegistry.execute('bash', {
  command: 'npm test',
  timeout: 60000
});
```

### 工具说明

| 工具 | 功能 | 安全特性 |
|------|------|----------|
| **Read** | 读取文件内容，支持行号和分页 | 路径白名单限制 |
| **Write** | 创建或覆盖文件 | 内容扫描 |
| **Edit** | 精确字符串替换/批量替换 | 变更校验 |
| **Bash** | 执行系统命令 | 沙箱隔离、超时控制 |

> 📚 详细使用文档请参阅 [.codeartsdoer/docs/global-tools.md](./docs/global-tools.md)

## 需求覆盖矩阵

| 需求组 | 实现数量 | 状态 |
|--------|----------|------|
| ORG 组织架构 | 9 | ✅ FULL |
| ACT Agent 行为 | 5 | ✅ FULL |
| TDN Top-down 工作流 | 6 | ✅ FULL |
| BUP Bottom-up 工作流 | 7 | ✅ FULL |
| UI 聊天界面 | 7 | ✅ FULL |
| KNL 知识管理 | 7 | ✅ FULL |
| RFT 可靠性 | 6 | ✅ FULL |
| EXT 扩展性 | 5 | ✅ FULL |
| SOLO 一人公司 | 7 | ✅ FULL |
| **合计** | **44** | **FULL + TESTED** |

### 测试统计

- 测试文件：15 个
- 测试用例：321 个
- 通过率：100%

## 典型用户故事

> **张三** 是一位一人公司老板，同时经营"壁纸品牌"和"T恤品牌"两个项目。

1. **创建 Agent**：营销主管（图文本设计）、平台发布（社交媒体发布）
2. **设定架构**：营销主管 → 图文本设计 + 平台发布，管理幅度 5
3. **创建项目**："壁纸品牌"、"T恤品牌"
4. **下达任务**：`@营销主管 下周五前，发布"赛博山景"壁纸到小红书、抖音、公众号`
5. **自动拆解**：营销主管动态分配任务给下属 Agent
6. **异常处理**：遇到问题时弹出上报卡片，一键决策
7. **归档结算**：完成后自动归档，按项目统计成本

## 许可证

**Private** - 保留所有权利。