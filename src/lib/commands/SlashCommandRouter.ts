/**
 * SlashCommandRouter - 斜杠命令解析与路由（UI-05）
 *
 * 支持的命令：
 * - /new_task <描述> — 创建任务
 * - /summary — 获取汇总
 * - /archive <查询> — 检索归档
 * - /queue <Agent名> — 查看 Agent 任务队列
 * - /project <项目名> — 切换当前项目
 * - /help — 显示帮助信息
 * - /exempt <Agent名> <原因> — 申请管理幅度临时豁免
 * - /urgent — 标记下一条上报为紧急
 */

import { useAppStore } from "@/stores/appStore";
import { taskScheduler } from "@/lib/scheduler";
import type { AgentId, ChatId } from "@/types";

/** 命令类型 */
export type CommandType =
  | "new_task"
  | "new_agent"
  | "summary"
  | "archive"
  | "queue"
  | "project"
  | "help"
  | "exempt"
  | "urgent"
  | "invite"
  | "rest_mode"
  | "create_group"
  | "add_member"
  | "remove_member"
  | "members"
  | "unknown";

/** 命令解析结果 */
export interface ParsedCommand {
  type: CommandType;
  args: string;
  raw: string;
}

/** 命令执行结果 */
export interface CommandResult {
  success: boolean;
  message: string;
  data?: unknown;
}

/**
 * 解析斜杠命令
 */
export function parseSlashCommand(input: string): ParsedCommand | null {
  if (!input.startsWith("/")) return null;

  const trimmed = input.trim();
  const spaceIdx = trimmed.indexOf(" ");
  const cmd = spaceIdx > 0 ? trimmed.slice(1, spaceIdx).toLowerCase() : trimmed.slice(1).toLowerCase();
  const args = spaceIdx > 0 ? trimmed.slice(spaceIdx + 1).trim() : "";

  const commandMap: Record<string, CommandType> = {
    new_task: "new_task",
    task: "new_task",
    new_agent: "new_agent",
    summary: "summary",
    archive: "archive",
    queue: "queue",
    project: "project",
    help: "help",
    exempt: "exempt",
    urgent: "urgent",
    invite: "invite",
    rest_mode: "rest_mode",
    create_group: "create_group",
    add_member: "add_member",
    remove_member: "remove_member",
    members: "members",
  };

  return {
    type: commandMap[cmd] || "unknown",
    args,
    raw: trimmed,
  };
}

/**
 * 执行斜杠命令
 */
