/**
 * Glassmorphism 风格 SVG 图标库
 *
 * 设计规范：
 * - stroke 1.2（默认），fill none
 * - 使用 CSS 变量颜色（var(--accent), var(--cta) 等）
 * - 几何线条风格，与 Glassmorphism 毛玻璃主题一致
 * - 尺寸遵循 UI-DESIGN-SYSTEM.md 第 11 节图标规范
 *
 * 禁止使用 emoji 作为图标，所有图标需求必须从此库中选取或新增符合风格的 SVG。
 */

import React from "react";

// ============================================================
// 基础 Props
// ============================================================

interface IconProps {
  size?: number;
  className?: string;
  color?: string;
}

// ============================================================
// 头像类图标（用于 Agent 头像、用户头像、聊天类型图标）
// ============================================================

/** 机器人 — Agent 默认头像 (原 🤖) */
export function IconBot({ size = 14, className, color = "var(--accent)" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" className={className}>
      <rect x="3" y="4" width="8" height="6" rx="1.5" stroke={color} strokeWidth="1.2" />
      <circle cx="5.5" cy="7" r="0.8" fill={color} />
      <circle cx="8.5" cy="7" r="0.8" fill={color} />
      <path d="M5.5 10V11.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M8.5 10V11.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M7 2V4" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="7" cy="1.5" r="0.8" stroke={color} strokeWidth="1.0" />
    </svg>
  );
}

