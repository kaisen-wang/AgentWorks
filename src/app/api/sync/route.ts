import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/database";
import { AgentRepository } from "@/lib/db/agentRepo";
import { TaskRepository } from "@/lib/db/taskRepo";
import { ChatRepository } from "@/lib/db/chatRepo";

/**
 * GET /api/sync - 从 SQLite 读取所有数据
 * 简化为纯查询接口，不再支持POST同步
 */
export async function GET() {
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

    return NextResponse.json({
      agents,
      projects,
      tasks,
      chats
    });
  } catch (error) {
    console.error("获取同步数据失败:", error);
    return NextResponse.json({
      agents: [],
      projects: [],
      tasks: [],
      chats: [],
      error: "数据库错误"
    }, { status: 500 });
  }
}
