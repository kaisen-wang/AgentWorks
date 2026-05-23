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
  | "summary"
  | "archive"
  | "queue"
  | "project"
  | "help"
  | "exempt"
  | "urgent"
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
    summary: "summary",
    archive: "archive",
    queue: "queue",
    project: "project",
    help: "help",
    exempt: "exempt",
    urgent: "urgent",
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
      const task = store.createTask(
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
        return { success: false, message: "用法: /queue <Agent名>" };
      }
      const agent = Object.values(store.agents).find((a) => a.name === parsed.args);
      if (!agent) {
        return { success: false, message: `Agent "${parsed.args}" 不存在` };
      }
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

    case "help": {
      return {
        success: true,
        message: `可用命令:
/new_task @Agent名 任务描述 — 创建任务
/summary — 获取当前会话任务汇总
/archive 查询关键词 — 检索归档
/queue Agent名 — 查看 Agent 任务队列
/project [项目名] — 切换/创建项目
/exempt Agent名 原因 — 申请管理幅度临时豁免
/urgent — 标记下一条上报为紧急
/help — 显示帮助信息`,
      };
    }

    case "unknown":
    default: {
      return { success: false, message: `未知命令: ${parsed.raw}。输入 /help 查看可用命令。` };
    }
  }
}
