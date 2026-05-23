"use client";

import { useState } from "react";
import { useAppStore } from "@/stores/appStore";
import type { AppState } from "@/stores/appStore";
import { IconGlobe, IconBuilding, IconUser } from "@/components/common/Icons";
import type { KnowledgeScope } from "@/types";

export function KnowledgePanel({ onClose }: { onClose: () => void }) {
  const knowledge = useAppStore((s: AppState) => s.knowledge);
  const addKnowledge = useAppStore((s: AppState) => s.addKnowledge);
  const [scope, setScope] = useState<KnowledgeScope>("global");
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const entries = Object.values(knowledge).filter((e) => e.scope === scope);
  const handleAdd = () => { if (!key || !value) return; addKnowledge(scope, key, value); setKey(""); setValue(""); };
  const scopeLabels: Record<KnowledgeScope, { label: string; icon: React.ReactNode }> = { global: { label: "全局", icon: <IconGlobe size={11} /> }, department: { label: "部门", icon: <IconBuilding size={11} /> }, personal: { label: "个人", icon: <IconUser size={11} /> } };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel w-[500px] max-h-[70vh]" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between glass-reflect">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-[var(--info-muted)] flex items-center justify-center"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="var(--info)" strokeWidth="1.2"><path d="M2 4L6 2L10 4L6 6L2 4Z"/><path d="M2 4V8L6 10V6"/><path d="M10 4V8L6 10V6"/></svg></div>
            <h2 className="text-[13px] font-semibold font-heading text-[var(--text-primary)]">知识库</h2>
          </div>
          <button onClick={onClose} className="btn-ghost !px-2 !py-1"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 2L10 10M10 2L2 10"/></svg></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex gap-1 p-0.5 glass rounded-lg">
            {(["global", "department", "personal"] as KnowledgeScope[]).map((s) => (
              <button key={s} onClick={() => setScope(s)}
                className={`flex-1 text-[11px] font-medium px-3 py-1.5 rounded-md transition-all duration-[150ms] flex items-center justify-center gap-1.5 ${
                  scope === s ? "glass-medium text-[var(--text-primary)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}>
                <span className="flex items-center justify-center">{scopeLabels[s].icon}</span>{scopeLabels[s].label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="键 (如 brand_color)" className="input-base text-[12px] flex-1" />
            <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="值 (如 #00FF00)" className="input-base text-[12px] flex-1" />
            <button onClick={handleAdd} disabled={!key || !value} className="btn-cta !px-3 !py-2 !text-[11px] !rounded-lg shrink-0">添加</button>
          </div>
          <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
            {entries.length === 0 ? <div className="text-center py-8"><p className="text-[11px] text-[var(--text-muted)]">暂无知识条目</p></div> :
              entries.map((entry) => (
                <div key={entry.id} className="card-glow glass-reflect flex items-center gap-2 px-3 py-2.5 rounded-lg">
                  <span className="text-[11px] text-[var(--accent)] font-mono flex-shrink-0">{entry.key}</span>
                  <span className="text-[11px] text-[var(--text-faint)]">=</span>
                  <span className="text-[11px] text-[var(--text-primary)] truncate">{entry.value}</span>
                </div>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  );
}