/** 用户/老板头像 (原 👤) */
export function IconUser({ size = 14, className, color = "var(--cta)" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" className={className}>
      <circle cx="7" cy="4.5" r="2.5" stroke={color} strokeWidth="1.2" />
      <path d="M2 13C2 9.5 4.5 8 7 8C9.5 8 12 9.5 12 13" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

/** 主管/领带 — supervisor 头像 (原 👔) */
export function IconSupervisor({ size = 14, className, color = "var(--accent)" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" className={className}>
      <circle cx="7" cy="3.5" r="2" stroke={color} strokeWidth="1.2" />
      <path d="M5.5 5.5L7 12L8.5 5.5" stroke={color} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M5 5.5H9" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

/** 专员/扳手 — specialist 头像 (原 🔧) */
export function IconSpecialist({ size = 14, className, color = "var(--info)" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" className={className}>
      <path d="M4 10L9 5" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M9 2C10.5 2 12 3.5 12 5L9 5L9 2Z" stroke={color} strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx="3.5" cy="10.5" r="2" stroke={color} strokeWidth="1.2" />
    </svg>
  );
}

/** 群聊/对话气泡 (原 💬) */
export function IconGroupChat({ size = 14, className, color = "var(--accent)" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" className={className}>
      <rect x="1" y="2" width="9" height="7" rx="1.5" stroke={color} strokeWidth="1.2" />
      <path d="M3 9L2 11L5 9" stroke={color} strokeWidth="1.2" strokeLinejoin="round" />
      <rect x="5" y="5" width="8" height="6" rx="1.5" stroke={color} strokeWidth="1.2" />
      <path d="M11 11L12 13L9.5 11" stroke={color} strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

/** 协作者/人形 (原 🧑) */
export function IconCollaborator({ size = 14, className, color = "var(--text-secondary)" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" className={className}>
      <circle cx="5" cy="4" r="2" stroke={color} strokeWidth="1.2" />
      <path d="M1 11C1 8.5 3 7 5 7C7 7 9 8.5 9 11" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="10.5" cy="5" r="1.5" stroke={color} strokeWidth="1.0" />
      <path d="M8 11C8 9.5 9 8.5 10.5 8.5C12 8.5 13 9.5 13 11" stroke={color} strokeWidth="1.0" strokeLinecap="round" />
    </svg>
  );
}

// ============================================================
// 斜杠命令图标
// ============================================================

/** 新建 Agent 命令 (原 🤖) — 复用 IconBot */
export { IconBot as IconCmdNewAgent };

/** 任务/剪贴板 (原 📋) */
export function IconTask({ size = 14, className, color = "var(--accent)" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" className={className}>
      <rect x="3" y="1.5" width="8" height="11" rx="1.5" stroke={color} strokeWidth="1.2" />
      <path d="M5.5 1.5V0.5H8.5V1.5" stroke={color} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M5.5 6L6.5 7L8.5 5" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 9H8.5" stroke={color} strokeWidth="1.0" strokeLinecap="round" />
    </svg>
  );
}

/** 汇总/图表 (原 📊) */
export function IconChart({ size = 14, className, color = "var(--accent)" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" className={className}>
      <rect x="1.5" y="8" width="2.5" height="4.5" rx="0.5" stroke={color} strokeWidth="1.2" />
      <rect x="5.75" y="5" width="2.5" height="7.5" rx="0.5" stroke={color} strokeWidth="1.2" />
      <rect x="10" y="1.5" width="2.5" height="11" rx="0.5" stroke={color} strokeWidth="1.2" />
    </svg>
  );
}

/** 归档/数据库 (原 🗄) */
export function IconArchive({ size = 14, className, color = "var(--accent)" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" className={className}>
      <ellipse cx="7" cy="3.5" rx="5" ry="2" stroke={color} strokeWidth="1.2" />
      <path d="M2 3.5V7" stroke={color} strokeWidth="1.2" />
      <path d="M12 3.5V7" stroke={color} strokeWidth="1.2" />
      <ellipse cx="7" cy="7" rx="5" ry="2" stroke={color} strokeWidth="1.2" />
      <path d="M2 7V10.5" stroke={color} strokeWidth="1.2" />
      <path d="M12 7V10.5" stroke={color} strokeWidth="1.2" />
      <ellipse cx="7" cy="10.5" rx="5" ry="2" stroke={color} strokeWidth="1.2" />
    </svg>
  );
}

/** 月亮/休息模式 (原 🌙) */
export function IconMoon({ size = 14, className, color = "var(--warning)" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" className={className}>
      <path d="M8 2C5 2 2.5 4.5 2.5 7.5C2.5 10.5 5 13 8 13C8.7 13 9.3 12.9 9.9 12.7C8 11.5 6.8 9.5 6.8 7.2C6.8 5 8 3 9.9 1.8C9.3 1.6 8.7 1.5 8 1.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 帮助/问号 (原 ❓) */
export function IconHelp({ size = 14, className, color = "var(--text-secondary)" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" className={className}>
      <circle cx="7" cy="7" r="5.5" stroke={color} strokeWidth="1.2" />
      <path d="M5.5 5C5.5 3.8 6.2 3 7 3C7.8 3 8.5 3.8 8.5 5C8.5 5.8 7.8 6.2 7 6.5V8" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="7" cy="10" r="0.5" fill={color} />
    </svg>
  );
}

// ============================================================
// 知识库范围图标
// ============================================================

/** 全局/地球 (原 🌐) */
export function IconGlobe({ size = 14, className, color = "var(--info)" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" className={className}>
      <circle cx="7" cy="7" r="5.5" stroke={color} strokeWidth="1.2" />
      <ellipse cx="7" cy="7" rx="3" ry="5.5" stroke={color} strokeWidth="1.0" />
      <path d="M1.5 7H12.5" stroke={color} strokeWidth="1.0" />
      <path d="M2.5 4.5H11.5" stroke={color} strokeWidth="0.8" />
      <path d="M2.5 9.5H11.5" stroke={color} strokeWidth="0.8" />
    </svg>
  );
}

/** 部门/建筑 (原 🏢) */
export function IconBuilding({ size = 14, className, color = "var(--accent)" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" className={className}>
      <rect x="2" y="3" width="10" height="10" rx="1" stroke={color} strokeWidth="1.2" />
      <rect x="4" y="5" width="2" height="1.5" rx="0.3" stroke={color} strokeWidth="0.8" />
      <rect x="8" y="5" width="2" height="1.5" rx="0.3" stroke={color} strokeWidth="0.8" />
      <rect x="4" y="8" width="2" height="1.5" rx="0.3" stroke={color} strokeWidth="0.8" />
      <rect x="8" y="8" width="2" height="1.5" rx="0.3" stroke={color} strokeWidth="0.8" />
      <rect x="5.5" y="10.5" width="3" height="2.5" rx="0.3" stroke={color} strokeWidth="0.8" />
    </svg>
  );
}

// ============================================================
// 头像渲染辅助函数
// ============================================================

/**
 * 根据 avatar 标识符渲染对应的 SVG 图标
 * avatar 标识符: "bot" | "user" | "supervisor" | "specialist" | "group" | "collaborator"
 */
export function renderAvatarIcon(avatar: string, size = 14, className?: string) {
  switch (avatar) {
    case "bot":
      return <IconBot size={size} className={className} />;
    case "user":
      return <IconUser size={size} className={className} />;
    case "supervisor":
      return <IconSupervisor size={size} className={className} />;
    case "specialist":
      return <IconSpecialist size={size} className={className} />;
    case "group":
      return <IconGroupChat size={size} className={className} />;
    case "collaborator":
      return <IconCollaborator size={size} className={className} />;
    default:
      return <IconBot size={size} className={className} />;
  }
}
