import { NextRequest, NextResponse } from "next/server";

// Tasks API Routes - 任务管理，操作 SQLite

export async function GET(request: NextRequest) {
  const assigneeId = request.nextUrl.searchParams.get("assigneeId");
  const projectId = request.nextUrl.searchParams.get("projectId");

  try {
    const { getTasksByAssignee } = await import("@/lib/db/taskRepo");
    if (assigneeId) {
      const tasks = getTasksByAssignee(assigneeId, projectId || null);
      return NextResponse.json({ tasks });
    }
    // 无 assigneeId 时返回所有任务
    const { getDb } = await import("@/lib/db/database");
    const db = getDb();
    const tasks = db.prepare("SELECT * FROM tasks ORDER BY priority DESC, created_at ASC").all();
    return NextResponse.json({ tasks });
  } catch {
    return NextResponse.json({ tasks: [], fallback: true });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, assigneeId, chatId, priority, deadline, taskId, projectId } = body;

    if (!title || !assigneeId || !chatId) {
      return NextResponse.json(
        { error: "缺少必填字段: title, assigneeId, chatId" },
        { status: 400 }
      );
    }

    try {
      const { createTask } = await import("@/lib/db/taskRepo");
      const id = taskId || `task_${Date.now()}`;
      createTask({
        taskId: id,
        title,
        description: description || "",
        assigneeId,
        projectId: projectId || null,
        priority: priority || "medium",
        chatId,
      });

      return NextResponse.json({ success: true, taskId: id });
    } catch {
      return NextResponse.json({
        action: "create_task",
        data: { title, description: description || "", assigneeId, chatId, priority: priority || "medium", deadline },
        fallback: true,
      });
    }
  } catch {
    return NextResponse.json({ error: "无效的请求体" }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, status, priority, assigneeId } = body;

    if (!taskId) {
      return NextResponse.json({ error: "缺少 taskId" }, { status: 400 });
    }

    try {
      const { updateTaskStatus, updateTaskPriority, reassignTask } = await import("@/lib/db/taskRepo");

      if (status) {
        const completedAt = (status === "completed" || status === "failed") ? Date.now() : undefined;
        updateTaskStatus(taskId, status, completedAt);
      }
      if (priority) {
        updateTaskPriority(taskId, priority);
      }
      if (assigneeId) {
        reassignTask(taskId, assigneeId);
      }

      return NextResponse.json({ success: true, taskId });
    } catch {
      return NextResponse.json({
        action: "update_task",
        data: { taskId, status, priority, assigneeId },
        fallback: true,
      });
    }
  } catch {
    return NextResponse.json({ error: "无效的请求体" }, { status: 400 });
  }
}
