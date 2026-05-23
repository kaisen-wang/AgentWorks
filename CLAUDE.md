# AgentWorks — Project Context

## Mandatory Loading

**每次新对话开始时，必须首先读取以下文件：**

```
docs/UI-DESIGN-SYSTEM.md
docs/PROGRESS.md
```

此文件包含完整的 UI 设计系统规范。任何涉及 UI 的需求（新增组件、修改样式、调整布局等）都必须严格遵循该规范，不得出现风格不一致。

## Project Overview

- **Name**: AgentWorks — 一人公司 AI Agent 工作集工具
- **Stack**: Next.js 16 + TypeScript + Zustand + Tailwind CSS
- **UI Style**: Glassmorphism (UI/UX Pro Max Skill Style #3)
- **Fonts**: Space Grotesk (heading) + DM Sans (body)
- **Palette**: Micro SaaS — Indigo #6366F1 (accent) + Emerald #10B981 (CTA)

## Key Files

| File | Purpose |
|------|---------|
| `docs/UI-DESIGN-SYSTEM.md` | **UI 设计系统规范（必读）** |
| `src/app/globals.css` | 设计系统 CSS 实现 |
| `src/components/common/Icons.tsx` | **Glassmorphism 风格 SVG 图标库（全面禁止 emoji）** |
| `src/app/page.tsx` | 主页面 |
| `src/components/` | 所有 UI 组件 |
| `src/stores/appStore.ts` | Zustand 全局状态 |
| `src/types/index.ts` | TypeScript 类型定义 |
| `src/lib/` | Agent 基类 + 工作流引擎 |

## Icon Rules

**全面禁止使用 emoji 作为图标。** 所有图标需求必须使用 `src/components/common/Icons.tsx` 中的 SVG 图标组件。当素材库中没有所需图标时，必须在 Icons.tsx 中新增符合 Glassmorphism 风格的 SVG 图标（stroke 1.2、CSS 变量颜色、几何线条风格）。

avatar 字段使用字符串标识符（`"bot"` | `"user"` | `"supervisor"` | `"specialist"` | `"group"` | `"collaborator"`），通过 `renderAvatarIcon()` 渲染为 SVG 图标。

## UI Skill

UI/UX Pro Max Skill 已安装于 `.claude/skills/ui-ux-pro-max/`，包含 67 种 UI 风格、96 个配色方案、57 种字体搭配、99 条 UX 准则。当前使用 Style #3 Glassmorphism。
