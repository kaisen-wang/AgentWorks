# AgentWorks 数据存储方案对比

## 方案一：当前方案（localStorage + SQLite同步）

### 架构
```
前端 Zustand Store
    ↓ (自动持久化)
localStorage (5-10MB限制)
    ↓ (定时同步，30秒)
SQLite (服务端)
```

### 优点
- ✅ 即时响应，无需等待网络
- ✅ 离线支持
- ✅ 页面刷新快速恢复
- ✅ 减少API调用

### 缺点
- ❌ 数据同步问题（如当前遇到的）
- ❌ localStorage容量限制
- ❌ 多设备数据不一致
- ❌ 数据暴露在浏览器中

---

## 方案二：纯SQLite方案（移除localStorage）

### 架构
```
前端 Zustand Store
    ↓ (每次变化)
API调用
    ↓
SQLite (服务端)
```

### 实现方式

#### 1. 移除Zustand的persist中间件

```typescript
// src/stores/appStore.ts
export const useAppStore = create<AppState>()((set, get) => ({
  // ... 状态定义
}));
// 不再使用 persist()
```

#### 2. 每次状态变化调用API

```typescript
createAgent: (name, role, parentId, capabilities, config, description) => {
  // 1. 乐观更新本地状态
  const agent = { id: uuidv4(), name, ... };
  set((s) => ({ agents: { ...s.agents, [agent.id]: agent } }));

  // 2. 异步同步到服务端
  fetch('/api/agents', {
    method: 'POST',
    body: JSON.stringify(agent)
  }).catch(err => {
    // 3. 失败时回滚
    set((s) => {
      const agents = { ...s.agents };
      delete agents[agent.id];
      return { agents };
    });
  });

  return agent;
}
```

#### 3. 页面加载时从服务端获取数据

```typescript
// src/app/page.tsx
useEffect(() => {
  fetch('/api/sync')
    .then(r => r.json())
    .then(data => {
      useAppStore.setState({
        agents: data.agents,
        chats: data.chats,
        // ...
      });
    });
}, []);
```

### 优点
- ✅ 数据统一管理
- ✅ 无容量限制
- ✅ 多设备数据一致
- ✅ 数据更安全

### 缺点
- ❌ 无离线支持
- ❌ 页面刷新需等待API
- ❌ 增加服务端压力
- ❌ 网络延迟影响体验

---

## 方案三：混合模式（推荐）

### 架构
```
前端 Zustand Store
    ↓ (立即)
localStorage (缓存层)
    ↓ (异步，防抖)
API调用
    ↓
SQLite (主数据源)
```

### 实现方式

#### 1. 改进的persist配置

```typescript
// src/stores/appStore.ts
export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // ... 状态定义
    }),
    {
      name: "agentworks-cache", // 改名，明确是缓存
      // 只缓存部分数据
      partialize: (state) => ({
        agents: state.agents,
        chats: state.chats,
        activeChatId: state.activeChatId,
        // 不缓存大量数据如messages
      }),
    }
  )
);
```

#### 2. 智能同步策略

```typescript
// src/lib/sync/SmartSync.ts
class SmartSync {
  private pendingChanges: Map<string, any> = new Map();
  private syncTimer: NodeJS.Timeout | null = null;

  // 记录变更，防抖同步
  trackChange(type: string, id: string, data: any) {
    this.pendingChanges.set(`${type}:${id}`, { type, id, data, timestamp: Date.now() });
    this.scheduleSync();
  }

  // 防抖：500ms内的多次变更合并为一次同步
  private scheduleSync() {
    if (this.syncTimer) clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => this.sync(), 500);
  }

  // 批量同步到服务端
  private async sync() {
    const changes = Array.from(this.pendingChanges.values());
    this.pendingChanges.clear();

    try {
      await fetch('/api/sync/batch', {
        method: 'POST',
        body: JSON.stringify({ changes })
      });
    } catch (err) {
      // 失败时重新加入队列
      changes.forEach(c => this.pendingChanges.set(`${c.type}:${c.id}`, c));
    }
  }
}
```

#### 3. 启动时智能加载

```typescript
// src/app/page.tsx
useEffect(() => {
  // 1. 立即显示localStorage缓存数据（快速响应）
  const cachedData = localStorage.getItem('agentworks-cache');

  // 2. 后台从服务端加载最新数据
  fetch('/api/sync')
    .then(r => r.json())
    .then(serverData => {
      // 3. 合并：服务端优先，但保留本地未同步的变更
      const mergedData = mergeData(cachedData, serverData);
      useAppStore.setState(mergedData);
    });
}, []);
```

### 优点
- ✅ 即时响应（localStorage缓存）
- ✅ 数据一致（SQLite主数据源）
- ✅ 离线支持（本地缓存）
- ✅ 性能优化（防抖、批量同步）
- ✅ 冲突解决（智能合并）

### 缺点
- ⚠️ 实现复杂度较高
- ⚠️ 需要处理冲突场景

---

## 推荐方案

**短期（快速修复）：** 保持当前方案，修复同步问题（已完成）

**中期（优化）：** 采用方案三（混合模式），改进同步策略

**长期（可选）：** 如果需要完全移除localStorage，采用方案二，但需要：
1. 实现乐观更新 + 回滚机制
2. 添加加载状态指示器
3. 实现请求队列和重试机制

---

## 实现建议

### 如果选择方案三（混合模式）

1. **改进persist配置**
   - 只缓存必要数据
   - 添加版本号，支持数据迁移

2. **实现SmartSync类**
   - 防抖同步
   - 批量提交
   - 失败重试

3. **改进API**
   - 添加批量同步接口 `/api/sync/batch`
   - 支持增量同步（只同步变更）

4. **添加冲突解决**
   - 基于时间戳的Last-Write-Wins
   - 或更复杂的CRDT算法

### 如果选择方案二（纯SQLite）

1. **移除persist中间件**

2. **实现乐观更新**
   - 立即更新本地状态
   - 异步同步服务端
   - 失败时回滚

3. **添加加载状态**
   - 页面加载时显示loading
   - 操作时显示同步状态

4. **实现请求队列**
   - 离线时缓存请求
   - 在线时批量提交

---

## 总结

| 方案 | 离线支持 | 性能 | 数据一致性 | 实现复杂度 |
|------|---------|------|-----------|-----------|
| 当前方案 | ✅ | ✅ | ⚠️ | 低 |
| 纯SQLite | ❌ | ⚠️ | ✅ | 中 |
| 混合模式 | ✅ | ✅ | ✅ | 高 |

**建议：** 先修复当前问题，然后逐步迁移到混合模式。
