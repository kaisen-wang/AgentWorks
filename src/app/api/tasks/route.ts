import { NextRequest, NextResponse } from "next/server";

// Tasks API Routes - 任务管理

export async function GET(request: NextRequest) {
  const assigneeId = request.nextUrl.searchParams.get("assigneeId");
  const projectId = request.nextUrl.searchParams.get("projectId");
  return NextResponse.json({
    assigneeId,
    projectId,
    message: "Tasks - use client-side store",
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, assigneeId, chatId, priority, deadline } = body;

    if (!title || !assigneeId || !chatId) {
      return NextResponse.json(
        { error: "缺少必填字段: title, assigneeId, chatId" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      action: "create_task",
      data: {
        title,
        description: description || "",
        assigneeId,
        chatId,
        priority: priority || "medium",
        deadline,
      },
    });
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

    return NextResponse.json({
      action: "update_task",
      data: { taskId, status, priority, assigneeId },
    });
  } catch {
    return NextResponse.json({ error: "无效的请求体" }, { status: 400 });
  }
}
