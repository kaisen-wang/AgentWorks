"use client";

import { useRef, useEffect, useState } from "react";
import { useAppStore } from "@/stores/appStore";
import type { AppState } from "@/stores/appStore";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import { IconGroupChat, IconUser, renderAvatarIcon } from "@/components/common/Icons";
import type { ChatId, MessageId } from "@/types";

export function ChatWindow({ chatId }: { chatId: ChatId }) {
  const chat = useAppStore((s: AppState) => s.chats[chatId]);
  const messages = useAppStore((s: AppState) => s.messages[chatId] || []);
  const agents = useAppStore((s: AppState) => s.agents);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [replyingTo, setReplyingTo] = useState<MessageId | null>(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  // ACT-03: 获取聊天中活跃（非 idle）的 Agent 状态
  const activeAgentStatuses = chat
    ? chat.members
        .filter((m) => m.id !== "user" && m.id !== "system")
        .map((m) => {
          const agent = agents[m.id];
          if (!agent || agent.status === "idle" || agent.status === "archived") return null;
          return { id: agent.id, name: agent.name, status: agent.status };
        })
        .filter(Boolean) as { id: string; name: string; status: string }[]
    : [];

  if (!chat) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3 animate-fade-in">
          <div className="w-10 h-10 rounded-xl glass flex items-center justify-center mx-auto glass-reflect">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="var(--text-faint)" strokeWidth="1.2">
              <path d="M3 5H15M3 9H15M3 13H10"/>
            </svg>
          </div>
          <p className="text-[12px] text-[var(--text-muted)]">选择一个会话开始聊天</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Chat header — glass */}
      <div className="h-11 px-5 glass-surface flex items-center gap-3 flex-shrink-0 glass-reflect">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[13px] ${
          chat.type === "group" ? "glass-medium border border-[var(--accent)] border-opacity-30" : "glass"
        }`}>
          {chat.type === "group" ? <IconGroupChat size={13} /> : <IconUser size={13} />}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-[13px] font-semibold font-heading text-[var(--text-primary)] truncate leading-tight">{chat.name}</h2>
          <p className="text-[10px] text-[var(--text-muted)] leading-tight mt-0.5">
            {chat.members.length} 成员{chat.type === "group" && " · 群聊"}
          </p>
        </div>
        <div className="flex -space-x-1">
          {chat.members.slice(0, 4).map((m) => (
            <div key={m.id} className="w-5 h-5 rounded-full glass flex items-center justify-center" title={m.name}>
              {renderAvatarIcon(m.avatar, 9)}
            </div>
          ))}
          {chat.members.length > 4 && (
            <div className="w-5 h-5 rounded-full glass flex items-center justify-center text-[9px] text-[var(--text-muted)] font-medium">
              +{chat.members.length - 4}
            </div>
          )}
        </div>
        {/* ACT-03: 活跃 Agent 状态指示器 */}
        {activeAgentStatuses.length > 0 && (
          <div className="flex items-center gap-1.5 ml-1">
            {activeAgentStatuses.map((a) => (
              <span key={a.id} className="text-[9px] font-medium px-1.5 py-[2px] rounded-md bg-[var(--accent-muted)] text-[var(--accent)] animate-pulse">
                {a.name} {a.status === "executing" ? "执行中" : a.status === "summarizing" ? "汇总中" : a.status === "reporting" ? "上报中" : a.status === "error" ? "异常" : a.status}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-0.5">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-2 animate-fade-in">
              <div className="w-8 h-8 rounded-lg glass flex items-center justify-center mx-auto glass-reflect">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="var(--text-faint)" strokeWidth="1.2">
                  <path d="M2 4L7 7L12 4"/><rect x="1" y="3" width="12" height="8" rx="1.5"/>
                </svg>
              </div>
              <p className="text-[12px] text-[var(--text-muted)]">开始对话吧</p>
            </div>
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} message={msg} onReply={(id) => setReplyingTo(id)} />)
        )}
        <div ref={messagesEndRef} />
      </div>

      <ChatInput chatId={chatId} replyToId={replyingTo} onReplySent={() => setReplyingTo(null)} />
    </div>
  );
}
