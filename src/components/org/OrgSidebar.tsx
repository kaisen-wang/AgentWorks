"use client";

import { useState } from "react";
import { useAppStore } from "@/stores/appStore";
import type { AppState } from "@/stores/appStore";
import { IconGroupChat, IconUser, renderAvatarIcon } from "@/components/common/Icons";
import type { Agent, AgentId, ChatMember } from "@/types";

/** 组织架构侧边栏 */
export function OrgSidebar() {
  const agents = useAppStore((s: AppState) => s.agents);
  const activeChatId = useAppStore((s: AppState) => s.activeChatId);
  const chats = useAppStore((s: AppState) => s.chats);
  const setActiveChat = useAppStore((s: AppState) => s.setActiveChat);
  const createChat = useAppStore((s: AppState) => s.createChat);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [chatFilter, setChatFilter] = useState<"all" | "group" | "direct">("all");

  const rootAgents = Object.values(agents).filter((a) => a.parentId === null);
  const chatList = Object.values(chats)
    .filter((c) => chatFilter === "all" || c.type === chatFilter)
    .sort((a, b) => {
      // 置顶优先
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return (b.lastMessageTime || b.createdAt) - (a.lastMessageTime || a.createdAt);
    });

  const groupCount = Object.values(chats).filter((c) => c.type === "group").length;
  const directCount = Object.values(chats).filter((c) => c.type === "direct").length;

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
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowCreateGroup(true)}
                className="text-[10px] text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
                title="新建群聊"
              >
                <IconGroupChat size={12} />
              </button>
              {chatList.length > 0 && (
                <span className="text-[10px] text-[var(--text-faint)] tabular-nums">{chatList.length}</span>
              )}
            </div>
          </div>
        </div>
        {/* 会话筛选标签 */}
        {(groupCount > 0 || directCount > 0) && (
          <div className="px-3 pb-1.5 flex gap-1 flex-shrink-0">
            {(["all", "group", "direct"] as const).map((filter) => {
              const labels = { all: "全部", group: "群聊", direct: "单聊" };
              const counts = { all: groupCount + directCount, group: groupCount, direct: directCount };
              return (
                <button
                  key={filter}
                  onClick={() => setChatFilter(filter)}
                  className={`text-[9px] px-1.5 py-0.5 rounded-md transition-all ${
                    chatFilter === filter
                      ? "bg-[var(--accent-muted)] text-[var(--accent)] font-medium"
                      : "text-[var(--text-faint)] hover:text-[var(--text-muted)]"
                  }`}
                >
                  {labels[filter]} {counts[filter]}
                </button>
              );
            })}
          </div>
        )}
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
                        {chat.pinned && (
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="var(--accent)" className="ml-1 inline-block -mt-0.5">
                            <path d="M4 0L5 3H8L5.5 5L6.5 8L4 6L1.5 8L2.5 5L0 3H3Z"/>
                          </svg>
                        )}
                        {chat.muted && (
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="var(--text-muted)" strokeWidth="1" className="ml-0.5 inline-block -mt-0.5">
                            <path d="M1 3V5H3L5 7V1L3 3H1Z"/><path d="M6.5 3L7.5 5"/>
                          </svg>
                        )}
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
                    {chat.unreadCount && chat.unreadCount > 0 && (
                      <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-[var(--accent)] text-white tabular-nums flex-shrink-0 min-w-[16px] text-center">
                        {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Create Group Chat Panel */}
      {showCreateGroup && (
        <CreateGroupPanel
          agents={agents}
          onCreate={(name, members) => {
            const chat = createChat("group", name, members);
            setActiveChat(chat.id);
            setShowCreateGroup(false);
          }}
          onClose={() => setShowCreateGroup(false)}
        />
      )}
    </div>
  );
}

