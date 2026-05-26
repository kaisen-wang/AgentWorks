"use client";

/**
 * AgentDetailPanel - Agent 详情/编辑面板
 *
 * 展示 Agent 信息，支持编辑描述、动态增删能力标签。
 */

import { useState } from "react";
import { useAppStore } from "@/stores/appStore";
import type { AppState } from "@/stores/appStore";
import type { AgentId, AgentCapability } from "@/types";
import { PRESET_CAPABILITIES } from "@/lib/capability/CapabilityMatcher";
import { renderAvatarIcon } from "@/components/common/Icons";

interface AgentDetailPanelProps {
  agentId: AgentId;
  onClose: () => void;
}

export function AgentDetailPanel({ agentId, onClose }: AgentDetailPanelProps) {
  const agent = useAppStore((s: AppState) => s.agents[agentId]);
  const updateAgent = useAppStore((s: AppState) => s.updateAgent);
  const deleteAgent = useAppStore((s: AppState) => s.deleteAgent);

  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState(agent?.description || "");
  const [customCapInput, setCustomCapInput] = useState("");

  if (!agent) return null;

  const currentCapNames = new Set(agent.capabilities.map((c) => c.name));

  const toggleCapability = (capName: string) => {
    const preset = PRESET_CAPABILITIES.find((c) => c.name === capName);
    if (currentCapNames.has(capName)) {
      updateAgent(agentId, { capabilities: agent.capabilities.filter((c) => c.name !== capName) });
    } else {
      const newCap: AgentCapability = preset || { name: capName, description: capName };
      updateAgent(agentId, { capabilities: [...agent.capabilities, newCap] });
    }
  };

  const addCustomCapability = () => {
    const name = customCapInput.trim();
    if (!name || currentCapNames.has(name)) return;
    const newCap: AgentCapability = { name, description: name };
    updateAgent(agentId, { capabilities: [...agent.capabilities, newCap] });
    setCustomCapInput("");
  };

  const removeCapability = (capName: string) => {
    updateAgent(agentId, { capabilities: agent.capabilities.filter((c) => c.name !== capName) });
  };

  const saveDescription = () => {
    updateAgent(agentId, { description: descDraft.trim() });
    setIsEditingDesc(false);
  };

  const usagePercent = agent.config.monthlyBudget > 0
    ? Math.round((agent.config.budgetUsed / agent.config.monthlyBudget) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-medium rounded-xl p-6 w-[520px] max-h-[85vh] overflow-y-auto space-y-5 animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg glass flex items-center justify-center glass-reflect">
              {renderAvatarIcon(agent.avatar, 16)}
            </div>
            <div>
              <h2 className="text-[15px] font-semibold font-heading text-[var(--text-primary)]">{agent.name}</h2>
              <span className="text-[10px] text-[var(--text-muted)]">
                {agent.role === "supervisor" ? "主管" : "专员"} · {agent.status === "idle" ? "空闲" : agent.status === "executing" ? "执行中" : agent.status}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost text-[var(--text-muted)]">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M3 3L11 11M11 3L3 11" />
            </svg>
          </button>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[12px] font-medium text-[var(--text-secondary)]">描述</label>
            {!isEditingDesc && (
              <button
                onClick={() => { setDescDraft(agent.description); setIsEditingDesc(true); }}
                className="text-[10px] text-[var(--accent)] hover:underline"
              >
                编辑
              </button>
            )}
          </div>
          {isEditingDesc ? (
            <div className="space-y-2">
              <textarea
                value={descDraft}
                onChange={(e) => setDescDraft(e.target.value)}
                placeholder="描述该 Agent 的职责和能力..."
                rows={3}
                className="w-full resize-y bg-[var(--glass-light)] border border-[var(--glass-border)] rounded-lg px-3 py-2 text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-muted)] transition-all leading-relaxed"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setIsEditingDesc(false)} className="text-[11px] text-[var(--text-muted)] px-3 py-1 rounded-lg hover:bg-[var(--bg-hover)]">取消</button>
                <button onClick={saveDescription} className="text-[11px] text-white bg-[var(--accent)] px-3 py-1 rounded-lg hover:opacity-90">保存</button>
              </div>
            </div>
          ) : (
            <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed">
              {agent.description || "暂无描述"}
            </p>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="card-glow glass-reflect rounded-xl p-3 text-center">
            <div className="text-[14px] font-semibold font-heading text-[var(--text-primary)] tabular-nums">{agent.config.model.split("-").slice(0, 2).join("-")}</div>
            <div className="text-[9px] text-[var(--text-muted)] mt-1">模型</div>
          </div>
          <div className="card-glow glass-reflect rounded-xl p-3 text-center">
            <div className="text-[14px] font-semibold font-heading text-[var(--text-primary)] tabular-nums">¥{agent.config.monthlyBudget}</div>
            <div className="text-[9px] text-[var(--text-muted)] mt-1">月度预算</div>
          </div>
          <div className="card-glow glass-reflect rounded-xl p-3 text-center">
            <div className="text-[14px] font-semibold font-heading text-[var(--text-primary)] tabular-nums">{usagePercent}%</div>
            <div className="text-[9px] text-[var(--text-muted)] mt-1">预算使用</div>
          </div>
        </div>

        {/* Capabilities */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[12px] font-medium text-[var(--text-secondary)]">能力标签</label>
            <a
              href="https://skillhub.cn/install/skillhub.md"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-[var(--accent)] hover:underline flex items-center gap-1"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M5 1V9M1 5H9"/></svg>
              SkillHub 商店
            </a>
          </div>

          {/* Current capabilities */}
          {agent.capabilities.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {agent.capabilities.map((cap) => (
                <span
                  key={cap.name}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[var(--accent)] text-white"
                >
                  {cap.name}
                  <button
                    onClick={() => removeCapability(cap.name)}
                    className="hover:opacity-70 transition-opacity"
                  >
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M1 1L7 7M7 1L1 7" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Add from preset */}
          <div className="flex flex-wrap gap-1.5">
            {PRESET_CAPABILITIES.filter((c) => !currentCapNames.has(c.name)).map((cap) => (
              <button
                key={cap.name}
                onClick={() => toggleCapability(cap.name)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[var(--glass-light)] border border-[var(--glass-border)] text-[var(--text-secondary)] hover:border-[var(--accent)] transition-all"
              >
                + {cap.name}
              </button>
            ))}
          </div>

          {/* Custom capability input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={customCapInput}
              onChange={(e) => setCustomCapInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomCapability(); } }}
              placeholder="自定义能力标签..."
              className="flex-1 bg-[var(--glass-light)] border border-[var(--glass-border)] rounded-lg px-3 py-1.5 text-[11px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-all"
            />
            <button
              onClick={addCustomCapability}
              disabled={!customCapInput.trim()}
              className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              添加
            </button>
          </div>
        </div>

        {/* Danger zone */}
        <div className="pt-3 border-t border-[var(--glass-border)]">
          <button
            onClick={() => { deleteAgent(agentId); onClose(); }}
            className="text-[11px] text-[var(--error)] hover:underline"
          >
            删除此 Agent
          </button>
        </div>
      </div>
    </div>
  );
}
