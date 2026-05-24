import { NextRequest, NextResponse } from "next/server";

// Chat API Routes - 会话管理，操作 SQLite

export async function GET() {
  try {
    const { getDb } = await import("@/lib/db/database");
    const db = getDb();
    const conversations = db.prepare("SELECT * FROM conversations ORDER BY created_at DESC").all();
    return NextResponse.json({ conversations });
  } catch {
    return NextResponse.json({ conversations: [], fallback: true });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, name, members, conversationId, projectId } = body;

    if (!type || !name || !members) {
      return NextResponse.json(
        { error: "缺少必填字段: type, name, members" },
        { status: 400 }
      );
    }

    try {
      const { getDb } = await import("@/lib/db/database");
      const db = getDb();
      const id = conversationId || `chat_${Date.now()}`;
      const now = Date.now();

      db.prepare(`
        INSERT INTO conversations (conversation_id, type, project_id, members, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, type, projectId || null, JSON.stringify(members), now);

      return NextResponse.json({ success: true, conversationId: id });
    } catch {
      return NextResponse.json({
        action: "create_chat",
        data: { type, name, members },
        fallback: true,
      });
    }
  } catch {
    return NextResponse.json({ error: "无效的请求体" }, { status: 400 });
  }
}
