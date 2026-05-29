# localStorage 到 SQLite 迁移指南

## 概述

本项目已完成从 localStorage 到 SQLite 的数据存储迁移，实现了更可靠的数据持久化和更好的性能。

## 架构变更

### 之前（localStorage）
- 使用 Zustand 的 persist 中间件
- 数据存储在浏览器 localStorage
- 存在容量限制（~5MB）
- 数据可能因浏览器清理而丢失

### 现在（SQLite）
- 使用 better-sqlite3 数据库
- 数据存储在服务端文件 `data/agentworks.db`
- 无容量限制
- 数据持久可靠

## 核心组件

### 1. Repository 层
- `AgentRepository` - Agent 数据访问
- `TaskRepository` - Task 数据访问
- `ChatRepository` - Chat 数据访问
- `MessageRepository` - Message 数据访问

### 2. MigrationTool
- 检测 localStorage 数据
- 迁移数据到 SQLite
- 验证数据完整性
- 支持回滚

### 3. OptimisticUpdateManager
- 管理前端乐观更新
- API 失败时自动回滚
- 提升用户体验

### 4. AppInitializer
- 应用启动时检查迁移
- 自动执行数据迁移
- 加载 SQLite 数据

## 迁移流程

1. **检查阶段**：检测 localStorage 是否有数据
2. **迁移阶段**：将 localStorage 数据迁移到 SQLite
3. **验证阶段**：验证迁移数据完整性
4. **清理阶段**：清空 localStorage
5. **加载阶段**：从 SQLite 加载数据到前端

## API 变更

### 新增 API
- `GET /api/migration` - 检查迁移状态
- `POST /api/migration` - 执行迁移操作

### 重构 API
- `/api/agents` - 使用 AgentRepository
- `/api/tasks` - 使用 TaskRepository
- `/api/chat` - 使用 ChatRepository
- `/api/messages` - 使用 MessageRepository
- `/api/sync` - 简化为纯查询接口

### 删除 API
- `/api/sync/batch` - 已删除

## 数据库 Schema

数据库位于 `data/agentworks.db`，包含以下表：
- `agents` - Agent 数据
- `tasks` - Task 数据
- `conversations` - Chat 数据
- `messages` - Message 数据
- `projects` - Project 数据

## 使用说明

### 首次启动
应用会自动检测并迁移 localStorage 数据，无需手动操作。

### 手动迁移
```typescript
import { MigrationTool } from '@/lib/migration/MigrationTool';

const tool = new MigrationTool();
const localData = tool.checkLocalStorage();
if (localData) {
  const result = tool.migrate(localData);
  console.log('迁移结果:', result);
}
```

### 回滚到 localStorage
```typescript
const tool = new MigrationTool();
tool.rollback();
```

## 注意事项

1. **数据备份**：迁移前建议备份重要数据
2. **迁移时间**：大量数据迁移可能需要几秒钟
3. **并发访问**：SQLite 使用 WAL 模式支持并发读
4. **数据安全**：迁移完成后 localStorage 会被清空

## 待完成任务

- [ ] 重构 Zustand Store（移除 persist 中间件）
- [ ] 编写单元测试
- [ ] 编写集成测试
- [ ] 性能优化

## 技术栈

- **better-sqlite3** - SQLite 数据库
- **Zustand** - 状态管理
- **Next.js API Routes** - 后端 API

## 故障排查

### 迁移失败
1. 检查 localStorage 数据格式
2. 查看控制台错误日志
3. 尝试手动迁移

### 数据丢失
1. 使用 MigrationTool.rollback() 恢复
2. 检查 data/agentworks.db 文件

### 性能问题
1. 检查数据库索引
2. 优化查询语句
3. 考虑分页加载
