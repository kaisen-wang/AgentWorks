import { NextRequest, NextResponse } from "next/server";

// Agent API Routes - 代理 CRUD 操作
// 前端通过 Zustand store 直接操作，API 层提供持久化同步接口

export async function GET() {
  // 返回所有 Agent 列表
  // 当前 MVP 阶段，数据存储在 Zustand + localStorage
  // 后续可切换到 SQLite 后端
  return NextResponse.json({ message: "Agent list - use client-side store" });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, role, parentId, capabilities, config } = body;

    if (!name || !role) {
      return NextResponse.json(
        { error: "缺少必填字段: name, role" },
        { status: 400 }
      );
    }

    // 返回创建指令，前端 store 负责实际创建
    return NextResponse.json({
      action: "create_agent",
      data: { name, role, parentId: parentId || null, capabilities: capabilities || [], config: config || {} },
    });
  } catch {
    return NextResponse.json({ error: "无效的请求体" }, { status: 400 });
  }
}
