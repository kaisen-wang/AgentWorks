"use client";

/**
 * RestModePanel - 休息模式配置面板 (SOLO-01)
 *
 * 配置值班主管、处理规则。
 */

import { useState } from "react";
import { useAppStore } from "@/stores/appStore";
import type { AppState } from "@/stores/appStore";
import type { AgentId } from "@/types";

interface RestModePanelProps {
  onClose: () => void;
}

export function RestModePanel({ onClose }: RestModePanelProps) {
  const restMode = useAppStore((s: AppState) => s.restMode);
  const agents = useAppStore((s: AppState) => s.agents);
  const setRestMode = useAppStore((s: AppState) => s.setRestMode);

  const [dutyAgentId, setDutyAgentId] = useState<AgentId | null>(restMode.dutyAgentId || null);
  const [newCondition, setNewCondition] = useState("always");
  const [newAction, setNewAction] = useState<"auto_execute" | "sms_summary" | "record">("record");

  const supervisors = Object.values(agents).filter((a) => a.role === "supervisor");

  const handleToggle = () => {
    setRestMode({
      enabled: !restMode.enabled,
      dutyAgentId: dutyAgentId || undefined,
      enabledAt: !restMode.enabled ? Date.now() : undefined,
      disabledAt: restMode.enabled ? Date.now() : undefined,
    });
  };

  const handleAddRule = () => {
    setRestMode({
      rules: [...restMode.rules, { condition: newCondition, action: newAction }],
    });
    setNewCondition("always");
  };

  const handleRemoveRule = (index: number) => {
    setRestMode({
      rules: restMode.rules.filter((_, i) => i !== index),
    });
  };

  const handleSetDutyAgent = () => {
    setRestMode({ dutyAgentId: dutyAgentId || undefined });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-medium rounded-xl p-5 w-[420px] max-h-[80vh] overflow-y-auto space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold font-heading text-[var(--text-primary)]">
            休息模式
          </h2>
          <button onClick={onClose} className="btn-ghost text-[var(--text-muted)]">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M3 3L11 11M11 3L3 11" />
            </svg>
          </button>
        </div>

        {/* 开关 */}
        <div className="flex items-center justify-between glass-light rounded-lg p-3">
          <div>
            <p className="text-[13px] font-medium text-[var(--text-primary)]">启用休息模式</p>
            <p className="text-[11px] text-[var(--text-muted)]">开启后，上报自动转给值班主管处理</p>
          </div>
          <button
            onClick={handleToggle}
            className={`w-10 h-5 rounded-full transition-colors ${restMode.enabled ? "bg-[var(--accent)]" : "bg-[var(--glass-border)]"}`}
          >
            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${restMode.enabled ? "translate-x-5" : "translate-x-0.5"}`} />
          </button>
        </div>

        {/* 值班主管 */}
        <div className="space-y-2">
          <label className="text-[12px] font-medium text-[var(--text-secondary)]">值班主管</label>
          <div className="flex items-center gap-2">
            <select
              value={dutyAgentId || ""}
              onChange={(e) => setDutyAgentId(e.target.value || null)}
              className="flex-1 text-[12px] px-2.5 py-1.5 rounded-lg bg-[var(--glass-light)] border border-[var(--glass-border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
            >
              <option value="">未指定</option>
              {supervisors.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <button onClick={handleSetDutyAgent} className="btn-cta text-[11px] px-3 py-1.5">
              设置
            </button>
          </div>
        </div>

        {/* 处理规则 */}
        <div className="space-y-2">
          <label className="text-[12px] font-medium text-[var(--text-secondary)]">处理规则</label>
          {restMode.rules.map((rule, i) => (
            <div key={i} className="flex items-center justify-between glass-light rounded-lg px-3 py-2">
              <div className="text-[11px]">
                <span className="text-[var(--text-muted)]">条件: </span>
                <span className="text-[var(--text-primary)]">{rule.condition}</span>
                <span className="text-[var(--text-muted)] ml-2">动作: </span>
                <span className="text-[var(--accent)]">{rule.action}</span>
              </div>
              <button onClick={() => handleRemoveRule(i)} className="text-[var(--text-muted)] hover:text-[var(--error)]">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
                  <path d="M2 2L10 10M10 2L2 10" />
                </svg>
              </button>
            </div>
          ))}

          <div className="flex items-center gap-2 pt-1">
            <input
              type="text"
              placeholder="条件（如 always, 预算）"
              value={newCondition}
              onChange={(e) => setNewCondition(e.target.value)}
              className="flex-1 text-[11px] px-2.5 py-1.5 rounded-lg bg-[var(--glass-light)] border border-[var(--glass-border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
            />
            <select
              value={newAction}
              onChange={(e) => setNewAction(e.target.value as typeof newAction)}
              className="text-[11px] px-2.5 py-1.5 rounded-lg bg-[var(--glass-light)] border border-[var(--glass-border)] text-[var(--text-primary)] focus:outline-none"
            >
              <option value="auto_execute">自动执行</option>
              <option value="sms_summary">短信摘要</option>
              <option value="record">仅记录</option>
            </select>
            <button onClick={handleAddRule} className="btn-cta text-[11px] px-3 py-1.5">
              添加
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
