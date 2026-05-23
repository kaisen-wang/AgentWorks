# AgentWorks UI 设计系统规范

> **每次新对话必须加载此文档。任何 UI 相关的新需求必须严格遵循此规范，不得出现风格不一致。**

---

## 1. 风格定义

| 属性 | 值 |
|------|-----|
| **风格名称** | Glassmorphism（玻璃拟物） |
| **来源** | UI/UX Pro Max Skill — Style #3 |
| **核心特征** | 毛玻璃模糊 + 半透明白色叠加 + 微光边框 + 鲜艳动态背景 + Z-depth 层级 |
| **适用场景** | 现代 SaaS、金融仪表盘、高端企业、生活方式应用、弹窗覆盖层、导航 |

---

## 2. 技术栈

| 技术 | 版本/说明 |
|------|-----------|
| Framework | Next.js 16 (App Router) |
| Styling | Tailwind CSS + CSS Custom Properties |
| State | Zustand |
| Language | TypeScript |

---

## 3. 字体系统

| 用途 | 字体 | 备选 | 权重 | 说明 |
|------|------|------|------|------|
| **标题 (h1-h3)** | Space Grotesk | DM Sans, sans-serif | 500-700 | 几何感、科技感、独特个性 |
| **正文** | DM Sans | -apple-system, sans-serif | 300-700 | 高可读性、现代无衬线 |
| **等宽 (代码)** | 系统等宽 | — | 400 | 命令、键名 |

**Google Fonts 引入：**
```css
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');
```

**Tailwind 使用：**
- 标题元素：`font-heading` 类或 h1/h2/h3 自动应用 Space Grotesk
- 正文：默认 DM Sans，无需额外类

---

## 4. 配色系统

### 4.1 主色板（Micro SaaS Palette）

| 角色 | CSS 变量 | 色值 | 用途 |
|------|----------|------|------|
| **Canvas** | `--bg-canvas` | `#0B0D1A` | 页面最底层背景（深蓝黑） |
| **Surface** | `--bg-surface` | `rgba(15, 18, 35, 0.75)` | 侧边栏、顶栏面板 |
| **Elevated** | `--bg-elevated` | `rgba(255, 255, 255, 0.08)` | 浮起层背景 |
| **Hover** | `--bg-hover` | `rgba(255, 255, 255, 0.12)` | 悬停态背景 |
| **Active** | `--bg-active` | `rgba(255, 255, 255, 0.18)` | 按下态背景 |
| **Accent (Primary)** | `--accent` | `#6366F1` | 品牌色、强调、执行状态、选中态 |
| **Accent Hover** | `--accent-hover` | `#818CF8` | Accent 悬停态 |
| **CTA (Secondary)** | `--cta` | `#10B981` | 行动按钮、完成状态、发送按钮 |
| **CTA Hover** | `--cta-hover` | `#34D399` | CTA 悬停态 |

### 4.2 文字层级

| 角色 | CSS 变量 | 色值 | 用途 |
|------|----------|------|------|
| **Primary** | `--text-primary` | `#F0F2F5` | 标题、主要文字 |
| **Secondary** | `--text-secondary` | `#8B92A5` | 正文、描述 |
| **Muted** | `--text-muted` | `#5A6178` | 辅助信息、时间戳 |
| **Faint** | `--text-faint` | `#3D4459` | 极淡文字、计数 |

### 4.3 语义色

| 角色 | CSS 变量 | 色值 | 用途 |
|------|----------|------|------|
| **Purple** | `--purple` | `#A855F7` | 上报状态 |
| **Success** | `--success` | `#10B981` | 完成状态（同 CTA） |
| **Warning** | `--warning` | `#F59E0B` | 警告、汇总状态 |
| **Danger** | `--danger` | `#EF4444` | 错误、故障、超限 |
| **Info** | `--info` | `#3B82F6` | 信息提示 |

