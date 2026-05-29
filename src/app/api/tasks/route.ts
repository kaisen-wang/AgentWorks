import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/database";
import { TaskRepository } from "@/lib/db/taskRepo";
import { v4 as uuidv4 } from "uuid";
import type { Task, TaskPriority, TaskStatus } from "@/types";

/**
 * GET /api/tasks - 获取任务列表
 */
export async function GET(request: NextRequest) {
  try {
    const assigneeId = request.nextUrl.searchParams.get("assigneeId");
    const projectId = request.nextUrl.searchParams.get("projectId");
    const status = request.nextUrl.searchParams.get("status");

    const db = getDb();
    const repo = new TaskRepository(db);

    let tasks: Task[];

    if (assigneeId) {
      tasks = repo.findByAssignee(assigneeId);
    } else if (projectId) {
      tasks = repo.findByProject(projectId);
    } else if (status) {
      tasks = repo.findByStatus(status as TaskStatus);
    } else {
      tasks = repo.findAll();
    }

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error("获取任务失败:", error);
    return NextResponse.json({ tasks: [], error: "数据库错误" }, { status: 500 });
  }
}

/**
 * POST /api/tasks - 创建任务
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, assigneeId, chatId, priority = "medium", projectId } = body;

    if (!title || !assigneeId || !chatId) {
      return NextResponse.json(
        { error: "缺少必填字段: title, assigneeId, chatId" },
        { status: 400 }
      );
    }

    const db = getDb();
    const repo = new TaskRepository(db);

    const now = Date.now();
    const task: Task = {
      id: uuidv4(),
      title,
      description: description || "",
      assigneeId,
      subTasks: [],
      status: "pending",
      priority: priority as TaskPriority,
      projectId: projectId || undefined,
      chatId,
      createdAt: now,
      updatedAt: now,
    };

    repo.create(task);

    return NextResponse.json({ success: true, task });
  } catch (error) {
    console.error("创建任务失败:", error);
    return NextResponse.json({ error: "创建失败" }, { status: 500 });
  }
}

/**
 * PUT /api/tasks - 更新任务
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, updates } = body;

    if (!id) {
      return NextResponse.json({ error: "缺少任务 ID" }, { status: 400 });
    }

    const db = getDb();
    const repo = new TaskRepository(db);
    const existing = repo.findById(id);

    if (!existing) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 });
    }

    const updated = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    };

    // 如果状态变为 completed 或 failed，设置 completedAt
    if (updates.status && (updates.status === "completed" || updates.status === "failed")) {
      updated.completedAt = Date.now();
    }

    repo.update(updated);

    return NextResponse.json({ success: true, task: updated });
  } catch (error) {
    console.error("更新任务失败:", error);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}

/**
 * DELETE /api/tasks - 删除任务
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "缺少任务 ID" }, { status: 400 });
    }

    const db = getDb();
    const repo = new TaskRepository(db);
    repo.delete(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("删除任务失败:", error);
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}
