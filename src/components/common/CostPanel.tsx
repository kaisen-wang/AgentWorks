"use client";

import { useAppStore } from "@/stores/appStore";
import type { AppState } from "@/stores/appStore";
import { renderAvatarIcon } from "@/components/common/Icons";

export function CostPanel({ onClose }: { onClose: () => void }) {
  const agents = useAppStore((s: AppState) => s.agents);
  const archives = useAppStore((s: AppState) => s.archives);
  const agentCosts = Object.values(agents).map((agent) => {
    const aa = archives.filter((a) => a.agentId === agent.id);
    return { id: agent.id, name: agent.name, avatar: agent.avatar, budgetUsed: agent.config.budgetUsed, budgetTotal: agent.config.monthlyBudget, archiveCost: aa.reduce((s, a) => s + a.cost, 0), apiCalls: aa.reduce((s, a) => s + a.apiCalls, 0), usagePercent: agent.config.monthlyBudget > 0 ? (agent.config.budgetUsed / agent.config.monthlyBudget) * 100 : 0 };
  });
  const totalCost = agentCosts.reduce((s, a) => s + a.archiveCost, 0);
  const totalBudget = agentCosts.reduce((s, a) => s + a.budgetTotal, 0);
  const totalApiCalls = agentCosts.reduce((s, a) => s + a.apiCalls, 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel w-[500px] max-h-[70vh]" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between glass-reflect">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-[var(--cta-muted)] flex items-center justify-center"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="var(--cta)" strokeWidth="1.2"><rect x="1" y="3" width="10" height="7" rx="1"/><line x1="1" y1="5.5" x2="11" y2="5.5"/><line x1="4" y1="8" x2="5.5" y2="8"/></svg></div>
            <h2 className="text-[13px] font-semibold font-heading text-[var(--text-primary)]">成本统计</h2>
          </div>
          <button onClick={onClose} className="btn-ghost !px-2 !py-1"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 2L10 10M10 2L2 10"/></svg></button>
        </div>
        <div className="p-5 space-y-5">
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { value: `$${totalCost.toFixed(2)}`, label: "总费用" },
              { value: `$${totalBudget.toFixed(2)}`, label: "总预算" },
              { value: `${totalApiCalls}`, label: "API 调用" },
            ].map((item) => (
              <div key={item.label} className="card-glow glass-reflect rounded-xl p-3.5 text-center">
                <div className="text-[18px] font-semibold font-heading text-[var(--text-primary)] tabular-nums tracking-tight">{item.value}</div>
                <div className="text-[9px] font-medium text-[var(--text-muted)] uppercase tracking-wider mt-1">{item.label}</div>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <h3 className="text-[10px] font-semibold font-heading text-[var(--text-muted)] uppercase tracking-[0.08em]">各 Agent 费用</h3>
            <div className="space-y-1.5">
              {agentCosts.map((ac) => {
                const barColor = ac.usagePercent >= 90 ? "danger" : ac.usagePercent >= 70 ? "warning" : "cta";
                return (
                  <div key={ac.id} className="card-glow glass-reflect rounded-xl p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-md glass flex items-center justify-center glass-reflect">{renderAvatarIcon(ac.avatar, 10)}</div>
                        <span className="text-[12px] font-heading text-[var(--text-primary)] font-medium">{ac.name}</span>
                      </div>
                      <span className="text-[12px] text-[var(--text-primary)] tabular-nums font-semibold">${ac.archiveCost.toFixed(2)}</span>
                    </div>
                    <div className="progress-track"><div className={`progress-fill progress-${barColor}`} style={{ width: `${Math.min(ac.usagePercent, 100)}%` }} /></div>
                    <div className="flex justify-between text-[10px] text-[var(--text-muted)] tabular-nums">
                      <span>${ac.budgetUsed.toFixed(2)} / ${ac.budgetTotal.toFixed(2)}</span>
                      <span>{ac.apiCalls} 次调用</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