每个语义色都有对应的 `-muted` 变量（15% 透明度），用于背景色：
- `--accent-muted`: `rgba(99,102,241,0.15)` — Accent 淡背景
- `--accent-glow`: `rgba(99,102,241,0.25)` — Accent 发光
- `--accent-bloom`: `rgba(99,102,241,0.08)` — Accent 远光
- `--cta-muted`: `rgba(16,185,129,0.15)` — CTA 淡背景
- `--cta-glow`: `rgba(16,185,129,0.25)` — CTA 发光
- `--purple-muted`: `rgba(168,85,247,0.15)` — Purple 淡背景
- `--success-muted`: `rgba(16,185,129,0.15)` — Success 淡背景
- `--warning-muted`: `rgba(245,158,11,0.15)` — Warning 淡背景
- `--danger-muted`: `rgba(239,68,68,0.15)` — Danger 淡背景
- `--info-muted`: `rgba(59,130,246,0.15)` — Info 淡背景

### 4.4 Glassmorphism 鲜艳色（Vibrant BG）

| 角色 | CSS 变量 | 色值 | 用途 |
|------|----------|------|------|
| **Electric Blue** | `--electric-blue` | `#0080FF` | 动态背景光球 |
| **Neon Purple** | `--neon-purple` | `#8B00FF` | 动态背景光球 |
| **Vivid Pink** | `--vivid-pink` | `#FF1493` | 备用 |
| **Teal** | `--teal` | `#20B2AA` | 动态背景光球 |

### 4.5 玻璃层

| 角色 | CSS 变量 | 色值 | 用途 |
|------|----------|------|------|
| **Glass Light** | `--glass-light` | `rgba(255,255,255,0.06)` | 轻量玻璃 — 卡片、头像 |
| **Glass Medium** | `--glass-medium` | `rgba(255,255,255,0.12)` | 中等玻璃 — 下拉菜单、选中态 |
| **Glass Heavy** | `--glass-heavy` | `rgba(255,255,255,0.18)` | 重度玻璃 — 弹窗面板 |
| **Glass Border** | `--glass-border` | `rgba(255,255,255,0.15)` | 玻璃边框 |

### 4.6 边框

| 角色 | CSS 变量 | 色值 |
|------|----------|------|
| **Default** | `--border` | `rgba(255,255,255,0.1)` |
| **Hover** | `--border-hover` | `rgba(255,255,255,0.2)` |
| **Active** | `--border-active` | `rgba(255,255,255,0.3)` |

---

## 5. Glassmorphism 核心规范

### 5.1 四层玻璃系统

| 层级 | CSS 类名 | backdrop-filter | background | border | 用途 |
|------|----------|-----------------|-----------|--------|------|
| **Light** | `.glass` | `blur(15px) saturate(1.2)` | `rgba(255,255,255,0.06)` | `1px solid rgba(255,255,255,0.15)` | 卡片、头像容器、标签 |
| **Medium** | `.glass-medium` | `blur(20px) saturate(1.3)` | `rgba(255,255,255,0.12)` | `1px solid rgba(255,255,255,0.2)` | 下拉菜单、选中态、用户消息气泡 |
| **Heavy** | `.glass-heavy` | `blur(30px) saturate(1.4)` | `rgba(255,255,255,0.18)` | `1px solid rgba(255,255,255,0.3)` | 弹窗面板、模态框 |
| **Surface** | `.glass-surface` | `blur(15px) saturate(1.2)` | `rgba(15,18,35,0.75)` | `1px solid rgba(255,255,255,0.1)` | 顶栏、侧边栏、输入栏 |

### 5.2 光源反射

```css
.glass-reflect::before {
  content: "";
  position: absolute; top: 0; left: 0; right: 0; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
}
```

**使用规则：** 所有玻璃面板（顶栏、卡片、头像容器、弹窗）都应添加 `.glass-reflect`。

### 5.3 模糊层级

| 层级 | CSS 变量 | 值 | 用途 |
|------|----------|-----|------|
| **sm** | `--blur-sm` | `10px` | 卡片、输入框 |
| **md** | `--blur-md` | `15px` | 侧边栏、顶栏、glass 层 |
| **lg** | `--blur-lg` | `20px` | glass-medium 层 |
| **xl** | `--blur-xl` | `30px` | glass-heavy 层、弹窗 |

### 5.4 动态鲜艳背景（Vibrant Background）

Glassmorphism **必须**有鲜艳的背景色才能产生毛玻璃效果。项目使用三个 CSS 动画光球：

