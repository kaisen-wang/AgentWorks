'use server';

/**
 * Chat Server Actions
 * 所有 Chat/Message 操作都在服务器端执行并持久化到数据库
 */

import { getDb } from '@/lib/db/database';
import { ChatRepository } from '@/lib/db/chatRepo';
import { MessageRepository } from '@/lib/db/messageRepo';
import type { Chat, ChatMember, ChatType, Message, MessageType } from '@/types';

/**
 * 获取所有会话
 */
export async function getChats(): Promise<{ chats: Chat[]; error?: string }> {
  try {
    const db = getDb();
    const repo = new ChatRepository(db);
    const chats = repo.findAll();
    return { chats };
  } catch (error) {
    console.error("获取会话失败:", error);
    return { chats: [], error: "数据库错误" };
  }
}

/**
 * 创建会话
 */
export async function createChat(chat: Chat): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getDb();
    const repo = new ChatRepository(db);
    repo.create(chat);
    return { success: true };
  } catch (error) {
    console.error("创建会话失败:", error);
    return { success: false, error: "创建失败" };
  }
}

/**
 * 删除会话（含关联消息）
 */
export async function deleteChat(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getDb();
    const repo = new ChatRepository(db);
    repo.delete(id);
    return { success: true };
  } catch (error) {
    console.error("删除会话失败:", error);
    return { success: false, error: "删除失败" };
  }
}

/**
 * 更新会话
 */
export async function updateChat(chat: Chat): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getDb();
    const repo = new ChatRepository(db);
    repo.update(chat);
    return { success: true };
  } catch (error) {
    console.error("更新会话失败:", error);
    return { success: false, error: "更新失败" };
  }
}

/**
 * 添加成员到会话
 */
export async function addMember(chatId: string, member: ChatMember): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getDb();
    const repo = new ChatRepository(db);
    repo.addMember(chatId, member);
    return { success: true };
  } catch (error) {
    console.error("添加成员失败:", error);
    return { success: false, error: "添加成员失败" };
  }
}

/**
 * 从会话移除成员
 */
export async function removeMember(chatId: string, memberId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getDb();
    const repo = new ChatRepository(db);
    repo.removeMember(chatId, memberId);
    return { success: true };
  } catch (error) {
    console.error("移除成员失败:", error);
    return { success: false, error: "移除成员失败" };
  }
}

/**
 * 获取指定会话的所有消息
 */
export async function getMessages(chatId: string): Promise<{ messages: Message[]; error?: string }> {
  try {
    const db = getDb();
    const repo = new MessageRepository(db);
    const messages = repo.findByChat(chatId);
    return { messages };
  } catch (error) {
    console.error("获取消息失败:", error);
    return { messages: [], error: "数据库错误" };
  }
}

/**
 * 创建消息
 */
export async function createMessage(message: Message): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getDb();
    const repo = new MessageRepository(db);
    repo.create(message);
    return { success: true };
  } catch (error) {
    console.error("创建消息失败:", error);
    return { success: false, error: "创建失败" };
  }
}
