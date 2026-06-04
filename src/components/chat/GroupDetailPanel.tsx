"use client";

import { useState, useMemo } from "react";
import { useAppStore } from "@/stores/appStore";
import type { AppState } from "@/stores/appStore";
import { renderAvatarIcon } from "@/components/common/Icons";
import * as chatActions from "@/actions/chat";
import type { ChatId, ChatMember, AgentId } from "@/types";

const ROLE_LABELS: Record<string, string> = {
  owner: "群主",
  member: "成员",
  readonly: "只读",
  external: "外部",
};

/**
 * 群聊详情面板 - 成员管理 + 群聊信息
 */
export function GroupDetailPanel({ chatId, onClose }: { chatId: ChatId; onClose: () => void }) {
  const chat = useAppStore((s: AppState) => s.chats[chatId]);
  const agents = useAppStore((s: AppState) => s.agents);
  const addMemberToChat = useAppStore((s: AppState) => s.addMemberToChat);
  const removeMemberFromChat = useAppStore((s: AppState) => s.removeMemberFromChat);
  const updateMemberRole = useAppStore((s: AppState) => s.updateMemberRole);
  const [showAddMember, setShowAddMember] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState(chat?.description || "");
  const [editingAnn, setEditingAnn] = useState(false);
  const [annValue, setAnnValue] = useState(chat?.announcement || "");
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(chat?.name || "");

  if (!chat || chat.type !== "group") return null;

  // 不在群中的 Agent（可添加）
  const memberIds = new Set(chat.members.map((m) => m.id));
  const availableAgents = Object.values(agents).filter((a) => !memberIds.has(a.id));

  const handleAddMember = (agentId: AgentId) => {
    const agent = agents[agentId];
    if (!agent) return;
    addMemberToChat(chatId, {
      id: agent.id,
      name: agent.name,
      avatar: agent.avatar,
      role: "member",
    });
  };

  const handleRemoveMember = (memberId: string) => {
    // 不允许移除群主
    const member = chat.members.find((m) => m.id === memberId);
    if (!member || member.role === "owner") return;
    removeMemberFromChat(chatId, memberId);
  };

  const handleChangeRole = (memberId: string, newRole: ChatMember["role"]) => {
    updateMemberRole(chatId, memberId, newRole);
  };

  return (
    <div className="absolute inset-0 z-20 glass-strong flex flex-col animate-fade-in">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between flex-shrink-0">
        <h3 className="text-[12px] font-semibold font-heading text-[var(--text-primary)]">群聊详情</h3>
        <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-[14px] leading-none">
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 群聊信息 */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg glass-medium border border-[var(--accent)] border-opacity-30 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--accent)" strokeWidth="1.2">
                <path d="M2 5.5C2 3.5 3.5 2 5.5 2H10.5C12.5 2 14 3.5 14 5.5V8C14 10 12.5 11.5 10.5 11.5H6L3 14V11.5C2 11.5 2 10 2 8V5.5Z"/>
              </svg>
            </div>
            <div>
              {editingName ? (
                <div className="flex gap-1.5 items-center">
                  <input
                    value={nameValue}
                    onChange={(e) => setNameValue(e.target.value)}
                    className="px-2 py-0.5 text-[13px] font-medium glass rounded-md border border-[var(--border)] focus:border-[var(--accent)] outline-none bg-transparent text-[var(--text-primary)]"
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      if (nameValue.trim()) {
                        useAppStore.setState((s: AppState) => ({
                          chats: { ...s.chats, [chatId]: { ...s.chats[chatId], name: nameValue.trim() } },
                        }));
                        // 持久化名称修改
                        const updatedChat = useAppStore.getState().chats[chatId];
                        if (updatedChat) chatActions.updateChat(updatedChat).catch(() => {});
                      }
                      setEditingName(false);
                    }}
                    className="text-[10px] px-1.5 py-0.5 rounded-md bg-[var(--accent)] text-white"
                  >
                    保存
                  </button>
                  <button
                    onClick={() => { setNameValue(chat.name); setEditingName(false); }}
                    className="text-[10px] px-1.5 py-0.5 rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
                  >
                    取消
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditingName(true)}
                  className="text-[13px] font-medium text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors text-left"
                >
                  {chat.name}
                </button>
              )}
              <div className="text-[10px] text-[var(--text-muted)]">{chat.members.length} 个成员</div>
            </div>
          </div>
          {/* 群描述/公告 */}
          <div className="mt-2">
            {editingDesc ? (
              <div className="flex gap-1.5">
                <input
                  value={descValue}
                  onChange={(e) => setDescValue(e.target.value)}
                  placeholder="添加群描述..."
                  className="flex-1 px-2 py-1 text-[11px] glass rounded-md border border-[var(--border)] focus:border-[var(--accent)] outline-none bg-transparent text-[var(--text-primary)]"
                  autoFocus
                />
                <button
                  onClick={() => {
                    useAppStore.setState((s: AppState) => ({
                      chats: { ...s.chats, [chatId]: { ...s.chats[chatId], description: descValue } },
                    }));
                    // 持久化描述修改
                    const updatedChat = useAppStore.getState().chats[chatId];
                    if (updatedChat) chatActions.updateChat(updatedChat).catch(() => {});
                    setEditingDesc(false);
                  }}
                  className="text-[10px] px-2 py-1 rounded-md bg-[var(--accent)] text-white"
                >
                  保存
                </button>
                <button
                  onClick={() => { setDescValue(chat.description || ""); setEditingDesc(false); }}
                  className="text-[10px] px-2 py-1 rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
                >
                  取消
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditingDesc(true)}
                className="text-[11px] text-left w-full text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
              >
                {chat.description || "点击添加群描述..."}
              </button>
            )}
          </div>
          {/* 群公告 */}
          <div className="mt-2">
            <label className="text-[9px] font-semibold text-[var(--accent)] uppercase tracking-[0.06em]">公告</label>
            {editingAnn ? (
              <div className="flex gap-1.5 mt-1">
                <input
                  value={annValue}
                  onChange={(e) => setAnnValue(e.target.value)}
                  placeholder="发布群公告..."
                  className="flex-1 px-2 py-1 text-[11px] glass rounded-md border border-[var(--accent)] border-opacity-40 focus:border-[var(--accent)] outline-none bg-transparent text-[var(--text-primary)]"
                  autoFocus
                />
                <button
                  onClick={() => {
                    useAppStore.setState((s: AppState) => ({
                      chats: { ...s.chats, [chatId]: { ...s.chats[chatId], announcement: annValue, announcementAt: annValue ? Date.now() : undefined } },
                    }));
                    const updatedChat = useAppStore.getState().chats[chatId];
                    if (updatedChat) chatActions.updateChat(updatedChat).catch(() => {});
                    setEditingAnn(false);
                  }}
                  className="text-[10px] px-2 py-1 rounded-md bg-[var(--accent)] text-white"
                >
                  发布
                </button>
                <button
                  onClick={() => { setAnnValue(chat.announcement || ""); setEditingAnn(false); }}
                  className="text-[10px] px-2 py-1 rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
                >
                  取消
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditingAnn(true)}
                className="text-[11px] text-left w-full text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors mt-0.5"
              >
                {chat.announcement || "点击发布群公告..."}
              </button>
            )}
            {chat.announcementAt && (
              <span className="text-[9px] text-[var(--text-faint)] mt-0.5 block">
                发布于 {new Date(chat.announcementAt).toLocaleString("zh-CN")}
              </span>
            )}
          </div>
          {/* 关联项目 */}
          {chat.projectId && (
            <div className="mt-1.5">
              <span className="text-[9px] text-[var(--text-faint)]">关联项目: </span>
              <span className="text-[10px] text-[var(--accent)]">{chat.projectId}</span>
            </div>
          )}
          {/* 置顶 / 免打扰 */}
          <div className="mt-2 flex items-center gap-3">
            <button
              onClick={() => useAppStore.getState().toggleChatPinned(chatId)}
              className={`text-[10px] px-2 py-1 rounded-lg transition-colors ${chat.pinned ? "bg-[var(--accent-muted)] text-[var(--accent)]" : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"}`}
            >
              {chat.pinned ? "已置顶" : "置顶"}
            </button>
            <button
              onClick={() => useAppStore.getState().toggleChatMuted(chatId)}
              className={`text-[10px] px-2 py-1 rounded-lg transition-colors ${chat.muted ? "bg-[var(--accent-muted)] text-[var(--accent)]" : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"}`}
            >
              {chat.muted ? "免打扰中" : "免打扰"}
            </button>
          </div>
        </div>

        {/* 成员列表 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] font-semibold font-heading uppercase tracking-[0.08em] text-[var(--text-muted)]">
              成员
            </label>
            <button
              onClick={() => setShowAddMember(!showAddMember)}
              className="text-[10px] text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
            >
              {showAddMember ? "收起" : "+ 添加"}
            </button>
          </div>

          {/* 添加成员区域 */}
          {showAddMember && availableAgents.length > 0 && (
            <div className="mb-2 p-2 rounded-lg glass border border-[var(--border)]">
              <div className="text-[10px] text-[var(--text-muted)] mb-1.5">可添加的 Agent</div>
              <div className="space-y-1 max-h-[120px] overflow-y-auto">
                {availableAgents.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => handleAddMember(agent.id)}
                    className="w-full px-2 py-1.5 text-left flex items-center gap-2 rounded-md hover:bg-[var(--bg-hover)] transition-all text-[11px]"
                  >
                    <div className="w-4 h-4 rounded glass flex items-center justify-center flex-shrink-0">
                      {renderAvatarIcon(agent.avatar, 8)}
                    </div>
                    <span className="text-[var(--text-secondary)]">{agent.name}</span>
                    <span className="text-[9px] text-[var(--accent)] ml-auto">+ 添加</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {showAddMember && availableAgents.length === 0 && (
            <div className="mb-2 p-2 rounded-lg glass border border-[var(--border)] text-[10px] text-[var(--text-muted)] text-center">
              所有 Agent 已在群中
            </div>
          )}

          {/* 成员列表 */}
          <div className="space-y-1">
            {chat.members.map((member) => (
              <div
                key={member.id}
                className="px-2.5 py-2 flex items-center gap-2 rounded-lg hover:bg-[var(--bg-hover)] transition-all group"
              >
                <div className="w-6 h-6 rounded-md glass flex items-center justify-center flex-shrink-0">
                  {renderAvatarIcon(member.avatar, 10)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-[var(--text-primary)] truncate">{member.name}</div>
                </div>
                {/* 角色选择 */}
                {member.role !== "owner" ? (
                  <select
                    value={member.role}
                    onChange={(e) => {
                      const newRole = e.target.value;
                      if (newRole === "owner") {
                        // 转让群主：将当前群主降为 member，将目标成员升为 owner
                        const currentOwnerId = chat.members.find((m) => m.role === "owner")?.id;
                        if (currentOwnerId) {
                          updateMemberRole(chatId, currentOwnerId, "member");
                        }
                        updateMemberRole(chatId, member.id, "owner");
                        // 更新 ownerId
                        useAppStore.setState((s: AppState) => ({
                          chats: { ...s.chats, [chatId]: { ...s.chats[chatId], ownerId: member.id } },
                        }));
                      } else {
                        handleChangeRole(member.id, newRole as ChatMember["role"]);
                      }
                    }}
                    className="text-[9px] bg-transparent border border-[var(--border)] rounded px-1 py-0.5 text-[var(--text-muted)] outline-none focus:border-[var(--accent)]"
                  >
                    <option value="member">成员</option>
                    <option value="readonly">只读</option>
                    <option value="external">外部</option>
                    <option value="owner">设为群主</option>
                  </select>
                ) : (
                  <span className="text-[9px] text-[var(--accent)] font-medium">{ROLE_LABELS[member.role]}</span>
                )}
                {/* 移除按钮 */}
                {member.role !== "owner" && (
                  <button
                    onClick={() => handleRemoveMember(member.id)}
                    className="text-[10px] text-[var(--text-faint)] hover:text-[var(--error)] transition-colors opacity-0 group-hover:opacity-100"
                    title="移除成员"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 群聊内任务 */}
        <GroupTaskList chatId={chatId} />

        {/* 解散群聊 */}
        <div className="pt-2 border-t border-[var(--border)]">
          <button
            onClick={() => {
              const store = useAppStore.getState();
              store.deleteChat(chatId);
              onClose();
            }}
            className="w-full py-2 text-[11px] text-[var(--error)] hover:bg-[var(--error-muted)] rounded-lg transition-colors"
          >
            解散群聊
          </button>
        </div>
      </div>
    </div>
  );
}

/** 群聊内任务列表 */
function GroupTaskList({ chatId }: { chatId: ChatId }) {
  const allTasks = useAppStore((s: AppState) => s.tasks);
  const tasks = useMemo(
    () => Object.values(allTasks).filter((t) => t.chatId === chatId),
    [allTasks, chatId]
  );

  if (tasks.length === 0) return null;

  const statusLabels: Record<string, string> = {
    pending: "待处理", in_progress: "进行中", completed: "已完成", error: "异常",
  };
  const statusColors: Record<string, string> = {
    pending: "text-[var(--text-muted)]", in_progress: "text-[var(--accent)]",
    completed: "text-[var(--success)]", error: "text-[var(--error)]",
  };

  return (
    <div>
      <label className="text-[10px] font-semibold font-heading uppercase tracking-[0.08em] text-[var(--text-muted)] block mb-2">
        任务 ({tasks.length})
      </label>
      <div className="space-y-1 max-h-[150px] overflow-y-auto">
        {tasks.map((task) => (
          <div key={task.id} className="px-2.5 py-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition-all">
            <div className="text-[11px] text-[var(--text-primary)] truncate">{task.title}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-[9px] ${statusColors[task.status] || ""}`}>
                {statusLabels[task.status] || task.status}
              </span>
              <span className="text-[9px] text-[var(--text-faint)]">
                优先级: {task.priority}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
