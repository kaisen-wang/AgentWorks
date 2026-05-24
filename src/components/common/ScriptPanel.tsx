"use client";

/**
 * ScriptPanel - 剧本管理面板 (TDN-05)
 *
 * 查看、运行、删除剧本。
 * 支持变量替换运行。
 */

import { useState } from "react";
import { useAppStore } from "@/stores/appStore";
import type { AppState } from "@/stores/appStore";
import type { ScriptId } from "@/types";
import { workflowEngine } from "@/lib/workflow/WorkflowEngine";

interface ScriptPanelProps {
  onClose: () => void;
}

export function ScriptPanel({ onClose }: ScriptPanelProps) {
  const scripts = useAppStore((s: AppState) => s.scripts);
  const activeChatId = useAppStore((s: AppState) => s.activeChatId);
  const projects = useAppStore((s: AppState) => s.projects);
  const currentProjectId = useAppStore((s: AppState) => s.currentProjectId);
  const [runningId, setRunningId] = useState<ScriptId | null>(null);
  const [replacements, setReplacements] = useState("");
  const [message, setMessage] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(currentProjectId);

  // SOLO-06: 按项目过滤剧本
  const scriptList = Object.values(scripts).filter((s) => {
    if (!selectedProjectId) return true;
    return s.projectId === selectedProjectId;
  });

  const handleRun = async (scriptId: ScriptId) => {
    if (!activeChatId) {
      setMessage("请先选择一个聊天");
      return;
    }
    setRunningId(scriptId);
    setMessage("");
    try {
      await workflowEngine.runScript(scriptId, activeChatId, replacements || undefined);
      setMessage("剧本执行完成");
    } catch (err) {
      setMessage(`执行失败: ${err instanceof Error ? err.message : "未知错误"}`);
    } finally {
      setRunningId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-medium rounded-xl p-5 w-[480px] max-h-[80vh] overflow-y-auto space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold font-heading text-[var(--text-primary)]">
            剧本管理
          </h2>
          <button onClick={onClose} className="btn-ghost text-[var(--text-muted)]">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M3 3L11 11M11 3L3 11" />
            </svg>
          </button>
        </div>

        {/* SOLO-06: 项目筛选 */}
        {projects.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-[var(--text-muted)]">项目:</span>
            <button onClick={() => setSelectedProjectId(null)} className={`text-[10px] px-2 py-1 rounded-md transition-colors ${!selectedProjectId ? "bg-[var(--accent-muted)] text-[var(--accent)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}>全部</button>
            {projects.map((p) => (
              <button key={p.id} onClick={() => setSelectedProjectId(p.id)} className={`text-[10px] px-2 py-1 rounded-md transition-colors ${selectedProjectId === p.id ? "bg-[var(--accent-muted)] text-[var(--accent)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}>{p.name}</button>
            ))}
          </div>
        )}

        {message && (
          <div className="text-[12px] px-3 py-2 rounded-lg bg-[var(--accent-muted)] text-[var(--accent)]">
            {message}
          </div>
        )}

        {scriptList.length === 0 ? (
          <p className="text-[13px] text-[var(--text-muted)] text-center py-8">
            暂无剧本。完成任务后可使用 /save_script 保存。
          </p>
        ) : (
          <div className="space-y-3">
            {scriptList.map((script) => (
              <div key={script.id} className="glass-light rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-[13px] font-medium text-[var(--text-primary)]">{script.name}</h3>
                    <p className="text-[11px] text-[var(--text-muted)]">{script.description}</p>
                  </div>
                  <span className="text-[10px] text-[var(--text-muted)] bg-[var(--glass-light)] px-1.5 py-0.5 rounded">
                    {script.steps.length} 步
                  </span>
                </div>

                <div className="text-[11px] text-[var(--text-secondary)] space-y-0.5">
                  {script.steps.map((step, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <span className="text-[var(--text-muted)]">{i + 1}.</span>
                      <span>{step.action.slice(0, 40)}{step.action.length > 40 ? "..." : ""}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="变量替换（如：产品名为'赛博山水'）"
                    className="flex-1 text-[11px] px-2.5 py-1.5 rounded-lg bg-[var(--glass-light)] border border-[var(--glass-border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
                    value={replacements}
                    onChange={(e) => setReplacements(e.target.value)}
                  />
                  <button
                    onClick={() => handleRun(script.id)}
                    disabled={runningId === script.id}
                    className="btn-cta text-[11px] px-3 py-1.5 disabled:opacity-50"
                  >
                    {runningId === script.id ? "执行中..." : "运行"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