| 光球 | CSS 类名 | 颜色 | 位置 | 尺寸 | 动画周期 |
|------|----------|------|------|------|----------|
| Indigo | `.vibrant-bg::before` | `rgba(99,102,241,0.15)` | 左上 (top:-10%, left:20%) | 600x600 | 20s |
| Purple | `.vibrant-bg::after` | `rgba(139,0,255,0.12)` | 右下 (bottom:-5%, right:15%) | 500x500 | 25s |
| Teal | `.vibrant-blob-teal` | `rgba(32,178,170,0.1)` | 左中 (top:50%, left:-5%) | 400x400 | 22s |

**实现：** `<div className="vibrant-bg" />` + `<div className="vibrant-blob-teal" />` 放在页面最外层。

---

## 6. 阴影系统（Z-depth）

| 层级 | CSS 变量 | 值 | 用途 |
|------|----------|-----|------|
| **sm** | `--shadow-sm` | `0 2px 8px rgba(0,0,0,0.2)` | 轻微浮起 |
| **md** | `--shadow-md` | `0 4px 16px rgba(0,0,0,0.3)` | 卡片 |
| **lg** | `--shadow-lg` | `0 8px 32px rgba(0,0,0,0.4)` | 弹窗 |
| **xl** | `--shadow-xl` | `0 16px 48px rgba(0,0,0,0.5)` | 模态框 |
| **glow** | `--shadow-glow` | `0 0 20px accent-glow, 0 0 60px accent-bloom` | Accent 发光 |
| **cta-glow** | `--shadow-cta-glow` | `0 0 20px cta-glow` | CTA 发光 |

---

## 7. 圆角系统

| 层级 | CSS 变量 | 值 | 用途 |
|------|----------|-----|------|
| **sm** | `--radius-sm` | `8px` | 按钮、标签、小卡片 |
| **md** | `--radius-md` | `12px` | 输入框、中等面板 |
| **lg** | `--radius-lg` | `16px` | 卡片、消息气泡 |
| **xl** | `--radius-xl` | `24px` | 弹窗、模态框 |

---

## 8. 动画系统

### 8.1 缓动函数

| 名称 | CSS 变量 | 值 | 用途 |
|------|----------|-----|------|
| **ease-out** | `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | 通用出场动画 |
| **ease-spring** | `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | 弹性动画 |

### 8.2 时长

| 名称 | CSS 变量 | 值 | 用途 |
|------|----------|-----|------|
| **fast** | `--duration-fast` | `150ms` | 微交互、hover |
| **normal** | `--duration-normal` | `250ms` | 通用过渡 |
| **slow** | `--duration-slow` | `400ms` | 弹窗、大动画 |

### 8.3 预设动画类

| 类名 | 效果 | 用途 |
|------|------|------|
| `.animate-fade-in` | 从下方 4px 淡入 | 消息出现 |
| `.animate-fade-in-scale` | 从 0.95 缩放淡入 | 弹窗出现 |
| `.animate-slide-up` | 从下方 10px 滑入 | 下拉菜单 |
| `.stagger` | 子元素逐帧延迟 (0/60/120/180/240/300ms) | 列表渲染 |
| `.shimmer` | 45度光扫 (5s 周期) | 空状态图标 |
| `.breathe` | 呼吸脉冲 (2.5s, opacity+scale) | 执行中状态点 |
| `.breathe-soft` | 柔和呼吸 (3s, opacity only) | 休息模式指示 |

---

## 9. 组件规范

### 9.1 按钮

| 类型 | CSS 类名 | 颜色 | 发光 | 用途 |
|------|----------|------|------|------|
| **Ghost** | `.btn-ghost` | text-secondary → text-primary | 无 | 工具栏、次要操作 |
| **Accent** | `.btn-accent` | Indigo #6366F1 | accent-glow | 主要操作（非 CTA） |
| **CTA** | `.btn-cta` | Emerald #10B981 | cta-glow | 行动号召、发送、加载演示 |
| **Decision** | `.btn-decision` | text-primary → accent | hover 时 accent-bloom | 决策选项按钮 |

