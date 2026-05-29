# 功能实现：点击组织架构成员切换对话

## 功能描述

点击组织架构中的Agent成员时，自动切换到与该Agent的对话。

## 实现方式

### 修改文件
- `src/components/org/OrgSidebar.tsx`

### 核心逻辑

```typescript
// 点击Agent时，切换到与该Agent的对话
const handleClick = () => {
  // 1. 查找是否已存在与该Agent的单聊
  const existingChat = Object.values(chats).find(
    (chat) =>
      chat.type === "direct" &&
      chat.members.some((m) => m.id === agent.id)
  );

  if (existingChat) {
    // 2. 如果已存在，直接切换到该对话
    setActiveChat(existingChat.id);
  } else {
    // 3. 如果不存在，创建新的单聊
    const newChat = createChat("direct", agent.name, [
      { id: "user", name: "你", avatar: "user", role: "owner" },
      { id: agent.id, name: agent.name, avatar: agent.avatar, role: "member" },
    ]);
    setActiveChat(newChat.id);
  }
};
```

## 交互设计

### 左键点击
- **行为**：切换到与该Agent的对话
- **逻辑**：
  - 如果已存在对话，直接切换
  - 如果不存在对话，创建新对话并切换

### 右键点击
- **行为**：打开Agent详情面板
- **用途**：查看Agent配置、能力、状态等信息

### 提示文本
- **title属性**：`"点击切换对话，右键查看详情"`
- **显示时机**：鼠标悬停时

## 用户体验

### 优点
1. **快速切换**：一键切换到目标Agent对话
2. **智能复用**：自动复用已存在的对话，避免重复创建
3. **保留详情**：右键仍可查看Agent详情
4. **清晰提示**：鼠标悬停显示操作提示

### 工作流程

```
用户点击组织架构中的Agent
  ↓
查找是否已存在与该Agent的对话
  ↓
├─ 存在 → 直接切换到该对话
│
└─ 不存在 → 创建新对话 → 切换到新对话
```

## 测试步骤

### 1. 基本功能测试

1. 启动开发服务器：`npm run dev`
2. 打开浏览器：`http://localhost:3000`
3. 创建一个Agent（如果还没有）
4. 点击组织架构中的Agent
5. 验证：
   - 右侧切换到与该Agent的对话
   - 对话标题显示Agent名称
   - 可以发送消息

### 2. 复用对话测试

1. 点击Agent A，发送消息"你好"
2. 点击其他Agent或切换到其他对话
3. 再次点击Agent A
4. 验证：
   - 切换回之前的对话
   - 历史消息仍然存在
   - 没有创建新的对话

### 3. 右键菜单测试

1. 右键点击组织架构中的Agent
2. 验证：
   - 打开Agent详情面板
   - 显示Agent配置信息
   - 可以编辑Agent

### 4. 多Agent测试

1. 创建多个Agent（如：张三、李四、王五）
2. 依次点击每个Agent
3. 验证：
   - 每次点击都切换到正确的对话
   - 对话列表显示所有对话
   - 可以在对话间自由切换

## 技术细节

### 状态管理

使用的Zustand store方法：
- `chats` - 所有对话列表
- `createChat` - 创建新对话
- `setActiveChat` - 设置当前活跃对话
- `openAgentDetail` - 打开Agent详情面板

### 对话查找逻辑

```typescript
const existingChat = Object.values(chats).find(
  (chat) =>
    chat.type === "direct" &&           // 单聊类型
    chat.members.some((m) => m.id === agent.id)  // 包含该Agent
);
```

### 对话创建逻辑

```typescript
const newChat = createChat("direct", agent.name, [
  { id: "user", name: "你", avatar: "user", role: "owner" },      // 用户
  { id: agent.id, name: agent.name, avatar: agent.avatar, role: "member" },  // Agent
]);
```

## 后续优化建议

### 1. 视觉反馈
- 点击时添加高亮效果
- 切换对话时添加过渡动画

### 2. 快捷键支持
- 支持键盘快捷键切换对话
- 如：Ctrl+1, Ctrl+2等

### 3. 对话预览
- 鼠标悬停时显示最近消息预览
- 类似Slack的对话预览功能

### 4. 未读消息提示
- 在Agent名称旁显示未读消息数
- 红点或数字提示

## 相关文件

- `src/components/org/OrgSidebar.tsx` - 组织架构侧边栏
- `src/stores/appStore.ts` - 状态管理
- `src/components/chat/ChatWindow.tsx` - 对话窗口

## 更新日志

**2026-05-28**
- 实现点击切换对话功能
- 添加右键查看详情功能
- 添加操作提示文本
