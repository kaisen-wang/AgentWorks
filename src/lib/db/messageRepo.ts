/**
 * Message 数据访问层
 */

import Database from 'better-sqlite3';
import type { MessageId, ChatId, Message, MessageType } from '@/types';

/** Message 数据库记录 */
export interface MessageRecord {
  message_id: string;
  conversation_id: string;
  sender_id: string;
  sender_type: string;
  message_type: string;
  content: string;
  reply_to: string | null;
  is_cross_department: number;
  created_at: number;
}

/** MessageRepository 接口 */
export interface IMessageRepository {
  findByChat(chatId: ChatId): Message[];
  findById(id: MessageId): Message | undefined;
  create(message: Message): void;
  delete(id: MessageId): void;
}

export class MessageRepository implements IMessageRepository {
  constructor(private db: Database.Database) {}

  /**
   * 根据会话查找消息
   */
  findByChat(chatId: ChatId): Message[] {
    const stmt = this.db.prepare(`
      SELECT * FROM messages 
      WHERE conversation_id = ? 
      ORDER BY created_at ASC
    `);
    const rows = stmt.all(chatId) as MessageRecord[];
    return rows.map(row => this.mapRowToMessage(row));
  }

  /**
   * 根据 ID 查找消息
   */
  findById(id: MessageId): Message | undefined {
    const stmt = this.db.prepare('SELECT * FROM messages WHERE message_id = ?');
    const row = stmt.get(id) as MessageRecord | undefined;
    return row ? this.mapRowToMessage(row) : undefined;
  }

  /**
   * 创建消息
   */
  create(message: Message): void {
    const stmt = this.db.prepare(`
      INSERT INTO messages (
        message_id, conversation_id, sender_id, sender_type,
        message_type, content, reply_to, is_cross_department, created_at
      ) VALUES (
        @messageId, @conversationId, @senderId, @senderType,
        @messageType, @content, @replyTo, @isCrossDepartment, @createdAt
      )
    `);

    const record = this.mapMessageToRecord(message);
    stmt.run(record);
  }

  /**
   * 删除消息
   */
  delete(id: MessageId): void {
    const stmt = this.db.prepare('DELETE FROM messages WHERE message_id = ?');
    stmt.run(id);
  }

  /**
   * 映射数据库行到 Message 对象
   */
  private mapRowToMessage(row: MessageRecord): Message {
    return {
      id: row.message_id,
      chatId: row.conversation_id,
      type: row.message_type as MessageType,
      senderId: row.sender_id as any,
      content: row.content,
      replyToId: row.reply_to || undefined,
      timestamp: row.created_at,
    };
  }

  /**
   * 映射 Message 对象到数据库记录
   */
  private mapMessageToRecord(message: Message): any {
    return {
      messageId: message.id,
      conversationId: message.chatId,
      senderId: message.senderId,
      senderType: message.senderId === 'user' ? 'user' : 'agent',
      messageType: message.type,
      content: message.content,
      replyTo: message.replyToId || null,
      isCrossDepartment: 0,
      createdAt: message.timestamp,
    };
  }
}