**按钮交互：**
- hover: `translateY(-1px)` + 发光增强
- active: `translateY(0) scale(0.97)`
- disabled: `opacity: 0.3`

### 9.2 卡片

| 类型 | CSS 类名 | 特点 | 用途 |
|------|----------|------|------|
| **Card** | `.card` | glass-light + hover 变 glass-medium | 静态卡片 |
| **Card Glow** | `.card-glow` | glass-light + inset 顶高光 + hover 发光 | 交互卡片、消息气泡、统计卡片 |

### 9.3 输入框

| 属性 | 值 |
|------|-----|
| **类名** | `.input-base` |
| **背景** | `var(--glass-light)` + `blur(10px)` |
| **边框** | `1px solid var(--glass-border)` |
| **圆角** | `var(--radius-md)` (12px) |
| **focus** | `border-color: var(--accent)` + `box-shadow: 0 0 0 3px var(--accent-muted), 0 0 12px var(--accent-bloom)` |

### 9.4 弹窗/模态框

| 属性 | 值 |
|------|-----|
| **遮罩** | `.modal-overlay` — `rgba(0,0,0,0.5)` + `blur(8px)` + fade-in 动画 |
| **面板** | `.modal-panel` — `glass-heavy` + `blur(30px) saturate(1.4)` + `radius-xl` + `shadow-xl` + inset 顶高光 + fade-in-scale 动画 |
| **关闭按钮** | `.btn-ghost` + SVG X 图标 |
| **标题栏** | SVG 图标 + 标题 + 关闭按钮，底部 `border-[var(--border)]`，添加 `.glass-reflect` |

### 9.5 进度条

| 属性 | 值 |
|------|-----|
| **轨道** | `.progress-track` — 3px 高，`var(--bg-hover)` |
| **填充** | `.progress-fill` + 语义色类 |
| **色类** | `.progress-accent` (Indigo+glow), `.progress-cta` (Emerald+glow), `.progress-warning`, `.progress-danger` |

### 9.6 状态指示点

| 状态 | CSS 类名 | 颜色 | 动画 |
|------|----------|------|------|
| idle | `.status-idle` | text-muted | 无 |
| executing | `.status-executing` | accent | breathe + glow |
| summarizing | `.status-summarizing` | warning | breathe + glow |
| reporting | `.status-reporting` | purple | breathe + glow |
| archived | `.status-archived` | success | 无 |
| error | `.status-error` | danger | glow |

---

## 10. 布局规范

### 10.1 页面结构

```
┌─────────────────────────────────────────────────┐
│ Header (h-11, glass-surface, glass-reflect)     │
├──────────┬──────────────────────────────────────┤
│ Sidebar  │ Main Content                         │
│ w-260px  │ flex-1                               │
│ glass-   │                                      │
│ surface  │                                      │
│          │                                      │
├──────────┤                                      │
│ Chats    │                                      │
│ max-h-45%│                                      │
└──────────┴──────────────────────────────────────┘
```

### 10.2 关键尺寸

| 元素 | 尺寸 |
|------|------|
| 顶栏高度 | `h-11` (44px) |
| 侧边栏宽度 | `w-[260px]` |
| 会话列表最大高度 | `max-h-[45%]` |
| 消息气泡最大宽度 | `max-w-[72%]` |
| 头像尺寸 | `w-7 h-7` (28px) 气泡内, `w-5 h-5` (20px) 列表内 |
| 状态点 | `7x7px` |
| 滚动条 | `5px` 宽 |

---

## 11. 图标规范

**全面禁止使用 emoji 作为图标。所有图标必须使用 SVG 内联图标，符合 Glassmorphism 几何线条风格。**

### 11.1 图标库

图标组件统一定义在 `src/components/common/Icons.tsx`，包含以下分类：

