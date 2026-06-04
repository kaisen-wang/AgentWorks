import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/database";
import { ChatRepository } from "@/lib/db/chatRepo";
import type { ChatMember } from "@/types";

/**
 * POST /api/chat/members - 添加成员到会话
 * Body: { chatId: string, member: ChatMember }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chatId, member } = body;

    if (!chatId || !member) {
      return NextResponse.json(
        { error: "缺少必填字段: chatId, member" },
        { status: 400 }
      );
    }

    const db = getDb();
    const repo = new ChatRepository(db);
    const chat = repo.findById(chatId);

    if (!chat) {
      return NextResponse.json({ error: "会话不存在" }, { status: 404 });
    }

    // 去重检查
    if (chat.members.some((m) => m.id === (member as ChatMember).id)) {
      return NextResponse.json({ error: "成员已存在" }, { status: 409 });
    }

    repo.addMember(chatId, member as ChatMember);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("添加成员失败:", error);
    return NextResponse.json({ error: "添加成员失败" }, { status: 500 });
  }
}

/**
 * DELETE /api/chat/members - 从会话移除成员
 * Query: ?chatId=xxx&memberId=xxx
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get("chatId");
    const memberId = searchParams.get("memberId");

    if (!chatId || !memberId) {
      return NextResponse.json(
        { error: "缺少必填参数: chatId, memberId" },
        { status: 400 }
      );
    }

    const db = getDb();
    const repo = new ChatRepository(db);
    const chat = repo.findById(chatId);

    if (!chat) {
      return NextResponse.json({ error: "会话不存在" }, { status: 404 });
    }

    repo.removeMember(chatId, memberId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("移除成员失败:", error);
    return NextResponse.json({ error: "移除成员失败" }, { status: 500 });
  }
}
