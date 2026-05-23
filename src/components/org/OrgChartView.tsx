"use client";

import { useAppStore } from "@/stores/appStore";
import type { AppState } from "@/stores/appStore";
import { IconUser, renderAvatarIcon } from "@/components/common/Icons";
import type { Agent, AgentId } from "@/types";

export function OrgChartView({ onClose }: { onClose: () => void }) {
  const agents = useAppStore((s: AppState) => s.agents);
  const rootAgents = Object.values(agents).filter((a) => a.parentId === null);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel w-[680px] max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between glass-reflect">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-[var(--accent-muted)] flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="var(--accent)" strokeWidth="1.2"><circle cx="6" cy="3" r="1.5"/><circle cx="2.5" cy="9" r="1.5"/><circle cx="9.5" cy="9" r="1.5"/><line x1="6" y1="4.5" x2="2.5" y2="7.5"/><line x1="6" y1="4.5" x2="9.5" y2="7.5"/></svg>
            </div>
            <h2 className="text-[13px] font-semibold font-heading text-[var(--text-primary)]">组织架构图</h2>
          </div>
          <button onClick={onClose} className="btn-ghost !px-2 !py-1"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 2L10 10M10 2L2 10"/></svg></button>
        </div>
        <div className="p-8 overflow-y-auto max-h-[60vh]">
          {rootAgents.length === 0 ? (
            <div className="text-center py-16"><div className="w-10 h-10 rounded-xl glass flex items-center justify-center mx-auto mb-3 glass-reflect"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="var(--text-faint)" strokeWidth="1.2"><circle cx="9" cy="5" r="2.5"/><path d="M4 15C4 12 6.5 10 9 10C11.5 10 14 12 14 15"/></svg></div><p className="text-[12px] text-[var(--text-muted)]">暂无 Agent</p></div>
          ) : (
            <div className="flex flex-col items-center gap-8">
              <OrgNode name="老板（你）" avatar="user" role="owner" status="idle" />
              {rootAgents.map((agent) => (
                <div key={agent.id} className="flex flex-col items-center">
                  <div className="w-px h-5 bg-gradient-to-b from-[var(--accent)] from-opacity-30 to-[var(--border)]" />
                  <TreeLevel agent={agent} allAgents={agents} depth={0} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TreeLevel({ agent, allAgents, depth }: { agent: Agent; allAgents: Record<AgentId, Agent>; depth: number }) {
  const children = agent.childIds.map((id) => allAgents[id]).filter(Boolean);
  const usagePercent = agent.maxChildren > 0 ? Math.round((agent.childIds.length / agent.maxChildren) * 100) : 0;
  return (
    <div className="flex flex-col items-center">
      <OrgNode name={agent.name} avatar={agent.avatar} role={agent.role} status={agent.status} meta={`${agent.childIds.length}/${agent.maxChildren}`} metaWarning={usagePercent >= 80} />
      {children.length > 0 && (<><div className="w-px h-5 bg-[var(--border)]" /><div className="flex items-start gap-6">{children.map((child) => (<div key={child.id} className="flex flex-col items-center"><div className="w-px h-3 bg-[var(--border)]" /><TreeLevel agent={child} allAgents={allAgents} depth={depth + 1} /></div>))}</div></>)}
    </div>
  );
}

function OrgNode({ name, avatar, role, status, meta, metaWarning }: { name: string; avatar: string; role: string; status: string; meta?: string; metaWarning?: boolean; }) {
  return (
    <div className={`relative px-4 py-3 rounded-xl transition-all duration-[200ms] ${
      role === "owner" ? "glass-medium border border-[var(--accent)] border-opacity-30 shadow-[0_0_20px_var(--accent-bloom)]" : "card-glow glass-reflect"
    }`}>
      <div className="flex items-center gap-2.5">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${role === "owner" ? "bg-[var(--accent-muted)]" : "glass"}`}>{renderAvatarIcon(avatar, 14)}</div>
        <span className="text-[12px] font-medium font-heading text-[var(--text-primary)]">{name}</span>
        {meta && <span className={`text-[9px] tabular-nums font-medium px-1.5 py-[2px] rounded-md ${metaWarning ? "text-[var(--warning)] bg-[var(--warning-muted)]" : "text-[var(--text-muted)] glass"}`}>{meta}</span>}
      </div>
      {role !== "owner" && <div className={`status-dot status-${status} absolute -top-1 -right-1 ring-2 ring-[var(--bg-canvas)]`} />}
    </div>
  );
}