function AgentTreeNode({ agent, allAgents, depth }: { agent: Agent; allAgents: Record<AgentId, Agent>; depth: number }) {
  const openAgentDetail = useAppStore((s: AppState) => s.openAgentDetail);
  const chats = useAppStore((s: AppState) => s.chats);
  const createChat = useAppStore((s: AppState) => s.createChat);
  const setActiveChat = useAppStore((s: AppState) => s.setActiveChat);
  const agents = useAppStore((s: AppState) => s.agents);

  const children = agent.childIds.map((id) => allAgents[id]).filter(Boolean);
  const usagePercent = agent.maxChildren > 0 ? Math.round((agent.childIds.length / agent.maxChildren) * 100) : 0;

  // 点击Agent时，切换到与该Agent的对话
  const handleClick = () => {
    // 查找是否已存在与该Agent的单聊
    const existingChat = Object.values(chats).find(
      (chat) =>
        chat.type === "direct" &&
        chat.members.some((m) => m.id === agent.id)
    );

    if (existingChat) {
      // 如果已存在，直接切换到该对话
      setActiveChat(existingChat.id);
    } else {
      // 如果不存在，创建新的单聊
      const newChat = createChat("direct", agent.name, [
        { id: "user", name: "你", avatar: "user", role: "owner" },
        { id: agent.id, name: agent.name, avatar: agent.avatar, role: "member" },
      ]);
      setActiveChat(newChat.id);
    }
  };

  // 右键点击时，打开Agent详情
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    openAgentDetail(agent.id);
  };

  return (
    <div>
      <div
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        className="group px-3 py-[7px] flex items-center gap-2 rounded-xl hover:bg-[var(--bg-hover)] transition-all duration-[120ms] cursor-pointer"
        style={{ paddingLeft: `${12 + depth * 14}px` }}
        title="点击切换对话，右键查看详情"
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

/** 创建群聊面板 */
function CreateGroupPanel({
  agents,
  onCreate,
  onClose,
}: {
  agents: Record<AgentId, Agent>;
  onCreate: (name: string, members: ChatMember[]) => void;
  onClose: () => void;
}) {
  const [groupName, setGroupName] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<AgentId>>(new Set());

  const allAgents = Object.values(agents);

  const toggleAgent = (id: AgentId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = () => {
    if (!groupName.trim() || selectedIds.size === 0) return;
    const members: ChatMember[] = [
      { id: "user", name: "你", avatar: "user", role: "owner" },
      ...Array.from(selectedIds).map((id) => {
        const agent = agents[id];
        return { id: agent.id, name: agent.name, avatar: agent.avatar, role: "member" as const };
      }),
    ];
    onCreate(groupName.trim(), members);
  };

  return (
    <div className="absolute inset-0 z-10 glass-strong flex flex-col">
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
        <h3 className="text-[11px] font-semibold font-heading text-[var(--text-primary)]">新建群聊</h3>
        <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-[12px]">
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <div>
          <label className="text-[10px] text-[var(--text-muted)] block mb-1">群聊名称</label>
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="输入群聊名称"
            className="w-full px-2.5 py-1.5 text-[12px] glass rounded-lg border border-[var(--border)] focus:border-[var(--accent)] outline-none bg-transparent text-[var(--text-primary)]"
          />
        </div>
        <div>
          <label className="text-[10px] text-[var(--text-muted)] block mb-1">
            选择成员 <span className="text-[var(--text-faint)]">({selectedIds.size} 已选)</span>
          </label>
          <div className="space-y-1 max-h-[200px] overflow-y-auto">
            {allAgents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => toggleAgent(agent.id)}
                className={`w-full px-2.5 py-1.5 text-left flex items-center gap-2 rounded-lg transition-all text-[12px] ${
                  selectedIds.has(agent.id)
                    ? "glass-medium border border-[var(--accent)] border-opacity-40"
                    : "border border-transparent hover:bg-[var(--bg-hover)]"
                }`}
              >
                <div className="w-4 h-4 rounded glass flex items-center justify-center flex-shrink-0">
                  {renderAvatarIcon(agent.avatar, 8)}
                </div>
                <span className="text-[var(--text-secondary)] truncate">{agent.name}</span>
                <span className="text-[9px] text-[var(--text-faint)] ml-auto">{agent.role}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="p-3 border-t border-[var(--border)]">
        <button
          onClick={handleCreate}
          disabled={!groupName.trim() || selectedIds.size === 0}
          className="w-full py-2 text-[11px] font-medium rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]"
        >
          创建群聊
        </button>
      </div>
    </div>
  );
}
