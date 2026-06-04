# 全局工具使用文档

## 概述

AgentWorks 提供了四个全局工具，用于文件操作和命令执行：

- **Read**: 读取文件内容，支持行号显示和分页读取
- **Write**: 写入文件内容，支持创建新文件和覆盖现有文件
- **Edit**: 编辑文件内容，支持精确字符串替换和批量替换
- **Bash**: 执行系统命令，支持超时控制、工作目录和环境变量设置

这些工具在应用启动时自动注册为全局资源，所有 Agent 都可以访问和使用。

---

## Read 工具

### 功能描述

读取文件内容并添加行号，支持分页读取大文件。

### 输入参数

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| file_path | string | 是 | 文件的绝对路径 |
| offset | number | 否 | 起始行号（从 1 开始） |
| limit | number | 否 | 读取的行数 |

### 输出格式

```typescript
{
  content: string;    // 文件内容（带行号）
  lines: number;      // 总行数
  size: number;       // 文件大小（字节）
  path: string;       // 文件路径
}
```

### 使用示例

```typescript
// 读取整个文件
const result = await toolRegistry.execute('read', {
  file_path: '/home/user/project/src/index.ts'
});

// 分页读取（从第 10 行开始，读取 20 行）
const result = await toolRegistry.execute('read', {
  file_path: '/home/user/project/src/index.ts',
  offset: 10,
  limit: 20
});
```

### 错误码

- `FILE_NOT_FOUND`: 文件不存在
- `PERMISSION_DENIED`: 没有权限读取文件
- `PATH_NOT_ALLOWED`: 路径不在允许范围内
- `FILE_TOO_LARGE`: 文件大小超过限制

---

## Write 工具

### 功能描述

写入文件内容，自动创建不存在的文件，支持覆盖现有文件。

### 输入参数

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| file_path | string | 是 | 文件的绝对路径 |
| content | string | 是 | 要写入的内容 |
| encoding | string | 否 | 文件编码（默认 utf-8） |

### 输出格式

```typescript
{
  bytesWritten: number;  // 写入的字节数
  path: string;          // 文件路径
}
```

### 使用示例

```typescript
// 写入新文件
const result = await toolRegistry.execute('write', {
  file_path: '/home/user/project/src/new-file.ts',
  content: 'export const hello = "world";'
});

// 覆盖现有文件
const result = await toolRegistry.execute('write', {
  file_path: '/home/user/project/src/config.json',
  content: JSON.stringify({ debug: true }, null, 2)
});
```

### 错误码

- `DIRECTORY_NOT_FOUND`: 父目录不存在
- `PERMISSION_DENIED`: 没有权限写入文件
- `PATH_NOT_ALLOWED`: 路径不在允许范围内

---

## Edit 工具

### 功能描述

编辑文件内容，支持精确字符串替换和批量替换。

### 输入参数

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| file_path | string | 是 | 文件的绝对路径 |
| old_string | string | 是 | 要替换的旧字符串 |
| new_string | string | 是 | 新字符串 |
| replace_all | boolean | 否 | 是否替换所有出现（默认 false） |

### 输出格式

```typescript
{
  replacements: number;  // 替换次数
  path: string;          // 文件路径
}
```

### 使用示例

```typescript
// 替换第一次出现
const result = await toolRegistry.execute('edit', {
  file_path: '/home/user/project/src/index.ts',
  old_string: 'const old = "value"',
  new_string: 'const new = "value"'
});

// 替换所有出现
const result = await toolRegistry.execute('edit', {
  file_path: '/home/user/project/src/index.ts',
  old_string: 'oldFunction',
  new_string: 'newFunction',
  replace_all: true
});
```

### 错误码

- `FILE_NOT_FOUND`: 文件不存在
- `STRING_NOT_FOUND`: 未找到要替换的字符串
- `MULTIPLE_MATCHES`: 找到多处匹配但未设置 replace_all
- `PERMISSION_DENIED`: 没有权限编辑文件

---

## Bash 工具

### 功能描述

在沙箱环境中执行系统命令，支持超时控制、工作目录和环境变量设置。

### 输入参数

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| command | string | 是 | 要执行的命令 |
| timeout | number | 否 | 超时时间（毫秒，默认 30000） |
| cwd | string | 否 | 工作目录 |
| env | object | 否 | 环境变量 |

### 输出格式

```typescript
{
  stdout: string;        // 标准输出
  stderr: string;        // 标准错误
  exitCode: number;      // 退出码
  duration: number;      // 执行时长（毫秒）
  timedOut: boolean;     // 是否超时
}
```

