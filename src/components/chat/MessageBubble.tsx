"use client";

import { useState } from "react";
import { useAppStore } from "@/stores/appStore";
import { IconUser, IconBot, renderAvatarIcon } from "@/components/common/Icons";
import type { Message, TaskCard, ReportCard, BudgetAlert, HeartbeatAlert, ProgressData, FileData, ImageData } from "@/types";

export function MessageBubble({ message, onReply }: { message: Message; onReply?: (messageId: string) => void }) {
  const isUser = message.senderId === "user";
  const isSystem = message.senderId === "system";
  const resolveReportCard = useAppStore((s) => s.resolveReportCard);
  const agents = useAppStore((s) => s.agents);
  const senderName = isUser ? "你" : isSystem ? "系统" : agents[message.senderId]?.name || "未知";

  if (isSystem) {
    return (
      <div className="flex justify-center py-2 animate-fade-in">
        <span className="text-[11px] text-[var(--text-muted)] glass px-3 py-1 rounded-full">{message.content}</span>
      </div>
    );
  }

  return (
    <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : ""} py-1.5 animate-fade-in group/msg`}>
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[12px] flex-shrink-0 ${
        isUser ? "bg-[var(--cta-muted)] border border-[var(--cta)] border-opacity-30" : "glass glass-reflect"
      }`}>
        {isUser ? <IconUser size={12} /> : renderAvatarIcon(agents[message.senderId]?.avatar || "bot", 12)}
      </div>
      <div className={`max-w-[72%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
        <span className="text-[10px] text-[var(--text-muted)] px-0.5">{senderName} · {formatTime(message.timestamp)}</span>
        <div className={`rounded-2xl ${
          isUser ? "glass-medium border border-[var(--cta)] border-opacity-20" : "card-glow"
        }`}>
          <div className="px-3.5 py-2.5">
            {message.type === "text" && <p className="text-[13px] text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">{message.content}</p>}
            {message.type === "task_card" && message.taskCard && <TaskCardView card={message.taskCard} />}
            {message.type === "report_card" && message.reportCard && <ReportCardView card={message.reportCard} chatId={message.chatId} messageId={message.id} onResolve={resolveReportCard} />}
            {message.type === "budget_alert" && message.budgetAlert && <BudgetAlertView alert={message.budgetAlert} />}
            {message.type === "heartbeat_alert" && message.heartbeatAlert && <HeartbeatAlertView alert={message.heartbeatAlert} />}
            {message.type === "progress" && message.progressData && <ProgressView data={message.progressData} />}
            {message.type === "file" && message.fileData && <FileView data={message.fileData} />}
            {message.type === "image" && message.imageData && <ImageView data={message.imageData} />}
          </div>
        </div>
        {/* UI-04: 回复按钮 */}
        {onReply && !isSystem && (
          <button
            onClick={() => onReply(message.id)}
            className="text-[9px] text-[var(--text-faint)] hover:text-[var(--text-muted)] transition-colors opacity-0 group-hover/msg:opacity-100 px-0.5"
          >
            回复
          </button>
        )}
      </div>
    </div>
  );
}

function TaskCardView({ card }: { card: TaskCard }) {
  const [expanded, setExpanded] = useState(false);
  const tasks = useAppStore((s) => s.tasks);
  const agents = useAppStore((s) => s.agents);
  const cfg: Record<string, { color: string; bg: string; label: string }> = {
    pending: { color: "var(--text-muted)", bg: "var(--bg-hover)", label: "待处理" },
    in_progress: { color: "var(--accent)", bg: "var(--accent-muted)", label: "进行中" },
    completed: { color: "var(--cta)", bg: "var(--cta-muted)", label: "已完成" },
    failed: { color: "var(--danger)", bg: "var(--danger-muted)", label: "失败" },
    cancelled: { color: "var(--text-muted)", bg: "var(--bg-hover)", label: "已取消" },
  };
  const s = cfg[card.status] || cfg.pending;
  // TDN-03: 查找关联任务的子任务树
  const task = tasks[card.taskId];
  const subTasks = task?.subTasks || [];

  return (
    <div className="space-y-2.5 min-w-[200px]">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded bg-[var(--accent-muted)] flex items-center justify-center">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="var(--accent)" strokeWidth="1.2"><rect x="1" y="1" width="8" height="8" rx="1"/><path d="M3 5L4.5 6.5L7 3.5"/></svg>
        </div>
        <span className="text-[12px] font-semibold font-heading text-[var(--text-primary)]">{card.title}</span>
        <span className="text-[9px] font-medium px-1.5 py-[2px] rounded-md" style={{ color: s.color, background: s.bg }}>{s.label}</span>
      </div>
      <div className="text-[11px] text-[var(--text-secondary)]">{card.assigneeName}{card.deadline && <span className="text-[var(--text-muted)]"> · {new Date(card.deadline).toLocaleDateString()}</span>}</div>
      <div className="progress-track"><div className="progress-fill progress-accent" style={{ width: `${card.progress}%` }} /></div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[var(--text-muted)] tabular-nums">{card.completedSubTaskCount}/{card.subTaskCount} 子任务</span>
        {/* TDN-03: 展开子任务树按钮 */}
        {subTasks.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[9px] text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
          >
            {expanded ? "收起" : "查看拆解"}
          </button>
        )}
      </div>
      {/* TDN-03: 子任务树形图 */}
      {expanded && subTasks.length > 0 && (
        <div className="mt-1.5 space-y-1 glass rounded-lg p-2.5">
          {subTasks.map((sub, i) => {
            const subCfg = cfg[sub.status] || cfg.pending;
            const assignee = agents[sub.assigneeId];
            return (
              <div key={sub.id} className="flex items-center gap-2">
                <div className="w-px h-3 bg-[var(--border)]" />
                <span className="text-[9px] text-[var(--text-faint)] tabular-nums">{i + 1}</span>
                <span className="text-[10px] text-[var(--text-primary)] flex-1 truncate">{sub.title}</span>
                {assignee && <span className="text-[9px] text-[var(--text-muted)]">{assignee.name}</span>}
                <span className="text-[8px] font-medium px-1 py-[1px] rounded" style={{ color: subCfg.color, background: subCfg.bg }}>{subCfg.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ReportCardView({ card, chatId, messageId, onResolve }: { card: ReportCard; chatId: string; messageId: string; onResolve: (chatId: string, messageId: string, optionId: string) => void; }) {
  return (
    <div className="space-y-3 min-w-[220px]">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded bg-[var(--warning-muted)] flex items-center justify-center">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="var(--warning)" strokeWidth="1.3"><path d="M5 2V5.5"/><circle cx="5" cy="7.5" r="0.5" fill="var(--warning)"/><path d="M5 1L9 8.5H1L5 1Z"/></svg>
        </div>
        <span className="text-[12px] font-semibold font-heading text-[var(--warning)]">{card.title}</span>
        {card.resolved && <span className="text-[9px] font-medium text-[var(--cta)] bg-[var(--cta-muted)] px-1.5 py-[2px] rounded-md">已决策</span>}
      </div>
      <p className="text-[12px] text-[var(--text-primary)] leading-relaxed">{card.problem}</p>
      {card.attemptedSolutions && <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">已尝试: {card.attemptedSolutions}</p>}
      <div className="flex flex-wrap gap-1.5 pt-0.5">
        {card.options.map((opt) => (
          <button key={opt.id} onClick={() => !card.resolved && onResolve(chatId, messageId, opt.id)} disabled={card.resolved} className={`btn-decision ${opt.selected ? "selected" : ""}`}>{opt.label}</button>
        ))}
      </div>
    </div>
  );
}

function BudgetAlertView({ alert }: { alert: BudgetAlert }) {
  const pct = Math.round(alert.usagePercent * 100);
  const isCritical = alert.usagePercent >= 0.9;
  return (
    <div className="space-y-3 min-w-[220px]">
      <div className="flex items-center gap-2">
        <div className={`w-4 h-4 rounded flex items-center justify-center ${isCritical ? "bg-[var(--danger-muted)]" : "bg-[var(--warning-muted)]"}`}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke={isCritical ? "var(--danger)" : "var(--warning)"} strokeWidth="1.2"><circle cx="5" cy="5" r="3.5"/><text x="5" y="6.5" textAnchor="middle" fontSize="5" fill={isCritical ? "var(--danger)" : "var(--warning)"}>$</text></svg>
        </div>
        <span className={`text-[12px] font-semibold font-heading ${isCritical ? "text-[var(--danger)]" : "text-[var(--warning)]"}`}>预算告警</span>
      </div>
      <p className="text-[12px] text-[var(--text-primary)] leading-relaxed">{alert.agentName} 本月已用 {pct}%（${alert.budgetUsed.toFixed(2)} / ${alert.budgetTotal.toFixed(2)}）</p>
      <div className="progress-track"><div className={`progress-fill ${isCritical ? "progress-danger" : "progress-warning"}`} style={{ width: `${Math.min(pct, 100)}%` }} /></div>
      <div className="flex flex-wrap gap-1.5 pt-0.5">{alert.options.map((opt) => <button key={opt.id} className="btn-decision">{opt.label}</button>)}</div>
    </div>
  );
}

function HeartbeatAlertView({ alert }: { alert: HeartbeatAlert }) {
  return (
    <div className="space-y-3 min-w-[220px]">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded bg-[var(--danger-muted)] flex items-center justify-center">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="var(--danger)" strokeWidth="1.2"><circle cx="5" cy="5" r="3.5"/><path d="M3 5H4L4.5 3L5.5 7L6.5 5H7"/></svg>
        </div>
        <span className="text-[12px] font-semibold font-heading text-[var(--danger)]">Agent 故障</span>
      </div>
      <p className="text-[12px] text-[var(--text-primary)] leading-relaxed">{alert.agentName} 因 {alert.reason} 未响应，重试 {alert.retryCount}/{alert.maxRetries} 次均失败</p>
      <p className="text-[11px] text-[var(--text-secondary)]">替代方案:</p>
      <div className="flex flex-wrap gap-1.5 pt-0.5">{alert.options.map((opt) => <button key={opt.id} className="btn-decision">{opt.label}</button>)}</div>
    </div>
  );
}

function formatTime(ts: number): string { const d = new Date(ts); return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`; }

