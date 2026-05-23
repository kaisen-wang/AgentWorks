import { NextRequest, NextResponse } from "next/server";

// Chat API Routes - 会话管理

export async function GET() {
  return NextResponse.json({ message: "Chat list - use client-side store" });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, name, members } = body;

    if (!type || !name || !members) {
      return NextResponse.json(
        { error: "缺少必填字段: type, name, members" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      action: "create_chat",
      data: { type, name, members },
    });
  } catch {
    return NextResponse.json({ error: "无效的请求体" }, { status: 400 });
  }
}
