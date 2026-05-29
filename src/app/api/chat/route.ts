import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/database";
import { ChatRepository } from "@/lib/db/chatRepo";
import { v4 as uuidv4 } from "uuid";
import type { Chat, ChatMember, ChatType } from "@/types";

/**
 * GET /api/chat - 获取所有会话
 */
export async function GET() {
  try {
    const db = getDb();
    const repo = new ChatRepository(db);
    const chats = repo.findAll();
    return NextResponse.json({ chats });
  } catch (error) {
    console.error("获取会话失败:", error);
    return NextResponse.json({ chats: [], error: "数据库错误" }, { status: 500 });
  }
}

/**
 * POST /api/chat - 创建会话
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, name, members, projectId } = body;

    if (!type || !name || !members) {
      return NextResponse.json(
        { error: "缺少必填字段: type, name, members" },
        { status: 400 }
      );
    }

    const db = getDb();
    const repo = new ChatRepository(db);

    const chat: Chat = {
      id: uuidv4(),
      type: type as ChatType,
      name,
      members: members as ChatMember[],
      createdAt: Date.now(),
    };

    repo.create(chat);

    return NextResponse.json({ success: true, chat });
  } catch (error) {
    console.error("创建会话失败:", error);
    return NextResponse.json({ error: "创建失败" }, { status: 500 });
  }
}

/**
 * PUT /api/chat - 更新会话
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, updates } = body;

    if (!id) {
      return NextResponse.json({ error: "缺少会话 ID" }, { status: 400 });
    }

    const db = getDb();
    const repo = new ChatRepository(db);
    const existing = repo.findById(id);

    if (!existing) {
      return NextResponse.json({ error: "会话不存在" }, { status: 404 });
    }

    const updated = {
      ...existing,
      ...updates,
    };

    repo.update(updated);

    return NextResponse.json({ success: true, chat: updated });
  } catch (error) {
    console.error("更新会话失败:", error);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}

/**
 * DELETE /api/chat - 删除会话
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "缺少会话 ID" }, { status: 400 });
    }

    const db = getDb();
    const repo = new ChatRepository(db);
    repo.delete(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("删除会话失败:", error);
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}