/** 进度条视图 (UI-03) */
function ProgressView({ data }: { data: ProgressData }) {
  const pct = data.total > 0 ? Math.round((data.current / data.total) * 100) : 0;
  const unit = data.unit || "%";
  return (
    <div className="space-y-2 min-w-[200px]">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold font-heading text-[var(--text-primary)]">{data.label}</span>
        <span className="text-[11px] text-[var(--text-muted)] tabular-nums">{data.current}/{data.total}{unit !== "%" ? ` ${unit}` : ""}</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill progress-accent" style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      {unit === "%" && <span className="text-[10px] text-[var(--text-muted)] tabular-nums">{pct}%</span>}
    </div>
  );
}

/** 文件视图 (UI-03) */
function FileView({ data }: { data: FileData }) {
  const sizeStr = data.size < 1024 ? `${data.size} B`
    : data.size < 1024 * 1024 ? `${(data.size / 1024).toFixed(1)} KB`
    : `${(data.size / (1024 * 1024)).toFixed(1)} MB`;
  return (
    <div className="flex items-center gap-2.5 glass rounded-xl p-2.5 min-w-[200px]">
      <div className="w-8 h-8 rounded-lg bg-[var(--accent-muted)] flex items-center justify-center flex-shrink-0">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="var(--accent)" strokeWidth="1.2">
          <path d="M3 1H9L12 4V13H3V1Z"/><path d="M9 1V4H12"/>
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-[var(--text-primary)] truncate">{data.name}</p>
        <p className="text-[10px] text-[var(--text-muted)]">{sizeStr} · {data.mimeType}</p>
      </div>
      {data.url && (
        <a href={data.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors flex-shrink-0">
          下载
        </a>
      )}
    </div>
  );
}

/** 图片视图 (UI-03) */
function ImageView({ data }: { data: ImageData }) {
  return (
    <div className="space-y-1.5 min-w-[200px]">
      <img
        src={data.url}
        alt={data.alt || ""}
        width={data.width}
        height={data.height}
        className="rounded-xl max-w-full object-cover"
        loading="lazy"
      />
      {data.alt && <p className="text-[10px] text-[var(--text-muted)]">{data.alt}</p>}
    </div>
  );
}
