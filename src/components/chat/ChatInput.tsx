"use client";

import { useState, useRef } from "react";
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
  const inputRef = useRef<HTMLInputElement>(null);

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

  const handleSubmit = () => {
    const text = input.trim();
    if (!text) return;
    if (text.startsWith("/")) { handleSlashCommand(text); setInput(""); return; }

    // NLU 自然语言解析（ORG-01, SOLO-02, KNL-02）
    const nluResult = parseNaturalLanguage(text);
    if (nluResult.confidence >= 0.7 && nluResult.intent !== "unknown") {
      handleNLUIntent(nluResult);
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
        const name = (params.name as string) || "新 Agent";
        const role = (params.role as AgentRole) || "specialist";
        const capabilities = (params.capabilities as AgentCapability[]) || [];
        const config: Record<string, unknown> = {};
        if (params.model) config.model = params.model;
        if (params.monthlyBudget) config.monthlyBudget = params.monthlyBudget;
        const agentResult = createAgent(name, role, null, capabilities, config);
        if ("error" in agentResult) {
          sendMessage(chatId, "system", "system", agentResult.error);
        } else {
          const capStr = capabilities.length > 0 ? `，能力: ${capabilities.map((c) => c.name).join("、")}` : "";
          sendMessage(chatId, "system", "system", `已创建${role === "supervisor" ? "主管" : "专员"} Agent「${agentResult.name}」${params.model ? `，模型 ${params.model}` : ""}${capStr}`);
          const chat = createChat("direct", agentResult.name, [
            { id: "user", name: "你", avatar: "user", role: "owner" },
            { id: agentResult.id, name: agentResult.name, avatar: agentResult.avatar, role: "member" },
          ]);
          store.setActiveChat(chat.id);
        }
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
      const result = await executeCommand(parsed, chatId);
      sendMessage(chatId, "system", "system", result.message);
      // 处理 new_agent 的额外逻辑：自动创建 direct 聊天
      if (parsed.type === "new_agent" && result.success && result.data) {
        const data = result.data as { agentId?: string };
        if (data.agentId) {
          const agent = useAppStore.getState().agents[data.agentId];
          if (agent) {
            const chat = createChat("direct", agent.name, [
              { id: "user", name: "你", avatar: "user", role: "owner" },
              { id: agent.id, name: agent.name, avatar: agent.avatar, role: "member" },
            ]);
            useAppStore.getState().setActiveChat(chat.id);
          }
        }
      }
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

      {/* Input bar — glass surface */}
      <div className="flex items-end gap-2 px-4 py-3 glass-surface glass-reflect">
        {/* UI-04: 回复提示 */}
        {replyToId && (
          <div className="flex items-center gap-1 text-[10px] text-[var(--accent)] bg-[var(--accent-muted)] px-2 py-1 rounded-lg flex-shrink-0">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M1 5L5 1L9 5"/><path d="M5 1V9"/></svg>
            回复中
          </div>
        )}
        <div className="flex-1 relative">
          <input ref={inputRef} value={input} onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
            placeholder="输入消息...  / 命令  @ 提及" className="input-base pr-10" />
          {input.startsWith("/") && <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-faint)]">↵ 执行</div>}
        </div>
        <button onClick={handleSubmit} disabled={!input.trim()} className="btn-cta px-3.5 py-2.5 rounded-xl">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7L12 2L7 12L6 7.5L2 7Z" fill="currentColor"/></svg>
        </button>
      </div>
    </div>
  );
}
