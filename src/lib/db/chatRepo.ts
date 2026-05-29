/**
 * Chat 数据访问层
 */

import Database from 'better-sqlite3';
import type { ChatId, Chat, ChatMember, ChatType } from '@/types';

/** Chat 数据库记录 */
export interface ChatRecord {
  conversation_id: string;
  type: string;
  project_id: string | null;
  members: string;
  created_at: number;
}

/** ChatRepository 接口 */
export interface IChatRepository {
  findAll(): Chat[];
  findById(id: ChatId): Chat | undefined;
  findByProject(projectId: string): Chat[];
  create(chat: Chat): void;
  update(chat: Chat): void;
  delete(id: ChatId): void;
  addMember(chatId: ChatId, member: ChatMember): void;
  removeMember(chatId: ChatId, memberId: string): void;
}

export class ChatRepository implements IChatRepository {
  constructor(private db: Database.Database) {}

  /**
   * 查找所有 Chats
   */
  findAll(): Chat[] {
    const stmt = this.db.prepare('SELECT * FROM conversations ORDER BY created_at DESC');
    const rows = stmt.all() as ChatRecord[];
    return rows.map(row => this.mapRowToChat(row));
  }

  /**
   * 根据 ID 查找 Chat
   */
  findById(id: ChatId): Chat | undefined {
    const stmt = this.db.prepare('SELECT * FROM conversations WHERE conversation_id = ?');
    const row = stmt.get(id) as ChatRecord | undefined;
    return row ? this.mapRowToChat(row) : undefined;
  }

  /**
   * 根据项目查找 Chats
   */
  findByProject(projectId: string): Chat[] {
    const stmt = this.db.prepare(`
      SELECT * FROM conversations 
      WHERE project_id = ? 
      ORDER BY created_at DESC
    `);
    const rows = stmt.all(projectId) as ChatRecord[];
    return rows.map(row => this.mapRowToChat(row));
  }

  /**
   * 创建 Chat
   */
  create(chat: Chat): void {
    const stmt = this.db.prepare(`
      INSERT INTO conversations (
        conversation_id, type, project_id, members, created_at
      ) VALUES (
        @conversationId, @type, @projectId, @members, @createdAt
      )
    `);

    const record = this.mapChatToRecord(chat);
    stmt.run(record);
  }

  /**
   * 更新 Chat
   */
  update(chat: Chat): void {
    const stmt = this.db.prepare(`
      UPDATE conversations SET
        type = @type,
        project_id = @projectId,
        members = @members
      WHERE conversation_id = @conversationId
    `);

    const record = this.mapChatToRecord(chat);
    stmt.run(record);
  }

  /**
   * 删除 Chat
   */
  delete(id: ChatId): void {
    const deleteChat = this.db.transaction(() => {
      // 删除关联的消息
      const msgStmt = this.db.prepare('DELETE FROM messages WHERE conversation_id = ?');
      msgStmt.run(id);

      // 删除会话
      const chatStmt = this.db.prepare('DELETE FROM conversations WHERE conversation_id = ?');
      chatStmt.run(id);
    });

    deleteChat();
  }

  /**
   * 添加成员
   */
  addMember(chatId: ChatId, member: ChatMember): void {
    const chat = this.findById(chatId);
    if (!chat) return;

    const members = [...chat.members, member];
    const updatedChat = { ...chat, members };
    this.update(updatedChat);
  }

  /**
   * 移除成员
   */
  removeMember(chatId: ChatId, memberId: string): void {
    const chat = this.findById(chatId);
    if (!chat) return;

    const members = chat.members.filter(m => m.id !== memberId);
    const updatedChat = { ...chat, members };
    this.update(updatedChat);
  }

  /**
   * 映射数据库行到 Chat 对象
   */
  private mapRowToChat(row: ChatRecord): Chat {
    const members: ChatMember[] = JSON.parse(row.members || '[]');

    // 生成会话名称
    const name = members.length > 0 
      ? members.map(m => m.name).join(', ')
      : 'Unknown';

    return {
      id: row.conversation_id,
      type: row.type as ChatType,
      name,
      members,
      createdAt: row.created_at,
    };
  }

  /**
   * 映射 Chat 对象到数据库记录
   */
  private mapChatToRecord(chat: Chat): any {
    return {
      conversationId: chat.id,
      type: chat.type,
      projectId: null, // 暂不支持项目关联
      members: JSON.stringify(chat.members),
      createdAt: chat.createdAt,
    };
  }
}