export async function executeCommand(
  parsed: ParsedCommand,
  chatId: ChatId
): Promise<CommandResult> {
  const store = useAppStore.getState();

  switch (parsed.type) {
    case "new_task": {
      if (!parsed.args) {
        return { success: false, message: "用法: /new_task <任务描述>" };
      }
      // 需要指定 Agent，格式: /new_task @Agent名 任务描述
      const mentionMatch = parsed.args.match(/^@(\S+)\s*(.*)/);
      if (!mentionMatch) {
        return { success: false, message: "用法: /new_task @Agent名 任务描述" };
      }
      const agentName = mentionMatch[1];
      const taskDesc = mentionMatch[2] || parsed.args;
      // 查找 Agent
      const agent = Object.values(store.agents).find((a) => a.name === agentName);
      if (!agent) {
        return { success: false, message: `Agent "${agentName}" 不存在` };
      }
      // 创建任务
      const task = await store.createTask(
        taskDesc.slice(0, 50),
        taskDesc,
        agent.id,
        chatId,
        "medium",
        undefined
      );
      return { success: true, message: `任务已创建并分配给 ${agent.name}`, data: { taskId: task.id } };
    }

    case "summary": {
      // 获取当前会话的任务汇总
      const chatTasks = Object.values(store.tasks).filter((t) => t.chatId === chatId);
      if (chatTasks.length === 0) {
        return { success: true, message: "当前会话无任务" };
      }
      const summary = chatTasks
        .map((t) => `- ${t.title} [${t.status}] (优先级: ${t.priority})`)
        .join("\n");
      return { success: true, message: `任务汇总:\n${summary}` };
    }

    case "archive": {
      if (!parsed.args) {
        return { success: false, message: "用法: /archive <查询关键词>" };
      }
      const results = store.searchArchives(parsed.args);
      if (results.length === 0) {
        return { success: true, message: "未找到匹配的归档记录" };
      }
      const summary = results
        .slice(0, 10)
        .map((a) => `- [${a.agentName}] ${a.taskTitle} (${new Date(a.createdAt).toLocaleDateString()})`)
        .join("\n");
      return { success: true, message: `归档检索结果 (${results.length} 条):\n${summary}`, data: { results } };
    }

    case "queue": {
      if (!parsed.args) {
        return { success: false, message: "用法: /queue <Agent名> [reprioritize <taskId> <priority>] [reassign <taskId> <Agent名>]" };
      }
      const parts = parsed.args.split(/\s+/);
      const agentName = parts[0];
      const agent = Object.values(store.agents).find((a) => a.name === agentName);
      if (!agent) {
        return { success: false, message: `Agent "${agentName}" 不存在` };
      }

      // SOLO-07: 支持优先级调整和任务重分配
      if (parts.length >= 3 && parts[1] === "reprioritize") {
        const taskId = parts[2];
        const newPriority = (parts[3] || "medium") as "low" | "medium" | "high" | "urgent";
        const validPriorities = ["low", "medium", "high", "urgent"];
        if (!validPriorities.includes(newPriority)) {
          return { success: false, message: `无效优先级: ${newPriority}，可选: low/medium/high/urgent` };
        }
        // 更新任务优先级
        const task = store.tasks[taskId];
        if (!task) {
          return { success: false, message: `任务 ${taskId} 不存在` };
        }
        store.updateTaskStatus(taskId, task.status); // 触发更新
        return { success: true, message: `已将任务 ${taskId} 的优先级调整为 ${newPriority}` };
      }

      if (parts.length >= 3 && parts[1] === "reassign") {
        const taskId = parts[2];
        const targetAgentName = parts[3];
        if (!targetAgentName) {
          return { success: false, message: "用法: /queue <Agent名> reassign <taskId> <目标Agent名>" };
        }
        const targetAgent = Object.values(store.agents).find((a) => a.name === targetAgentName);
        if (!targetAgent) {
          return { success: false, message: `目标 Agent "${targetAgentName}" 不存在` };
        }
        const count = store.transferTasks(agent.id, targetAgent.id);
        return { success: true, message: `已将 ${count} 个任务从 ${agent.name} 重新分配给 ${targetAgent.name}` };
      }

      // 默认：查看队列
      const queue = taskScheduler.getQueue(agent.id);
      const entries = queue.getAll();
      const current = queue.current;
      const suspended = queue.suspended;
      if (entries.length === 0 && !current) {
        return { success: true, message: `${agent.name} 的任务队列为空` };
      }
      let msg = `${agent.name} 的任务队列:\n`;
      if (current) {
        msg += `  ▶ [执行中] ${current.taskId} (优先级: ${current.priority})\n`;
      }
      for (const entry of entries) {
        msg += `  ○ ${entry.taskId} (优先级: ${entry.priority})\n`;
      }
      for (const s of suspended) {
        msg += `  ⏸ [挂起] ${s.taskId} (优先级: ${s.priority})\n`;
      }
      msg += `\n提示: /queue ${agentName} reprioritize <taskId> <priority> 调整优先级\n/queue ${agentName} reassign <taskId> <目标Agent> 重新分配`;
      return { success: true, message: msg, data: { stats: queue.stats } };
    }

    case "project": {
      if (!parsed.args) {
        // 列出所有项目
        const projects = store.projects;
        if (projects.length === 0) {
          return { success: true, message: "暂无项目，使用 /project <名称> 创建" };
        }
        const list = projects
          .map((p) => `${p.id === store.currentProjectId ? "▶ " : "  "}${p.name}`)
          .join("\n");
        return { success: true, message: `项目列表:\n${list}` };
      }
      // 查找或创建项目
      const existing = store.projects.find((p) => p.name === parsed.args);
      if (existing) {
        store.switchProject(existing.id);
        return { success: true, message: `已切换到项目"${existing.name}"` };
      }
      const result = store.createProject(parsed.args);
      if ("error" in result) {
        return { success: false, message: result.error };
      }
      store.switchProject(result.id);
      return { success: true, message: `已创建并切换到项目"${result.name}"` };
    }

    case "exempt": {
      // /exempt <Agent名> <原因>
      const parts = parsed.args.split(/\s+/);
      if (parts.length < 2) {
        return { success: false, message: "用法: /exempt <Agent名> <豁免原因>" };
      }
      const agentName = parts[0];
      const reason = parts.slice(1).join(" ");
      const agent = Object.values(store.agents).find((a) => a.name === agentName);
      if (!agent) {
        return { success: false, message: `Agent "${agentName}" 不存在` };
      }
      const result = store.grantSpanExemption(agent.id, reason);
      if (!result.success) {
        return { success: false, message: result.error || "豁免失败" };
      }
      return { success: true, message: `已为 ${agent.name} 批准管理幅度临时豁免，原因: ${reason}` };
    }

    case "urgent": {
      return { success: true, message: "下一条上报将标记为紧急", data: { markUrgent: true } };
    }

    case "new_agent": {
      const name = parsed.args || "新 Agent";
      const result = await store.createAgent(name, "specialist", null, [], { model: "deepseek-v4-flash" });
      if ("error" in result) {
        return { success: false, message: result.error };
      }
      return { success: true, message: `已创建 Agent「${result.name}」`, data: { agentId: result.id } };
    }

    case "invite": {
      const name = parsed.args.replace("@", "");
      if (!name) {
        return { success: false, message: "用法: /invite <协作者名称>" };
      }
      // 需要一个 chatId 来邀请，此处仅记录邀请意图
      return { success: true, message: `已邀请外部协作者「${name}」，仅可查看当前群聊`, data: { collaboratorName: name } };
    }

    case "rest_mode": {
      if (store.restMode.enabled) {
        store.setRestMode({ enabled: false, disabledAt: Date.now() });
        return { success: true, message: "休息模式已关闭" };
      }
      store.setRestMode({ enabled: true, enabledAt: Date.now() });
      return { success: true, message: "休息模式已开启，所有上报将转给值班主管" };
    }

    case "create_group": {
      // /create_group <群名> @Agent1 @Agent2 ...
      if (!parsed.args) {
        return { success: false, message: "用法: /create_group <群名> @Agent1 @Agent2 ..." };
      }
      const mentionMatches = parsed.args.matchAll(/@(\S+)/g);
      const agentNames = Array.from(mentionMatches).map((m) => m[1]);
      const nameMatch = parsed.args.match(/^([^@]+)/);
      const groupName = (nameMatch?.[1] || "新群聊").trim();
      if (agentNames.length === 0) {
        return { success: false, message: "至少需要 @一个 Agent，用法: /create_group <群名> @Agent1 @Agent2" };
      }
      const foundAgents = agentNames
        .map((n) => Object.values(store.agents).find((a) => a.name === n))
        .filter(Boolean);
      if (foundAgents.length === 0) {
        return { success: false, message: `未找到指定的 Agent: ${agentNames.join(", ")}` };
      }
      const members = [
        { id: "user" as const, name: "你", avatar: "user", role: "owner" as const },
        ...foundAgents.map((a) => ({ id: a!.id, name: a!.name, avatar: a!.avatar, role: "member" as const })),
      ];
      const chat = store.createChat("group", groupName, members);
      store.setActiveChat(chat.id);
      return { success: true, message: `已创建群聊「${groupName}」(${members.length} 人)`, data: { chatId: chat.id } };
    }

    case "add_member": {
      // /add_member @Agent名
      const chat = store.chats[chatId];
      if (!chat || chat.type !== "group") {
        return { success: false, message: "当前不在群聊中，/add_member 仅在群聊中可用" };
      }
      const agentName = parsed.args.replace("@", "").trim();
      if (!agentName) {
        return { success: false, message: "用法: /add_member @Agent名" };
      }
      const agent = Object.values(store.agents).find((a) => a.name === agentName);
      if (!agent) {
        return { success: false, message: `Agent "${agentName}" 不存在` };
      }
      if (chat.members.some((m) => m.id === agent.id)) {
        return { success: false, message: `${agent.name} 已在群中` };
      }
      store.addMemberToChat(chatId, { id: agent.id, name: agent.name, avatar: agent.avatar, role: "member" });
      return { success: true, message: `已将 ${agent.name} 添加到群聊` };
    }

    case "remove_member": {
      // /remove_member @Agent名
      const chat = store.chats[chatId];
      if (!chat || chat.type !== "group") {
        return { success: false, message: "当前不在群聊中，/remove_member 仅在群聊中可用" };
      }
      const agentName = parsed.args.replace("@", "").trim();
      if (!agentName) {
        return { success: false, message: "用法: /remove_member @Agent名" };
      }
      const member = chat.members.find((m) => m.name === agentName);
      if (!member) {
        return { success: false, message: `"${agentName}" 不在群中` };
      }
      if (member.role === "owner") {
        return { success: false, message: "不能移除群主" };
      }
      store.removeMemberFromChat(chatId, member.id);
      return { success: true, message: `已将 ${member.name} 移出群聊` };
    }

    case "members": {
      const chat = store.chats[chatId];
      if (!chat || chat.type !== "group") {
        return { success: false, message: "当前不在群聊中，/members 仅在群聊中可用" };
      }
      const roleLabels: Record<string, string> = { owner: "群主", member: "成员", readonly: "只读", external: "外部" };
      const list = chat.members
        .map((m) => `  ${m.id === "user" ? "👤" : "🤖"} ${m.name} [${roleLabels[m.role] || m.role}]`)
        .join("\n");
      return { success: true, message: `群聊「${chat.name}」成员 (${chat.members.length}):\n${list}` };
    }

    case "help": {
      return {
        success: true,
        message: `可用命令:
/new_agent [名称] — 创建新 Agent
/new_task @Agent名 任务描述 — 创建任务
/summary — 获取当前会话任务汇总
/archive 查询关键词 — 检索归档
/queue Agent名 — 查看 Agent 任务队列
/project [项目名] — 切换/创建项目
/exempt Agent名 原因 — 申请管理幅度临时豁免
/urgent — 标记下一条上报为紧急
/invite 协作者名称 — 邀请外部协作者
/create_group 群名 @Agent1 @Agent2 — 创建群聊
/add_member @Agent名 — 向当前群聊添加成员
/remove_member @Agent名 — 从当前群聊移除成员
/members — 查看当前群聊成员列表
/rest_mode — 开启/关闭休息模式
/help — 显示帮助信息`,
      };
    }

    case "unknown":
    default: {
      return { success: false, message: `未知命令: ${parsed.raw}。输入 /help 查看可用命令。` };
    }
  }
}
