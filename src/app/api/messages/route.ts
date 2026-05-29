import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/database";
import { MessageRepository } from "@/lib/db/messageRepo";
import { v4 as uuidv4 } from "uuid";
import type { Message, MessageType } from "@/types";

/**
 * GET /api/messages - 获取消息列表
 */
export async function GET(request: NextRequest) {
  try {
    const chatId = request.nextUrl.searchParams.get("chatId");
    if (!chatId) {
      return NextResponse.json({ error: "缺少 chatId 参数" }, { status: 400 });
    }

    const db = getDb();
    const repo = new MessageRepository(db);
    const messages = repo.findByChat(chatId);

    return NextResponse.json({ chatId, messages });
  } catch (error) {
    console.error("获取消息失败:", error);
    return NextResponse.json({ messages: [], error: "数据库错误" }, { status: 500 });
  }
}

/**
 * POST /api/messages - 发送消息
 */
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

    const db = getDb();
    const repo = new MessageRepository(db);

    const message: Message = {
      id: uuidv4(),
      chatId,
      type: type as MessageType,
      senderId: senderId as any,
      content,
      replyToId: extra?.replyToId,
      timestamp: Date.now(),
    };

    repo.create(message);

    return NextResponse.json({ success: true, message });
  } catch (error) {
    console.error("发送消息失败:", error);
    return NextResponse.json({ error: "发送失败" }, { status: 500 });
  }
}

/**
 * DELETE /api/messages - 删除消息
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "缺少消息 ID" }, { status: 400 });
    }

    const db = getDb();
    const repo = new MessageRepository(db);
    repo.delete(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("删除消息失败:", error);
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}
