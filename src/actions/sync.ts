'use server';

/**
 * Sync Server Action
 * 从SQLite加载所有数据
 */

import { getDb } from '@/lib/db/database';
import { AgentRepository } from '@/lib/db/agentRepo';
import { TaskRepository } from '@/lib/db/taskRepo';
import { ChatRepository } from '@/lib/db/chatRepo';

/**
 * 从SQLite加载所有数据
 */
export async function syncData(): Promise<{
  agents: any[];
  projects: any[];
  tasks: any[];
  chats: any[];
  error?: string;
}> {
  try {
    const db = getDb();
    const agentRepo = new AgentRepository(db);
    const taskRepo = new TaskRepository(db);
    const chatRepo = new ChatRepository(db);

    // 获取所有数据
    const agents = agentRepo.findAll();
    const tasks = taskRepo.findAll();
    const chats = chatRepo.findAll();

    // 获取项目列表
    const projects = db.prepare("SELECT * FROM projects ORDER BY created_at ASC").all();

    return { 
      agents, 
      projects, 
      tasks,
      chats 
    };
  } catch (error) {
    console.error("同步数据失败:", error);
    return { 
      agents: [], 
      projects: [], 
      tasks: [],
      chats: [],
      error: "数据库错误" 
    };
  }
}
