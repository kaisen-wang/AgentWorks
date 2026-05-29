# SQLite 数据存储架构说明

## 概述

本项目使用 SQLite 作为唯一的数据存储方案，实现了可靠的数据持久化和优秀的性能。

## 架构说明

### 数据存储
- 使用 better-sqlite3 数据库
- 数据存储在服务端文件 `data/agentworks.db`
- 无容量限制
- 数据持久可靠
- 支持事务和复杂查询

### 前端状态管理
- 使用 Zustand 进行状态管理
- 不使用 persist 中间件
- 数据从 SQLite API 加载
- 所有写操作通过 API 更新 SQLite

## 核心组件

### 1. Repository 层
- `AgentRepository` - Agent 数据访问
- `TaskRepository` - Task 数据访问
- `ChatRepository` - Chat 数据访问
- `MessageRepository` - Message 数据访问

### 2. OptimisticUpdateManager
- 管理前端乐观更新
- API 失败时自动回滚
- 提升用户体验

### 3. AppInitializer
- 应用启动时从 SQLite 加载数据
- 提供加载状态和错误处理

## 数据流程

1. **应用启动**：AppInitializer 从 /api/sync 加载数据
2. **数据展示**：Zustand Store 管理前端状态
3. **数据更新**：通过 API 更新 SQLite，乐观更新前端状态
4. **错误处理**：API 失败时回滚前端状态

## API 架构

### 数据查询
- `GET /api/agents` - 获取所有 Agents
- `GET /api/tasks` - 获取任务列表（支持过滤）
- `GET /api/chat` - 获取所有会话
- `GET /api/messages?chatId=xxx` - 获取消息
- `GET /api/sync` - 获取所有数据

### 数据操作
- `POST /api/agents` - 创建 Agent
- `PUT /api/agents` - 更新 Agent
- `DELETE /api/agents?id=xxx` - 删除 Agent
- 类似的 CRUD 操作用于 tasks、chat、messages

## 数据库 Schema

数据库位于 `data/agentworks.db`，包含以下表：
- `agents` - Agent 数据
- `tasks` - Task 数据
- `conversations` - Chat 数据
- `messages` - Message 数据
- `projects` - Project 数据
- `skills` - Skill 数据
- `tools` - Tool 数据

## 技术栈

- **better-sqlite3** - SQLite 数据库
- **Zustand** - 状态管理（无 persist）
- **Next.js API Routes** - 后端 API
- **TypeScript** - 类型安全

## 性能优化

1. **数据库索引**：关键字段已建立索引
2. **Repository 模式**：封装数据访问逻辑
3. **乐观更新**：提升用户体验
4. **事务支持**：确保数据一致性

## 故障排查

### 数据加载失败
1. 检查 data/agentworks.db 文件是否存在
2. 查看控制台错误日志
3. 检查 API 响应

### 性能问题
1. 检查数据库索引
2. 优化查询语句
3. 考虑分页加载
