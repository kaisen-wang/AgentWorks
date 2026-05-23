"use client";

import { useState } from "react";
import { useAppStore } from "@/stores/appStore";
import type { AppState } from "@/stores/appStore";
import { renderAvatarIcon } from "@/components/common/Icons";
import type { AgentId } from "@/types";

/** 外部工具授权面板 (EXT-01) */
export function ToolAuthPanel({ onClose }: { onClose: () => void }) {
  const agents = useAppStore((s: AppState) => s.agents);
  const updateAgent = useAppStore((s: AppState) => s.updateAgent);
  const [selectedAgent, setSelectedAgent] = useState<AgentId | null>(null);
  const [newTool, setNewTool] = useState("");
  const agentList = Object.values(agents);

  const selectedAgentData = selectedAgent ? agents[selectedAgent] : null;
  const declaredTools = selectedAgentData?.capabilities.flatMap((c) => c.tools || []) || [];

  const handleAddTool = () => {
    if (!selectedAgent || !newTool.trim()) return;
    const agent = agents[selectedAgent];
    updateAgent(selectedAgent, {
      capabilities: [...agent.capabilities, { name: newTool.trim(), description: `外部工具: ${newTool.trim()}`, tools: [newTool.trim()] }],
    });
    setNewTool("");
  };

  const handleRemoveTool = (toolName: string) => {
    if (!selectedAgent) return;
    const agent = agents[selectedAgent];
    updateAgent(selectedAgent, {
      capabilities: agent.capabilities.filter((c) => !(c.tools?.includes(toolName) && c.name === toolName)),
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel w-[500px] max-h-[70vh]" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between glass-reflect">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-[var(--warning-muted)] flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="var(--warning)" strokeWidth="1.2">
                <path d="M6 1L11 6L6 11L1 6Z" />
                <path d="M6 4V6.5" strokeLinecap="round" />
                <circle cx="6" cy="8.5" r="0.5" fill="var(--warning)" />
              </svg>
            </div>
            <h2 className="text-[13px] font-semibold font-heading text-[var(--text-primary)]">工具授权</h2>
          </div>
          <button onClick={onClose} className="btn-ghost !px-2 !py-1">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 2L10 10M10 2L2 10"/></svg>
          </button>
        </div>
        <div className="p-5 space-y-4">
          {/* Agent 选择 */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold font-heading uppercase tracking-[0.08em] text-[var(--text-muted)]">选择 Agent</label>
            <div className="space-y-1 max-h-[200px] overflow-y-auto">
              {agentList.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => setSelectedAgent(agent.id)}
                  className={`w-full px-3 py-2 rounded-lg flex items-center gap-2.5 transition-all duration-[150ms] ${
                    selectedAgent === agent.id
                      ? "glass-medium border border-[var(--accent)] border-opacity-40"
                      : "hover:bg-[var(--bg-hover)]"
                  }`}
                >
                  <div className="w-5 h-5 rounded-md glass flex items-center justify-center glass-reflect">
                    {renderAvatarIcon(agent.avatar, 10)}
                  </div>
                  <span className="text-[12px] text-[var(--text-primary)]">{agent.name}</span>
                  <span className="text-[9px] text-[var(--text-muted)] glass px-1.5 py-[1px] rounded">{agent.role}</span>
                  <span className="ml-auto text-[9px] text-[var(--text-faint)] tabular-nums">{declaredTools.length} 工具</span>
                </button>
              ))}
            </div>
          </div>

          {/* 工具列表 */}
          {selectedAgentData && (
            <div className="space-y-2">
              <label className="text-[10px] font-semibold font-heading uppercase tracking-[0.08em] text-[var(--text-muted)]">
                已授权工具 — {selectedAgentData.name}
              </label>
              {declaredTools.length === 0 ? (
                <p className="text-[11px] text-[var(--text-muted)] py-3 text-center">暂无授权工具</p>
              ) : (
                <div className="space-y-1">
                  {declaredTools.map((tool) => (
                    <div key={tool} className="card-glow glass-reflect flex items-center gap-2 px-3 py-2 rounded-lg">
                      <span className="text-[11px] text-[var(--accent)] font-mono flex-1">{tool}</span>
                      <button
                        onClick={() => handleRemoveTool(tool)}
                        className="text-[9px] text-[var(--danger)] hover:text-[var(--danger)] opacity-60 hover:opacity-100 transition-opacity"
                      >
                        移除
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* 添加工具 */}
              <div className="flex gap-2 pt-1">
                <input
                  value={newTool}
                  onChange={(e) => setNewTool(e.target.value)}
                  placeholder="工具名称 (如 dall-e, gmail)"
                  className="input-base text-[12px] flex-1"
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddTool(); }}
                />
                <button onClick={handleAddTool} disabled={!newTool.trim()} className="btn-cta !px-3 !py-2 !text-[11px] !rounded-lg shrink-0">
                  授权
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
