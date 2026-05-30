"use client";

/**
 * CreateAgentPanel - 创建 Agent 结构化表单 (ORG-01)
 *
 * 提供表单填写 Agent 名称、角色、上级、模型、能力标签、月度预算等。
 * 支持从 /new_agent 斜杠命令或空状态页面触发。
 */

import { useState } from "react";
import { useAppStore } from "@/stores/appStore";
import type { AppState } from "@/stores/appStore";
import type { AgentRole, AgentCapability } from "@/types";
import { PRESET_CAPABILITIES } from "@/lib/capability/CapabilityMatcher";

interface CreateAgentPanelProps {
  onClose: () => void;
  /** 初始名称（从 /new_agent 命令参数预填） */
  initialName?: string;
}

const MODEL_OPTIONS = [
  { value: "deepseek-v4-flash", label: "DeepSeek V4 Flash" },
  { value: "deepseek-v3", label: "DeepSeek V3" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "claude-3-haiku", label: "Claude 3 Haiku" },
  { value: "claude-3-sonnet", label: "Claude 3 Sonnet" },
  { value: "qwen-turbo", label: "Qwen Turbo" },
];

export function CreateAgentPanel({ onClose, initialName = "" }: CreateAgentPanelProps) {
  const agents = useAppStore((s: AppState) => s.agents);
  const createAgent = useAppStore((s: AppState) => s.createAgent);
  const createChat = useAppStore((s: AppState) => s.createChat);
  const setActiveChat = useAppStore((s: AppState) => s.setActiveChat);
  const sendMessage = useAppStore((s: AppState) => s.sendMessage);

  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState("");
  const [role, setRole] = useState<AgentRole>("specialist");
  const [parentId, setParentId] = useState<string>("");
  const [model, setModel] = useState("deepseek-v4-flash");
  const [monthlyBudget, setMonthlyBudget] = useState("10");
  const [selectedCapabilities, setSelectedCapabilities] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");

  const agentList = Object.values(agents);
  const supervisors = agentList.filter((a) => a.role === "supervisor");

  const toggleCapability = (capName: string) => {
    setSelectedCapabilities((prev) => {
      const next = new Set(prev);
      if (next.has(capName)) next.delete(capName);
      else next.add(capName);
      return next;
    });
  };

  const handleSubmit = async () => {
    setError("");
    if (!name.trim()) {
      setError("请输入 Agent 名称");
      return;
    }

    const capabilities: AgentCapability[] = Array.from(selectedCapabilities).map((capName) => {
      const preset = PRESET_CAPABILITIES.find((c) => c.name === capName);
      return preset || { name: capName, description: capName };
    });

    const config: Record<string, unknown> = { model };
    const budget = parseFloat(monthlyBudget);
    if (!isNaN(budget) && budget > 0) config.monthlyBudget = budget;

    try {
      const result = await createAgent(name.trim(), role, parentId || null, capabilities, config, description.trim());

      if ("error" in result) {
        setError(result.error || "创建失败");
        return;
      }

      // 自动创建单聊
      const chat = createChat("direct", result.name, [
        { id: "user", name: "你", avatar: "user", role: "owner" },
        { id: result.id, name: result.name, avatar: result.avatar, role: "member" },
      ]);

      // 发送欢迎消息
      const capStr = capabilities.length > 0 ? `，能力: ${capabilities.map((c) => c.name).join("、")}` : "";
      sendMessage(chat.id, "system", "system", `已创建${role === "supervisor" ? "主管" : "专员"} Agent「${result.name}」，模型 ${model}${capStr}`);

      setActiveChat(chat.id);

      // Agent已通过API创建，无需额外同步
      console.log('✅ [Agent创建] 完成', { agentId: result.id, agentName: result.name });

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-medium rounded-xl p-6 w-[480px] max-h-[85vh] overflow-y-auto space-y-5 animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold font-heading text-[var(--text-primary)]">
            创建 Agent
          </h2>
          <button onClick={onClose} className="btn-ghost text-[var(--text-muted)]">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M3 3L11 11M11 3L3 11" />
            </svg>
          </button>
        </div>

        {/* Name */}
        <div className="space-y-2">
          <label className="text-[12px] font-medium text-[var(--text-secondary)]">名称 <span className="text-[var(--error)]">*</span></label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="如：营销主管"
            className="input-base"
            autoFocus
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <label className="text-[12px] font-medium text-[var(--text-secondary)]">描述</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="描述该 Agent 的职责和能力..."
            rows={2}
            className="w-full resize-y bg-[var(--glass-light)] border border-[var(--glass-border)] rounded-lg px-3 py-2 text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-muted)] transition-all leading-relaxed"
          />
        </div>

        {/* Role */}
        <div className="space-y-2">
          <label className="text-[12px] font-medium text-[var(--text-secondary)]">角色</label>
          <div className="flex gap-3">
            <button
              onClick={() => setRole("supervisor")}
              className={`flex-1 py-2 rounded-lg text-[12px] font-medium transition-all ${
                role === "supervisor"
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--glass-light)] border border-[var(--glass-border)] text-[var(--text-secondary)] hover:border-[var(--accent)]"
              }`}
            >
              主管
            </button>
            <button
              onClick={() => setRole("specialist")}
              className={`flex-1 py-2 rounded-lg text-[12px] font-medium transition-all ${
                role === "specialist"
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--glass-light)] border border-[var(--glass-border)] text-[var(--text-secondary)] hover:border-[var(--accent)]"
              }`}
            >
              专员
            </button>
          </div>
        </div>

        {/* Parent (上级) */}
        <div className="space-y-2">
          <label className="text-[12px] font-medium text-[var(--text-secondary)]">上级 Agent</label>
          <select
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            className="w-full text-[12px] px-2.5 py-2 rounded-lg bg-[var(--glass-light)] border border-[var(--glass-border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
          >
            <option value="">无（顶层 Agent）</option>
            {supervisors.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* Model */}
        <div className="space-y-2">
          <label className="text-[12px] font-medium text-[var(--text-secondary)]">模型</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full text-[12px] px-2.5 py-2 rounded-lg bg-[var(--glass-light)] border border-[var(--glass-border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
          >
            {MODEL_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* Monthly Budget */}
        <div className="space-y-2">
          <label className="text-[12px] font-medium text-[var(--text-secondary)]">月度预算 (CNY)</label>
          <input
            type="number"
            value={monthlyBudget}
            onChange={(e) => setMonthlyBudget(e.target.value)}
            min="0"
            step="1"
            className="input-base mb-1"
          />
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
          <div className="flex flex-wrap gap-2">
            {PRESET_CAPABILITIES.map((cap) => (
              <button
                key={cap.name}
                onClick={() => toggleCapability(cap.name)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                  selectedCapabilities.has(cap.name)
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[var(--glass-light)] border border-[var(--glass-border)] text-[var(--text-secondary)] hover:border-[var(--accent)]"
                }`}
              >
                {cap.name}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="text-[11px] text-[var(--error)] bg-[var(--error-muted)] px-3 py-2 rounded-lg">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--glass-border)]">
          <button onClick={onClose} className="btn-ghost text-[12px] px-4 py-2">
            取消
          </button>
          <button onClick={handleSubmit} className="btn-cta text-[12px] px-5 py-2 rounded-xl">
            创建
          </button>
        </div>
      </div>
    </div>
  );
}