| 分类 | 图标 | 标识符 | 用途 |
|------|------|--------|------|
| **头像** | IconBot | `"bot"` | Agent 默认头像 |
| | IconUser | `"user"` | 用户/老板头像 |
| | IconSupervisor | `"supervisor"` | 主管 Agent 头像 |
| | IconSpecialist | `"specialist"` | 专员 Agent 头像 |
| | IconGroupChat | `"group"` | 群聊类型图标 |
| | IconCollaborator | `"collaborator"` | 外部协作者头像 |
| **斜杠命令** | IconTask | — | /new_task 命令 |
| | IconChart | — | /summary 命令 |
| | IconArchive | — | /archive 命令 |
| | IconMoon | — | /rest_mode 命令 |
| | IconHelp | — | /help 命令 |
| **知识库** | IconGlobe | — | 全局知识库 |
| | IconBuilding | — | 部门知识库 |

**头像渲染辅助函数：** `renderAvatarIcon(avatar, size, className)` — 根据 avatar 标识符渲染对应 SVG 图标。

**新增图标规则：** 当素材库中没有所需图标时，必须在 `Icons.tsx` 中新增符合以下规范的 SVG 图标：
- stroke 1.2（默认），fill none
- 使用 CSS 变量颜色（`var(--accent)`, `var(--cta)`, `var(--info)` 等）
- 几何线条风格，与 Glassmorphism 毛玻璃主题一致
- 提供 `size`、`className`、`color` 三个 props

### 11.2 图标尺寸规范

| 场景 | 图标风格 | 尺寸 |
|------|----------|------|
| 顶栏工具按钮 | 14x14 SVG, stroke 1.2 | 14px |
| 弹窗标题图标 | 12x12 SVG, stroke 1.2 | 12px |
| 卡片内小图标 | 10x10 SVG, stroke 1.2 | 10px |
| 空状态大图标 | 16-18x16-18 SVG | 16-18px |
| Logo | 16x16 SVG, stroke 1.2 | 16px |
| 头像图标 | 10-14px SVG | 按容器大小 |

### 11.3 Avatar 标识符

avatar 字段使用字符串标识符而非 emoji：

| 标识符 | 含义 | 对应图标 |
|--------|------|----------|
| `"bot"` | 通用 Agent | IconBot |
| `"user"` | 用户/老板 | IconUser |
| `"supervisor"` | 主管 Agent | IconSupervisor |
| `"specialist"` | 专员 Agent | IconSpecialist |
| `"group"` | 群聊 | IconGroupChat |
| `"collaborator"` | 外部协作者 | IconCollaborator |

---

## 12. 文字规范

| 元素 | 字号 | 字重 | 字体 | 颜色 |
|------|------|------|------|------|
| 品牌名 | 14px | 600 | Space Grotesk | text-primary |
| 面板标题 | 13px | 600 | Space Grotesk | text-primary |
| 区块标题 | 10px | 600 | Space Grotesk | text-muted, uppercase, tracking-wider |
| 消息正文 | 13px | 400 | DM Sans | text-primary |
| 列表项名称 | 12px | 400/500 | DM Sans | text-secondary → primary on hover |
| 辅助信息 | 11px | 400 | DM Sans | text-secondary |
| 时间戳/计数 | 10px | 400 | DM Sans | text-muted |
| 极淡文字 | 9px | 500 | DM Sans | text-faint |
| 徽章/标签 | 9px | 500 | DM Sans | 语义色 + muted 背景 |
| 代码/命令 | 12px | 400 | monospace | accent |

---

## 12. 交互规范

### 12.1 Hover

| 元素 | 效果 |
|------|------|
| 列表项 | `bg-[var(--bg-hover)]` + 文字变亮 |
| 卡片 | 边框变亮 + 发光 |
| 按钮 | 颜色变亮 + 发光增强 + `translateY(-1px)` |
| 输入框 | 边框变亮 |

### 12.2 Active

| 元素 | 效果 |
|------|------|
| 按钮 | `translateY(0) scale(0.97)` |
| 列表项 | `bg-[var(--bg-active)]` |

### 12.3 Focus

| 元素 | 效果 |
|------|------|
| 输入框 | `border-color: accent` + `box-shadow: 0 0 0 3px accent-muted, 0 0 12px accent-bloom` |
| 通用 | `outline: 2px solid accent, offset: 2px` |

### 12.4 Disabled

| 元素 | 效果 |
|------|------|
| 按钮 | `opacity: 0.3`, `cursor: not-allowed` |
| 决策按钮 | `opacity: 0.4` |

