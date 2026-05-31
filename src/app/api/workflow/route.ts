/**
 * Workflow API Route - Agent 执行的 API 端点
 *
 * 将 WorkflowEngine 的调用隔离在服务端，
 * 客户端通过 fetch 调用，避免 better-sqlite3 进入客户端 bundle。
 *
 * 重要：API Route 运行在服务端，Zustand store 可能未从数据库加载数据。
 * 因此在执行前需要确保 store 已从数据库 hydrate。
 */

import { NextRequest, NextResponse } from 'next/server';
import { useAppStore } from '@/stores/appStore';
import { WorkflowEngine } from '@/lib/workflow/WorkflowEngine';
import { getDb } from '@/lib/db/database';
import { AgentRepository } from '@/lib/db/agentRepo';
import { ChatRepository } from '@/lib/db/chatRepo';
import { MessageRepository } from '@/lib/db/messageRepo';

const workflowEngine = new WorkflowEngine();

/**
 * 确保服务端 Zustand store 已从数据库加载 agents/chats 数据。
 * 如果 store 中没有 agents，则从数据库 hydrate。
 */
async function ensureStoreHydrated(): Promise<void> {
  const store = useAppStore.getState();
  const agentCount = Object.keys(store.agents).length;

  if (agentCount > 0) {
    // Store 已有数据，无需重新加载
    return;
  }

  console.log('[Workflow API] Store 为空，从数据库加载数据...');

  try {
    const db = getDb();

    // 加载 agents
    const agentRepo = new AgentRepository(db);
    const agents = agentRepo.findAll();
    const agentsMap: Record<string, typeof agents[0]> = {};
    for (const agent of agents) {
      agentsMap[agent.id] = agent;
    }

    // 加载 chats
    const chatRepo = new ChatRepository(db);
    const chats = chatRepo.findAll();
    const chatsMap: Record<string, typeof chats[0]> = {};
    for (const chat of chats) {
      chatsMap[chat.id] = chat;
    }

    // 加载 messages
    const msgRepo = new MessageRepository(db);
    const messagesMap: Record<string, any[]> = {};
    for (const chat of chats) {
      const msgs = msgRepo.findByChat(chat.id);
      if (msgs.length > 0) {
        messagesMap[chat.id] = msgs;
      }
    }

    // Hydrate store
    useAppStore.setState({
      agents: agentsMap,
      chats: chatsMap,
      messages: messagesMap,
    });

    console.log(`[Workflow API] Store 已加载: ${agents.length} agents, ${chats.length} chats`);
  } catch (err) {
    console.error('[Workflow API] Store hydrate 失败:', err);
  }
}

export async function POST(request: NextRequest) {
  try {
    // 确保 store 已从数据库加载
    await ensureStoreHydrated();

    const body = await request.json();
    const { action, params } = body;

    switch (action) {
      case 'executeAgent': {
        const { agentId, message, chatId } = params;

        // 验证 agent 存在
        const store = useAppStore.getState();
        const agent = store.agents[agentId];
        if (!agent) {
          console.error('[Workflow API] Agent 不存在:', agentId);
          return NextResponse.json({ success: false, error: `Agent ${agentId} 不存在` }, { status: 404 });
        }

        await workflowEngine.executeAgent(agentId, message, chatId);
        return NextResponse.json({ success: true });
      }

      case 'assignTask': {
        const { taskTitle, taskDescription, assigneeId, chatId, priority, deadline } = params;
        const result = await workflowEngine.assignTask(
          taskTitle, taskDescription, assigneeId, chatId, priority, deadline
        );
        return NextResponse.json({ success: true, data: result });
      }

      case 'runScript': {
        const { scriptId, chatId, replacements } = params;
        await workflowEngine.runScript(scriptId, chatId, replacements);
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('[Workflow API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal error' },
      { status: 500 }
    );
  }
}
