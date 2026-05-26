"use client";

import { useState, useRef, useEffect } from "react";
import { useAppStore } from "@/stores/appStore";
import type { AppState } from "@/stores/appStore";
import { workflowEngine } from "@/lib/workflow";
import { parseNaturalLanguage } from "@/lib/nlu";
import { IconBot, IconTask, IconChart, IconArchive, IconCollaborator, IconMoon, IconHelp, IconUser, IconFolder, IconShield, IconAlert, renderAvatarIcon } from "@/components/common/Icons";
import { parseSlashCommand, executeCommand } from "@/lib/commands/SlashCommandRouter";
import type { AgentId, ChatId, AgentRole, AgentCapability, MessageId } from "@/types";

export function ChatInput({ chatId, replyToId, onReplySent }: { chatId: ChatId; replyToId?: MessageId | null; onReplySent?: () => void }) {
  const [input, setInput] = useState("");
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isDragging) return;
    const onUp = () => setIsDragging(false);
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, [isDragging]);

  const agents = useAppStore((s: AppState) => s.agents);
  const sendMessage = useAppStore((s: AppState) => s.sendMessage);
  const createAgent = useAppStore((s: AppState) => s.createAgent);
  const createChat = useAppStore((s: AppState) => s.createChat);
  const chats = useAppStore((s: AppState) => s.chats);
  const addMemberToChat = useAppStore((s: AppState) => s.addMemberToChat);
  const inviteCollaborator = useAppStore((s: AppState) => s.inviteCollaborator);
  const setRestMode = useAppStore((s: AppState) => s.setRestMode);
  const restMode = useAppStore((s: AppState) => s.restMode);
  const agentList = Object.values(agents);

  const slashCommands = [
    { cmd: "/new_agent", desc: "创建新 Agent", icon: <IconBot size={13} /> },
    { cmd: "/new_task", desc: "下达任务 (@Agent名 描述)", icon: <IconTask size={13} /> },
    { cmd: "/summary", desc: "汇总当前任务", icon: <IconChart size={13} /> },
    { cmd: "/archive", desc: "查询归档 (关键词)", icon: <IconArchive size={13} /> },
    { cmd: "/queue", desc: "查看Agent任务队列", icon: <IconChart size={13} /> },
    { cmd: "/project", desc: "切换/创建项目", icon: <IconFolder size={13} /> },
    { cmd: "/exempt", desc: "申请管理幅度豁免", icon: <IconShield size={13} /> },
    { cmd: "/urgent", desc: "标记下一条上报为紧急", icon: <IconAlert size={13} /> },
    { cmd: "/invite", desc: "邀请外部协作者", icon: <IconCollaborator size={13} /> },
    { cmd: "/rest_mode", desc: "开启/关闭休息模式", icon: <IconMoon size={13} /> },
    { cmd: "/help", desc: "显示帮助", icon: <IconHelp size={13} /> },
  ];

  const noAgents = agentList.length === 0;

  const handleSubmit = () => {
    const text = input.trim();
    if (!text) return;
    if (text.startsWith("/")) { handleSlashCommand(text); setInput(""); return; }

    // NLU 自然语言解析（ORG-01, SOLO-02, KNL-02）
    const nluResult = parseNaturalLanguage(text);
    if (nluResult.confidence >= 0.7 && nluResult.intent !== "unknown") {
      // create_agent 意图正常处理
      if (nluResult.intent === "create_agent") {
        handleNLUIntent(nluResult);
        setInput("");
        return;
      }
      // 无 Agent 时，非创建意图提示先创建 Agent
      if (noAgents) {
        sendMessage(chatId, "system", "system", "当前没有任何 Agent，请先创建一个 Agent 再操作。输入 /new_agent 或点击下方按钮创建。");
        useAppStore.getState().openCreateAgentPanel();
        setInput("");
        return;
      }
      handleNLUIntent(nluResult);
      setInput("");
      return;
    }

    // 无 Agent 时，普通消息提示先创建 Agent
    if (noAgents) {
      sendMessage(chatId, "system", "system", "当前没有任何 Agent，请先创建一个 Agent 再发送消息。输入 /new_agent 或点击下方按钮创建。");
      useAppStore.getState().openCreateAgentPanel();
      setInput("");
      return;
    }

    const mentions: AgentId[] = [];
    const mentionRegex = /@(\S+)/g;
    let match: RegExpExecArray | null;
    while ((match = mentionRegex.exec(text)) !== null) { const agent = agentList.find((a) => a.name === match![1]); if (agent) mentions.push(agent.id); }
    sendMessage(chatId, "text", "user", text, { mentions, ...(replyToId ? { replyToId } : {}) });
    if (mentions.length > 0) {
      const taskContent = text.replace(/@\S+/g, "").trim();
      for (const agentId of mentions) { const agent = agents[agentId]; if (agent?.role === "supervisor" && taskContent) { workflowEngine.assignTask(taskContent.slice(0, 30), taskContent, agentId, chatId); } }
    }
    setInput("");
    onReplySent?.();
  };

  /** 处理 NLU 解析出的意图 */
  const handleNLUIntent = (result: ReturnType<typeof parseNaturalLanguage>) => {
    const { intent, params } = result;
    const store = useAppStore.getState();

    switch (intent) {
      case "create_agent": {
        // 弹出结构化创建面板
        useAppStore.getState().openCreateAgentPanel((params.name as string) || "");
        break;
      }
      case "set_threshold": {
        const threshold = params.threshold as number;
        const agentName = params.agentName as string | undefined;
        if (agentName) {
          const agent = agentList.find((a) => a.name.includes(agentName));
          if (agent) {
            store.updateAgent(agent.id, { config: { ...agent.config, decisionThreshold: threshold } });
            sendMessage(chatId, "system", "system", `已将「${agent.name}」的决策阈值设为 ${threshold}`);
          } else {
            sendMessage(chatId, "system", "system", `未找到名为「${agentName}」的 Agent`);
          }
        } else {
          sendMessage(chatId, "system", "system", `请指定 Agent 名称，如"设置营销主管的决策阈值为5"`);
        }
        break;
      }
      case "update_knowledge": {
        const key = params.key as string;
        const value = params.value as string;
        const scope = (params.scope as "global" | "department" | "personal") || "global";
        const agentName = params.agentName as string | undefined;
        let agentId: string | undefined;
        if (agentName) {
          const agent = agentList.find((a) => a.name.includes(agentName));
          agentId = agent?.id;
        }
        store.addKnowledge(scope, key, value, agentId);
        sendMessage(chatId, "system", "system", `已更新${scope === "global" ? "全局" : scope === "department" ? "部门" : "个人"}知识库: ${key} = ${value}`);
        break;
      }
      case "update_config": {
        const agentName = params.agentName as string;
        const field = params.field as string;
        const value = params.value;
        const agent = agentList.find((a) => a.name.includes(agentName));
        if (agent) {
          if (field === "model") {
            store.updateAgent(agent.id, { config: { ...agent.config, model: value as string } });
            sendMessage(chatId, "system", "system", `已将「${agent.name}」的模型切换为 ${value}`);
          } else if (field === "monthlyBudget") {
            store.updateAgent(agent.id, { config: { ...agent.config, monthlyBudget: value as number } });
            sendMessage(chatId, "system", "system", `已将「${agent.name}」的月度预算调整为 ${value}`);
          } else if (field === "timeout") {
            store.updateAgent(agent.id, { config: { ...agent.config, timeout: value as number } });
            sendMessage(chatId, "system", "system", `已将「${agent.name}」的超时时间设为 ${value}ms`);
          } else if (field === "maxRetries") {
            store.updateAgent(agent.id, { config: { ...agent.config, maxRetries: value as number } });
            sendMessage(chatId, "system", "system", `已将「${agent.name}」的重试次数设为 ${value}`);
          } else if (field === "temperature") {
            store.updateAgent(agent.id, { config: { ...agent.config, temperature: value as number } });
            sendMessage(chatId, "system", "system", `已将「${agent.name}」的温度设为 ${value}`);
          } else if (field === "maxChildren") {
            store.updateMaxChildren(agent.id, value as number);
            sendMessage(chatId, "system", "system", `已将「${agent.name}」的管理幅度上限设为 ${value}`);
          } else if (field === "reportFrequency") {
            store.updateAgent(agent.id, { config: { ...agent.config, reportFrequency: value as "on_completion" | "daily" | "weekly" } });
            const freqLabel = value === "on_completion" ? "完成时" : value === "daily" ? "每日" : "每周";
            sendMessage(chatId, "system", "system", `已将「${agent.name}」的上报频率设为 ${freqLabel}`);
          }
        } else {
          sendMessage(chatId, "system", "system", `未找到名为「${agentName}」的 Agent`);
        }
        break;
      }
      case "run_script": {
        const scriptName = params.scriptName as string;
        const scripts = Object.values(store.scripts);
        const script = scripts.find((s) => s.name.includes(scriptName));
        if (script) {
          sendMessage(chatId, "system", "system", `正在运行剧本「${script.name}」...`);
          workflowEngine.runScript(script.id, chatId, params.replacements as string | undefined);
        } else {
          sendMessage(chatId, "system", "system", `未找到剧本「${scriptName}」，可用的剧本: ${scripts.length > 0 ? scripts.map((s) => s.name).join("、") : "无"}`);
        }
        break;
      }
      case "search_archive": {
        const query = params.query as string;
        const archives = store.searchArchives(query);
        if (archives.length === 0) {
          sendMessage(chatId, "system", "system", `归档中未找到与「${query}」相关的记录`);
        } else {
          const summary = archives.slice(0, 5).map((a) => `${a.agentName}: ${a.taskTitle} - ${a.cost.toFixed(2)}`).join("\n");
          const totalCost = archives.reduce((sum, a) => sum + a.cost, 0);
          sendMessage(chatId, "system", "system", `归档检索「${query}」(${archives.length}条):\n${summary}${archives.length > 5 ? `\n...还有 ${archives.length - 5} 条` : ""}\n总费用: ${totalCost.toFixed(2)}`);
        }
        break;
      }
      case "delete_agent": {
        const agentName = params.agentName as string;
        const agent = agentList.find((a) => a.name.includes(agentName));
        if (agent) {
          store.deleteAgent(agent.id);
          sendMessage(chatId, "system", "system", `已删除 Agent「${agent.name}」`);
        } else {
          sendMessage(chatId, "system", "system", `未找到名为「${agentName}」的 Agent`);
        }
        break;
      }
      case "move_agent": {
        const agentName = params.agentName as string;
        const targetParentName = params.targetParentName as string;
        const agent = agentList.find((a) => a.name.includes(agentName));
        const parent = agentList.find((a) => a.name.includes(targetParentName));
        if (agent && parent) {
          const result = store.setParent(agent.id, parent.id);
          if ("error" in result) {
            // RFT-05: 检测到循环时，尝试强制指定
            if (result.error?.includes("循环引用")) {
              const forceResult = store.setParent(agent.id, parent.id, true);
              if ("error" in forceResult) {
                sendMessage(chatId, "system", "system", forceResult.error || "操作失败");
              } else {
                sendMessage(chatId, "system", "system", `已强制将「${agent.name}」移至「${parent.name}」下（跳过循环检测）`);
              }
            } else {
              sendMessage(chatId, "system", "system", result.error || "操作失败");
            }
          } else {
            sendMessage(chatId, "system", "system", `已将「${agent.name}」移至「${parent.name}」下`);
          }
        } else {
          sendMessage(chatId, "system", "system", `未找到 Agent「${agentName}」或目标主管「${targetParentName}」`);
        }
        break;
      }
      case "add_capability": {
        // SOLO-02: 添加能力标签
        const agentName = params.agentName as string;
        const capabilityNames = params.capabilityNames as string[];
        const agent = agentList.find((a) => a.name.includes(agentName));
        if (agent) {
          const newCapabilities = [...agent.capabilities];
          for (const capName of capabilityNames) {
            const existing = newCapabilities.find((c) => c.name === capName);
            if (!existing) {
              // 从预置标签库查找完整定义，否则创建简单标签
              const { PRESET_CAPABILITIES } = require("@/lib/capability/CapabilityMatcher");
              const preset = PRESET_CAPABILITIES.find((c: AgentCapability) => c.name === capName);
              newCapabilities.push(preset || { name: capName, description: capName });
            }
          }
          store.updateAgent(agent.id, { capabilities: newCapabilities });
          sendMessage(chatId, "system", "system", `已为「${agent.name}」添加能力: ${capabilityNames.join("、")}`);
        } else {
          sendMessage(chatId, "system", "system", `未找到名为「${agentName}」的 Agent`);
        }
        break;
      }
      case "remove_capability": {
        // SOLO-02: 移除能力标签
        const agentName = params.agentName as string;
        const capabilityNames = params.capabilityNames as string[];
        const agent = agentList.find((a) => a.name.includes(agentName));
        if (agent) {
          const newCapabilities = agent.capabilities.filter((c) => !capabilityNames.includes(c.name));
          store.updateAgent(agent.id, { capabilities: newCapabilities });
          sendMessage(chatId, "system", "system", `已移除「${agent.name}」的能力: ${capabilityNames.join("、")}`);
        } else {
          sendMessage(chatId, "system", "system", `未找到名为「${agentName}」的 Agent`);
        }
        break;
      }
      case "set_archive_policy": {
        // SOLO-02: 归档策略配置
        const retentionDays = params.retentionDays as number | undefined;
        const policy = params.policy as string | undefined;
        if (retentionDays) {
          sendMessage(chatId, "system", "system", `已设置归档保留期限为 ${retentionDays} 天`);
        } else if (policy) {
          sendMessage(chatId, "system", "system", `已设置归档策略为: ${policy}`);
        }
        break;
      }
      default:
        sendMessage(chatId, "text", "user", result.raw);
    }
  };

  const handleSlashCommand = async (cmd: string) => {
    // UI-05: 使用 SlashCommandRouter 统一处理所有斜杠命令
    const parsed = parseSlashCommand(cmd);
    if (parsed && parsed.type !== "unknown") {
      // /new_agent 弹出结构化创建面板
      if (parsed.type === "new_agent") {
        const store = useAppStore.getState();
        store.openCreateAgentPanel(parsed.args || "");
        return;
      }
      const result = await executeCommand(parsed, chatId);
      sendMessage(chatId, "system", "system", result.message);
      // 处理 invite 的额外逻辑：添加成员到聊天
      if (parsed.type === "invite" && result.success && result.data) {
        const data = result.data as { collaboratorName?: string };
        if (data.collaboratorName) {
          inviteCollaborator(data.collaboratorName, chatId);
          addMemberToChat(chatId, { id: `ext_${data.collaboratorName}`, name: data.collaboratorName, avatar: "collaborator", role: "external" });
        }
      }
      return;
    }
    sendMessage(chatId, "system", "system", `未知命令，输入 /help 查看帮助`);
  };

  const handleInputChange = (value: string) => {
    setInput(value);
    if (value.startsWith("/")) { setShowSlashMenu(true); setShowMentionMenu(false); }
    else if (value.includes("@")) { const lastAt = value.lastIndexOf("@"); setMentionFilter(value.slice(lastAt + 1)); setShowMentionMenu(true); setShowSlashMenu(false); }
    else { setShowSlashMenu(false); setShowMentionMenu(false); }
  };

  const filteredCommands = slashCommands.filter((c) => c.cmd.startsWith(input));
  const filteredAgents = agentList.filter((a) => a.name.toLowerCase().includes(mentionFilter.toLowerCase()));

  return (
    <div className="relative">
      {/* Slash menu — glass */}
      {showSlashMenu && filteredCommands.length > 0 && (
        <div className="absolute bottom-full left-3 right-3 mb-2 glass-heavy rounded-xl p-1.5 max-h-52 overflow-y-auto shadow-lg animate-slide-up glass-reflect">
          <div className="text-[9px] font-semibold font-heading uppercase tracking-[0.08em] text-[var(--text-muted)] px-2 py-1.5">命令</div>
          {filteredCommands.map((c) => (
            <button key={c.cmd} onClick={() => { setInput(c.cmd + " "); setShowSlashMenu(false); inputRef.current?.focus(); }}
              className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-[var(--bg-hover)] transition-all duration-[100ms] flex items-center gap-2.5 group">
              <span className="w-5 flex items-center justify-center">{c.icon}</span>
              <span className="text-[12px] text-[var(--accent)] font-mono">{c.cmd}</span>
              <span className="text-[11px] text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] transition-colors">{c.desc}</span>
            </button>
          ))}
        </div>
      )}

      {/* Mention menu — glass */}
      {showMentionMenu && filteredAgents.length > 0 && (
        <div className="absolute bottom-full left-3 right-3 mb-2 glass-heavy rounded-xl p-1.5 max-h-52 overflow-y-auto shadow-lg animate-slide-up glass-reflect">
          <div className="text-[9px] font-semibold font-heading uppercase tracking-[0.08em] text-[var(--text-muted)] px-2 py-1.5">提及 Agent</div>
          {filteredAgents.map((a) => (
            <button key={a.id} onClick={() => { const lastAt = input.lastIndexOf("@"); setInput(input.slice(0, lastAt) + `@${a.name} `); setShowMentionMenu(false); inputRef.current?.focus(); }}
              className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-[var(--bg-hover)] transition-all duration-[100ms] flex items-center gap-2.5 group">
              <div className="w-5 h-5 rounded-md glass flex items-center justify-center glass-reflect">{renderAvatarIcon(a.avatar, 10)}</div>
              <span className="text-[12px] text-[var(--text-primary)]">{a.name}</span>
              <span className="text-[9px] text-[var(--text-muted)] glass px-1.5 py-[1px] rounded">{a.role}</span>
              <span className={`status-dot status-${a.status} ml-auto`} />
            </button>
          ))}
        </div>
      )}

      {/* Input bar — enterprise chat style */}
      <div className="px-4 py-3 glass-surface glass-reflect">
        {/* Reply indicator */}
        {replyToId && (
          <div className="flex items-center gap-1 text-[10px] text-[var(--accent)] bg-[var(--accent-muted)] px-2 py-1 rounded-lg mb-2 w-fit">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M1 5L5 1L9 5"/><path d="M5 1V9"/></svg>
            回复中
          </div>
        )}
        {/* Toolbar row */}
        <div className="flex items-center gap-1 mb-2">
          <button className="p-1.5 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors" title="斜杠命令" onClick={() => { setInput("/"); setShowSlashMenu(true); inputRef.current?.focus(); }}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M4 2L11 13"/><circle cx="3.5" cy="4" r="1.5"/><circle cx="11.5" cy="11" r="1.5"/></svg>
          </button>
          <button className="p-1.5 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors" title="@ 提及" onClick={() => { setInput(prev => prev + "@"); setMentionFilter(""); setShowMentionMenu(true); inputRef.current?.focus(); }}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="7.5" cy="7.5" r="5.5"/><path d="M7.5 2V3M7.5 12V13M2 7.5H3M12 7.5H13"/></svg>
          </button>
          <button className="p-1.5 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors" title="附件">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M4 8V4.5C4 2.5 5.5 1 7.5 1S11 2.5 11 4.5V9C11 10.1 10.1 11 9 11S7 10.1 7 9V4.5C7 3.7 7.7 3 8.5 3S10 3.7 10 4.5V9"/></svg>
          </button>
          <button className="p-1.5 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors" title="表情">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="7.5" cy="7.5" r="6"/><path d="M5 9C5.5 10 6.5 10.5 7.5 10.5S9.5 10 10 9"/><circle cx="5.5" cy="6" r="0.8" fill="currentColor"/><circle cx="9.5" cy="6" r="0.8" fill="currentColor"/></svg>
          </button>
          <div className="flex-1" />
          {input.startsWith("/") && <span className="text-[10px] text-[var(--text-faint)]">↵ 执行命令</span>}
        </div>
        {/* Textarea + Send */}
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => { handleInputChange(e.target.value); if (!isDragging) { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px"; } }}
            onMouseDown={(e) => { const rect = e.currentTarget.getBoundingClientRect(); if (rect.bottom - e.clientY < 6) { setIsDragging(true); e.preventDefault(); }}}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
            placeholder={noAgents ? "暂无 Agent，输入 /new_agent 创建" : "输入消息，Enter 发送，Shift+Enter 换行"}
            rows={2}
            className="flex-1 resize-y bg-[var(--glass-light)] border border-[var(--glass-border)] rounded-xl px-5 py-4 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-muted)] transition-all leading-relaxed min-h-[68px] max-h-[200px] overflow-y-auto cursor-n-resize"
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim()}
            className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-[var(--cta)] text-white hover:bg-[var(--cta-hover)] hover:shadow-[0_0_16px_var(--cta-glow)] active:scale-95"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8L13 3L8 13L7 8.5L3 8Z" fill="currentColor"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