### 使用示例

```typescript
// 执行简单命令
const result = await toolRegistry.execute('bash', {
  command: 'ls -la'
});

// 设置工作目录
const result = await toolRegistry.execute('bash', {
  command: 'npm test',
  cwd: '/home/user/project'
});

// 设置环境变量
const result = await toolRegistry.execute('bash', {
  command: 'node script.js',
  env: {
    NODE_ENV: 'production',
    API_KEY: 'your-key'
  }
});

// 设置超时
const result = await toolRegistry.execute('bash', {
  command: 'long-running-command',
  timeout: 60000  // 60 秒
});
```

### 错误码

- `COMMAND_BLOCKED`: 命令被禁止执行
- `TIMEOUT`: 命令执行超时
- `EXECUTION_FAILED`: 命令执行失败

---

## 安全配置

### 配置文件位置

配置文件位于 `.codeartsdoer/config/global-tools.json`

### 配置项说明

```json
{
  "security": {
    "allowedDirectories": [
      "${PROJECT_ROOT}",  // 项目根目录
      "/tmp"              // 临时目录
    ],
    "blockedCommands": [
      "rm -rf /",         // 禁止删除根目录
      "sudo",             // 禁止使用 sudo
      "chmod 777"         // 禁止修改权限
    ],
    "maxFileSize": 10485760,        // 最大文件大小：10MB
    "defaultTimeout": 30000,        // 默认超时：30 秒
    "sensitiveEnvPatterns": [       // 敏感环境变量模式
      "API_KEY",
      "SECRET",
      "PASSWORD"
    ]
  },
  "policy": {
    "enablePathValidation": true,       // 启用路径验证
    "enableCommandValidation": true,    // 启用命令验证
    "enableEnvSanitization": true,      // 启用环境变量清理
    "enableSandbox": true               // 启用沙箱执行
  }
}
```

### 最佳实践

1. **限制允许的目录**: 只允许访问必要的目录，避免访问系统敏感目录
2. **配置命令黑名单**: 禁止危险的系统命令，如 `rm -rf /`、`sudo` 等
3. **设置合理的文件大小限制**: 防止读取过大的文件导致内存问题
4. **设置合理的超时时间**: 防止命令长时间运行占用资源
5. **保护敏感信息**: 配置敏感环境变量模式，自动过滤敏感信息

---

## 常见问题

### 1. 文件路径验证失败

**问题**: 执行 Read/Write/Edit 工具时提示 `PATH_NOT_ALLOWED`

**解决方法**:
- 检查文件路径是否在 `allowedDirectories` 配置范围内
- 使用绝对路径而不是相对路径
- 检查路径是否包含目录遍历序列（如 `../`）

### 2. 命令被禁止执行

**问题**: 执行 Bash 工具时提示 `COMMAND_BLOCKED`

**解决方法**:
- 检查命令是否在 `blockedCommands` 黑名单中
- 检查命令是否包含危险模式
- 如果需要执行该命令，从黑名单中移除或使用替代命令

### 3. 命令执行超时

**问题**: 执行 Bash 工具时提示 `TIMEOUT`

**解决方法**:
- 增加 `timeout` 参数值
- 优化命令执行效率
- 检查命令是否需要交互输入

### 4. 文件大小超过限制

**问题**: 读取文件时提示 `FILE_TOO_LARGE`

**解决方法**:
- 使用 `offset` 和 `limit` 参数分页读取
- 增加 `maxFileSize` 配置值
- 使用流式处理大文件

---

## 性能建议

1. **大文件处理**: 使用分页读取（offset + limit）处理大文件
2. **批量编辑**: 使用 `replace_all` 参数一次性替换所有匹配
3. **命令执行**: 避免执行耗时过长的命令，合理设置超时时间
4. **并发控制**: 控制同时执行的命令数量，避免资源耗尽

---

## API 参考

### 初始化全局工具

```typescript
import { initializeGlobalTools } from '@/lib/tools';
import { ToolRegistry } from '@/lib/skills';

const toolRegistry = new ToolRegistry(...);
await initializeGlobalTools(toolRegistry);
```

### 获取全局工具注册器

```typescript
import { getGlobalToolsRegistry } from '@/lib/tools';

const registry = getGlobalToolsRegistry();
if (registry) {
  const securityManager = registry.getSecurityManager();
  const sandboxController = registry.getSandboxController();
}
```

### 清理全局工具

```typescript
import { cleanupGlobalTools } from '@/lib/tools';

await cleanupGlobalTools(toolRegistry);
```
