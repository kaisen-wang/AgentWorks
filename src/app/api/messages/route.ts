import { NextRequest, NextResponse } from "next/server";

// Messages API Routes - 消息发送与查询

export async function GET(request: NextRequest) {
  const chatId = request.nextUrl.searchParams.get("chatId");
  if (!chatId) {
    return NextResponse.json({ error: "缺少 chatId 参数" }, { status: 400 });
  }
  return NextResponse.json({ chatId, message: "Messages - use client-side store" });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chatId, type, senderId, content, extra } = body;

    if (!chatId || !type || !senderId || !content) {
      return NextResponse.json(
        { error: "缺少必填字段: chatId, type, senderId, content" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      action: "send_message",
      data: { chatId, type, senderId, content, extra: extra || {} },
    });
  } catch {
    return NextResponse.json({ error: "无效的请求体" }, { status: 400 });
  }
}