---

## 13. 反模式（禁止事项）

| 禁止 | 原因 |
|------|------|
| 纯色不透明背景（如 `bg-white`, `bg-black`） | 破坏 Glassmorphism 毛玻璃效果 |
| 不使用 `.glass` / `.card-glow` 等预设类 | 必须使用设计系统定义的玻璃层 |
| 在玻璃面板上使用 `box-shadow` 而非预设阴影 | 必须使用 `--shadow-*` 变量 |
| 使用非规范颜色值（如硬编码 hex） | 必须使用 CSS 变量 |
| 使用 emoji 作为任何图标（包括头像、命令菜单等） | 必须使用 SVG 内联图标（Icons.tsx） |
| 不添加 `.glass-reflect` 到玻璃面板 | 光源反射是 Glassmorphism 规范要求 |
| 不添加 vibrant-bg 到页面 | 鲜艳背景是 Glassmorphism 的必要条件 |
| 使用非规范字体 | 标题必须 Space Grotesk，正文必须 DM Sans |
| 使用非规范圆角 | 必须使用 `--radius-*` 变量 |
| 动画时长超出规范 | 必须 150-400ms，使用 `--duration-*` 变量 |

---

## 14. 新增组件检查清单

新增任何 UI 组件时，必须逐项确认：

- [ ] 背景使用 `.glass` / `.glass-medium` / `.glass-heavy` / `.glass-surface` 之一
- [ ] 添加 `.glass-reflect`（如适用）
- [ ] 边框使用 `var(--border)` / `var(--glass-border)` 变量
- [ ] 颜色全部使用 CSS 变量，无硬编码
- [ ] 圆角使用 `var(--radius-*)` 变量
- [ ] 阴影使用 `var(--shadow-*)` 变量
- [ ] 字体：标题 `font-heading`，正文默认 DM Sans
- [ ] 字号遵循第 12 节文字规范
- [ ] 动画使用 `var(--duration-*)` + `var(--ease-*)` 变量
- [ ] 按钮 使用 `.btn-ghost` / `.btn-accent` / `.btn-cta` / `.btn-decision`
- [ ] 输入框 使用 `.input-base`
- [ ] 弹窗 使用 `.modal-overlay` + `.modal-panel`
- [ ] 进度条 使用 `.progress-track` + `.progress-fill`
- [ ] 状态点 使用 `.status-dot` + `.status-*`
- [ ] 图标使用 SVG 内联（全面禁止 emoji，包括头像和命令菜单）
- [ ] hover/active/focus 遵循第 12 节交互规范

---

## 15. 文件清单

| 文件路径 | 职责 |
|----------|------|
| `src/app/globals.css` | 设计系统全部定义（变量、玻璃层、按钮、卡片、动画等） |
| `src/app/page.tsx` | 主页面布局、vibrant-bg、顶栏、空状态 |
| `src/app/layout.tsx` | Next.js 根布局 |
| `src/components/org/OrgSidebar.tsx` | 组织架构侧边栏 + 会话列表 |
| `src/components/org/OrgChartView.tsx` | 组织架构图弹窗 |
| `src/components/chat/ChatWindow.tsx` | 聊天窗口主区域 |
| `src/components/chat/MessageBubble.tsx` | 消息气泡（6 种类型） |
| `src/components/chat/ChatInput.tsx` | 输入框 + 斜杠命令 + @提及 |
| `src/components/common/Icons.tsx` | Glassmorphism 风格 SVG 图标库（全面禁止 emoji） |
| `src/components/common/KnowledgePanel.tsx` | 知识库弹窗 |
| `src/components/common/CostPanel.tsx` | 成本统计弹窗 |

---

## 16. 版本记录

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0 | 2026-05-22 | 初始版本 — Linear Aesthetic 暗色主题 |
| 2.0 | 2026-05-23 | 全面重构为 Glassmorphism 风格，基于 UI/UX Pro Max Skill Style #3 |
| 2.1 | 2026-05-23 | 整理为规范文档，新增反模式和检查清单 |
| 2.2 | 2026-05-23 | 全面禁止 emoji，新增 Icons.tsx 图标库，avatar 改用标识符 |
