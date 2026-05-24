"use client";

import { useState, useEffect } from "react";
import { useAppStore, startAutoSync, stopAutoSync } from "@/stores/appStore";
import type { AppState } from "@/stores/appStore";
import { OrgSidebar } from "@/components/org/OrgSidebar";
import { OrgChartView } from "@/components/org/OrgChartView";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { KnowledgePanel } from "@/components/common/KnowledgePanel";
import { CostPanel } from "@/components/common/CostPanel";
import { ScriptPanel } from "@/components/common/ScriptPanel";
import { RestModePanel } from "@/components/common/RestModePanel";

export default function HomePage() {
  const activeChatId = useAppStore((s: AppState) => s.activeChatId);
  const restMode = useAppStore((s: AppState) => s.restMode);
  const agents = useAppStore((s: AppState) => s.agents);

  const [showOrgChart, setShowOrgChart] = useState(false);
  const [showKnowledge, setShowKnowledge] = useState(false);
  const [showCost, setShowCost] = useState(false);
  const [showScript, setShowScript] = useState(false);
  const [showRestMode, setShowRestMode] = useState(false);

  // 启动服务端数据自动同步
  useEffect(() => {
    startAutoSync();
    return () => stopAutoSync();
  }, []);

  const agentCount = Object.keys(agents).length;

  const initializeDemo = () => {
    const state = useAppStore.getState();
    if (Object.keys(state.agents).length > 0) return;

    const supervisor = state.createAgent(
      "营销主管", "supervisor", null,
      [{ name: "task_decomposition", description: "任务拆解与分配" }, { name: "quality_check", description: "质量检查" }],
      { model: "gpt-4", decisionThreshold: 5, monthlyBudget: 20 }
    );
    if ("error" in supervisor) return;

    const designer = state.createAgent(
      "图文本设计", "specialist", supervisor.id,
      [{ name: "design", description: "海报、文案、排版设计" }, { name: "image_generation", description: "DALL-E 图片生成", tools: ["dall-e"] }],
      { model: "gpt-4", monthlyBudget: 10 }
    );

    const publisher = state.createAgent(
      "平台发布", "specialist", supervisor.id,
      [{ name: "publish", description: "多平台格式适配与发布" }, { name: "analytics", description: "数据统计" }],
      { model: "gpt-3.5-turbo", monthlyBudget: 5 }
    );

    if ("error" in designer || "error" in publisher) return;

    const chat = state.createChat("group", "营销作战室", [
      { id: "user", name: "你", avatar: "user", role: "owner" },
      { id: supervisor.id, name: supervisor.name, avatar: supervisor.avatar, role: "member" },
      { id: designer.id, name: designer.name, avatar: designer.avatar, role: "readonly" },
      { id: publisher.id, name: publisher.name, avatar: publisher.avatar, role: "readonly" },
    ]);

    state.setActiveChat(chat.id);
    state.sendMessage(chat.id, "system", "system", "营销作战室已创建。营销主管已加入，下属默认只读（被@时激活）。");
  };

  return (
    <div className="h-screen flex flex-col bg-[var(--bg-canvas)] relative">
      {/* Vibrant background blobs — Glassmorphism requires colorful BG */}
      <div className="vibrant-bg" />
      <div className="vibrant-blob-teal" />

      {/* Top bar — glass surface */}
      <header className="h-11 glass-surface flex items-center px-4 relative z-10 glass-reflect">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[var(--accent)] flex items-center justify-center glow-accent">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1L15 5.5V10.5L8 15L1 10.5V5.5L8 1Z" stroke="white" strokeWidth="1.2" fill="none"/>
              <circle cx="8" cy="8" r="2.5" fill="white" opacity="0.85"/>
            </svg>
          </div>
          <h1 className="text-[14px] font-semibold font-heading text-[var(--text-primary)] tracking-tight">
            AgentWorks
          </h1>
          <span className="text-[9px] font-medium text-[var(--text-muted)] bg-[var(--glass-light)] px-1.5 py-[2px] rounded border border-[var(--glass-border)] uppercase tracking-widest">
            MVP
          </span>
        </div>

        <div className="flex-1" />

        {agentCount > 0 && (
          <span className="text-[10px] text-[var(--text-muted)] mr-3 tabular-nums">
            {agentCount} Agent{agentCount > 1 ? "s" : ""}
          </span>
        )}

        {restMode.enabled && (
          <span className="text-[10px] font-medium text-[var(--warning)] bg-[var(--warning-muted)] px-2 py-[3px] rounded-md mr-3 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--warning)] breathe-soft" />
            休息模式
          </span>
        )}

        {/* Toolbar */}
        <div className="flex items-center gap-0.5">
          <button onClick={() => setShowOrgChart(true)} className="btn-ghost">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
              <circle cx="7" cy="3" r="1.5"/><circle cx="3" cy="10" r="1.5"/><circle cx="11" cy="10" r="1.5"/>
              <line x1="7" y1="4.5" x2="3" y2="8.5"/><line x1="7" y1="4.5" x2="11" y2="8.5"/>
            </svg>
            架构图
          </button>
          <button onClick={() => setShowKnowledge(true)} className="btn-ghost">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M2 4L7 2L12 4L7 6L2 4Z"/><path d="M2 4V10L7 12V6"/><path d="M12 4V10L7 12V6"/>
            </svg>
            知识库
          </button>
          <button onClick={() => setShowCost(true)} className="btn-ghost">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
              <rect x="1" y="3" width="12" height="9" rx="1.5"/><line x1="1" y1="6" x2="13" y2="6"/><line x1="4" y1="9" x2="6" y2="9"/>
            </svg>
            成本
          </button>
          <button onClick={() => setShowScript(true)} className="btn-ghost">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
              <rect x="2" y="1" width="10" height="12" rx="1.5"/><line x1="5" y1="4" x2="9" y2="4"/><line x1="5" y1="6.5" x2="9" y2="6.5"/><line x1="5" y1="9" x2="7" y2="9"/>
            </svg>
            剧本
          </button>
          <button onClick={() => setShowRestMode(true)} className="btn-ghost">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M8 2C5 2 2.5 4.5 2.5 7.5C2.5 10.5 5 13 8 13C8.7 13 9.3 12.9 9.9 12.7C8 11.5 6.8 9.5 6.8 7.2C6.8 5 8 3 9.9 1.8C9.3 1.6 8.7 1.5 8 1.5"/>
            </svg>
            休息
          </button>

          <div className="w-px h-4 bg-[var(--border)] mx-1.5" />

          <button onClick={initializeDemo} className="btn-ghost text-[var(--cta)] hover:text-[var(--cta-hover)] hover:bg-[var(--cta-muted)]">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M7 1V7L10 10"/><circle cx="7" cy="7" r="6"/>
            </svg>
            加载演示
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        {/* Left sidebar — glass */}
        <aside className="w-[260px] glass-surface overflow-hidden flex-shrink-0">
          <OrgSidebar />
        </aside>

        {/* Right — Chat or empty state */}
        <main className="flex-1 overflow-hidden relative">
          {activeChatId ? (
            <ChatWindow chatId={activeChatId} />
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center space-y-5 max-w-[300px] animate-fade-in">
                {/* Hero with glass card */}
                <div className="relative inline-block">
                  <div className="absolute inset-0 bg-[var(--accent)] opacity-15 blur-[40px] rounded-full scale-150" />
                  <div className="relative w-20 h-20 rounded-2xl glass-medium flex items-center justify-center mx-auto shimmer glass-reflect">
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                      <path d="M16 4L28 10.5V21.5L16 28L4 21.5V10.5L16 4Z" stroke="var(--accent)" strokeWidth="1.5" fill="none" opacity="0.5"/>
                      <circle cx="16" cy="16" r="5" fill="var(--accent)" opacity="0.2"/>
                      <circle cx="16" cy="16" r="2" fill="var(--accent)"/>
                    </svg>
                  </div>
                </div>

                <div className="space-y-2">
                  <h2 className="text-[17px] font-semibold font-heading text-[var(--text-primary)] tracking-tight">
                    AgentWorks
                  </h2>
                  <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
                    一人公司 AI Agent 工作集<br />
                    用聊天的方式管理你的虚拟团队
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  <button onClick={initializeDemo} className="btn-cta w-full justify-center py-3">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M8 2V8L11 11"/><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" fill="none"/>
                    </svg>
                    加载演示场景
                  </button>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    或输入 <code className="text-[var(--accent)] font-mono bg-[var(--accent-muted)] px-1.5 py-0.5 rounded">/new_agent</code> 创建 Agent
                  </p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      {showOrgChart && <OrgChartView onClose={() => setShowOrgChart(false)} />}
      {showKnowledge && <KnowledgePanel onClose={() => setShowKnowledge(false)} />}
      {showCost && <CostPanel onClose={() => setShowCost(false)} />}
      {showScript && <ScriptPanel onClose={() => setShowScript(false)} />}
      {showRestMode && <RestModePanel onClose={() => setShowRestMode(false)} />}
    </div>
  );
}
