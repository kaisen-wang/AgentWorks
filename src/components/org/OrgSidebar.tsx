"use client";

import { useAppStore } from "@/stores/appStore";
import type { AppState } from "@/stores/appStore";
import { IconGroupChat, IconUser, renderAvatarIcon } from "@/components/common/Icons";
import type { Agent, AgentId } from "@/types";

/** 组织架构侧边栏 */
export function OrgSidebar() {
  const agents = useAppStore((s: AppState) => s.agents);
  const activeChatId = useAppStore((s: AppState) => s.activeChatId);
  const chats = useAppStore((s: AppState) => s.chats);
  const setActiveChat = useAppStore((s: AppState) => s.setActiveChat);

  const rootAgents = Object.values(agents).filter((a) => a.parentId === null);
  const chatList = Object.values(chats)
    .sort((a, b) => (b.lastMessageTime || b.createdAt) - (a.lastMessageTime || a.createdAt));

  return (
    <div className="flex flex-col h-full">
      {/* Org header */}
      <div className="px-4 py-3 border-b border-[var(--border)]">
        <div className="flex items-center justify-between">
          <h2 className="text-[10px] font-semibold font-heading uppercase tracking-[0.08em] text-[var(--text-muted)]">
            组织架构
          </h2>
          {rootAgents.length > 0 && (
            <span className="text-[10px] text-[var(--text-faint)] tabular-nums">{Object.keys(agents).length}</span>
          )}
        </div>
      </div>

      {/* Agent Tree */}
      <div className="flex-1 overflow-y-auto py-2 px-1 min-h-0">
        {rootAgents.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <div className="w-9 h-9 rounded-xl glass flex items-center justify-center mx-auto mb-2.5 glass-reflect">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--text-faint)" strokeWidth="1.2">
                <circle cx="8" cy="5" r="2.5"/><path d="M3 14C3 11 5.5 9 8 9C10.5 9 13 11 13 14"/>
              </svg>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              暂无 Agent<br />
              <code className="text-[var(--accent)] font-mono">/new_agent</code> 创建
            </p>
          </div>
        ) : (
          <div className="stagger">
            {rootAgents.map((agent) => (
              <AgentTreeNode key={agent.id} agent={agent} allAgents={agents} depth={0} />
            ))}
          </div>
        )}
      </div>

      {/* Chats section */}
      <div className="border-t border-[var(--border)] flex flex-col min-h-[100px] max-h-[45%]">
        <div className="px-4 py-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-semibold font-heading uppercase tracking-[0.08em] text-[var(--text-muted)]">
              会话
            </h2>
            {chatList.length > 0 && (
              <span className="text-[10px] text-[var(--text-faint)] tabular-nums">{chatList.length}</span>
            )}
          </div>
        </div>
        <div className="overflow-y-auto flex-1 pb-3 px-1">
          {chatList.length === 0 ? (
            <div className="px-4 py-4 text-center text-[11px] text-[var(--text-muted)]">暂无会话</div>
          ) : (
            <div className="stagger">
              {chatList.map((chat) => {
                const isActive = activeChatId === chat.id;
                return (
                  <button
                    key={chat.id}
                    onClick={() => setActiveChat(chat.id)}
                    className={`w-full px-3 py-2.5 text-left flex items-center gap-2.5 rounded-xl transition-all duration-[150ms] ${
                      isActive
                        ? "glass-medium border border-[var(--accent)] border-opacity-40"
                        : "border border-transparent hover:bg-[var(--bg-hover)]"
                    }`}
                  >
                    <span className={`flex-shrink-0 ${isActive ? "opacity-100" : "opacity-60"}`}>
                      {chat.type === "group" ? <IconGroupChat size={13} /> : <IconUser size={13} />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className={`text-[12px] truncate leading-tight ${
                        isActive ? "text-[var(--text-primary)] font-medium" : "text-[var(--text-secondary)]"
                      }`}>
                        {chat.name}
                      </div>
                      {chat.lastMessage && (
                        <div className="text-[10px] text-[var(--text-muted)] truncate mt-0.5 leading-tight">
                          {chat.lastMessage}
                        </div>
                      )}
                    </div>
                    {chat.lastMessageTime && (
                      <span className="text-[9px] text-[var(--text-faint)] tabular-nums flex-shrink-0">
                        {formatRelativeTime(chat.lastMessageTime)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AgentTreeNode({ agent, allAgents, depth }: { agent: Agent; allAgents: Record<AgentId, Agent>; depth: number }) {
  const openAgentDetail = useAppStore((s: AppState) => s.openAgentDetail);
  const children = agent.childIds.map((id) => allAgents[id]).filter(Boolean);
  const usagePercent = agent.maxChildren > 0 ? Math.round((agent.childIds.length / agent.maxChildren) * 100) : 0;

  return (
    <div>
      <div
        onClick={() => openAgentDetail(agent.id)}
        className="group px-3 py-[7px] flex items-center gap-2 rounded-xl hover:bg-[var(--bg-hover)] transition-all duration-[120ms] cursor-pointer"
        style={{ paddingLeft: `${12 + depth * 14}px` }}
      >
        <span className={`status-dot status-${agent.status}`} />
        <div className="w-5 h-5 rounded-md glass flex items-center justify-center flex-shrink-0 glass-reflect">
          {renderAvatarIcon(agent.avatar, 10)}
        </div>
        <span className="text-[12px] text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] flex-1 truncate transition-colors leading-tight">
          {agent.name}
        </span>
        {agent.role === "supervisor" && (
          <span className={`text-[9px] tabular-nums font-medium ${
            usagePercent >= 80 ? "text-[var(--warning)]" : "text-[var(--text-faint)]"
          }`}>
            {agent.childIds.length}/{agent.maxChildren}
          </span>
        )}
      </div>
      {children.length > 0 && (
        <div className="relative">
          {depth < 2 && (
            <div className="absolute top-0 bottom-0 w-px bg-[var(--border)]" style={{ left: `${20 + depth * 14}px` }} />
          )}
          {children.map((child) => (
            <AgentTreeNode key={child.id} agent={child} allAgents={allAgents} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return "刚刚";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  return `${Math.floor(diff / 86400000)}d`;
}
