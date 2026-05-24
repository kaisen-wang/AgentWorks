import { NextRequest, NextResponse } from "next/server";

// Messages API Routes - 消息发送与查询，操作 SQLite

export async function GET(request: NextRequest) {
  const chatId = request.nextUrl.searchParams.get("chatId");
  if (!chatId) {
    return NextResponse.json({ error: "缺少 chatId 参数" }, { status: 400 });
  }

  try {
    const { getDb } = await import("@/lib/db/database");
    const db = getDb();
    const messages = db.prepare(
      "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC"
    ).all(chatId);
    return NextResponse.json({ chatId, messages });
  } catch {
    return NextResponse.json({ chatId, messages: [], fallback: true });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chatId, type, senderId, content, extra, messageId } = body;

    if (!chatId || !type || !senderId || !content) {
      return NextResponse.json(
        { error: "缺少必填字段: chatId, type, senderId, content" },
        { status: 400 }
      );
    }

    try {
      const { getDb } = await import("@/lib/db/database");
      const db = getDb();
      const id = messageId || `msg_${Date.now()}`;
      const now = Date.now();

      db.prepare(`
        INSERT INTO messages (message_id, conversation_id, sender_id, sender_type, message_type, content, reply_to, is_cross_department, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, chatId, senderId,
        senderId === "user" ? "user" : senderId === "system" ? "system" : "agent",
        type, content,
        extra?.replyToId || null,
        extra?.isCrossDepartment ? 1 : 0,
        now
      );

      return NextResponse.json({ success: true, messageId: id });
    } catch {
      return NextResponse.json({
        action: "send_message",
        data: { chatId, type, senderId, content, extra: extra || {} },
        fallback: true,
      });
    }
  } catch {
    return NextResponse.json({ error: "无效的请求体" }, { status: 400 });
  }
}
