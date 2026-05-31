/**
 * Transcript 数据访问层
 *
 * 持久化 AgentLoop 的 transcript（完整对话历史），
 * 用于重启后恢复 LLM 的对话上下文。
 */

import Database from 'better-sqlite3';
import type { AgentId, ChatId } from '@/types';
import type { AgentMessage } from '@/lib/agent-loop/types';
import type { ToolCall } from '@/lib/llm';

/** Transcript 数据库记录 */
export interface TranscriptRecord {
  id: string;
  agent_id: string;
  chat_id: string;
  role: string;
  content: string;
  thinking: string | null;
  tool_calls: string | null;
  tool_call_id: string | null;
  tool_name: string | null;
  is_error: number;
  seq: number;
  created_at: number;
}

export class TranscriptRepository {
  constructor(private db: Database.Database) {}

  /**
   * 保存完整的 transcript（先删除旧的，再批量插入）
   */
  saveTranscript(agentId: AgentId, chatId: ChatId, messages: AgentMessage[]): void {
    const deleteStmt = this.db.prepare(
      'DELETE FROM transcripts WHERE agent_id = ? AND chat_id = ?'
    );
    const insertStmt = this.db.prepare(`
      INSERT INTO transcripts (
        id, agent_id, chat_id, role, content, thinking,
        tool_calls, tool_call_id, tool_name, is_error, seq, created_at
      ) VALUES (
        @id, @agentId, @chatId, @role, @content, @thinking,
        @toolCalls, @toolCallId, @toolName, @isError, @seq, @createdAt
      )
    `);

    const transaction = this.db.transaction(() => {
      deleteStmt.run(agentId, chatId);
      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        insertStmt.run({
          id: msg.id,
          agentId,
          chatId,
          role: msg.role,
          content: msg.content,
          thinking: msg.thinking || null,
          toolCalls: msg.toolCalls ? JSON.stringify(msg.toolCalls) : null,
          toolCallId: msg.toolCallId || null,
          toolName: msg.toolName || null,
          isError: msg.isError ? 1 : 0,
          seq: i,
          createdAt: msg.timestamp,
        });
      }
    });

    transaction();
  }

  /**
   * 追加单条 transcript 消息
   */
  appendMessage(agentId: AgentId, chatId: ChatId, msg: AgentMessage, seq: number): void {
    const stmt = this.db.prepare(`
      INSERT INTO transcripts (
        id, agent_id, chat_id, role, content, thinking,
        tool_calls, tool_call_id, tool_name, is_error, seq, created_at
      ) VALUES (
        @id, @agentId, @chatId, @role, @content, @thinking,
        @toolCalls, @toolCallId, @toolName, @isError, @seq, @createdAt
      )
    `);

    stmt.run({
      id: msg.id,
      agentId,
      chatId,
      role: msg.role,
      content: msg.content,
      thinking: msg.thinking || null,
      toolCalls: msg.toolCalls ? JSON.stringify(msg.toolCalls) : null,
      toolCallId: msg.toolCallId || null,
      toolName: msg.toolName || null,
      isError: msg.isError ? 1 : 0,
      seq,
      createdAt: msg.timestamp,
    });
  }

  /**
   * 加载指定 Agent 和 Chat 的 transcript
   */
  loadTranscript(agentId: AgentId, chatId: ChatId): AgentMessage[] {
    const stmt = this.db.prepare(`
      SELECT * FROM transcripts
      WHERE agent_id = ? AND chat_id = ?
      ORDER BY seq ASC
    `);
    const rows = stmt.all(agentId, chatId) as TranscriptRecord[];
    return rows.map(row => this.mapRowToAgentMessage(row));
  }

  /**
   * 获取指定 Agent 和 Chat 的 transcript 消息数量
   */
  getTranscriptCount(agentId: AgentId, chatId: ChatId): number {
    const stmt = this.db.prepare(
      'SELECT COUNT(*) as count FROM transcripts WHERE agent_id = ? AND chat_id = ?'
    );
    const row = stmt.get(agentId, chatId) as { count: number };
    return row.count;
  }

  /**
   * 获取指定 Agent 和 Chat 的下一个 seq 值
   */
  getNextSeq(agentId: AgentId, chatId: ChatId): number {
    const stmt = this.db.prepare(
      'SELECT MAX(seq) as maxSeq FROM transcripts WHERE agent_id = ? AND chat_id = ?'
    );
    const row = stmt.get(agentId, chatId) as { maxSeq: number | null };
    return (row.maxSeq ?? -1) + 1;
  }

  /**
   * 删除指定 Agent 和 Chat 的 transcript
   */
  deleteTranscript(agentId: AgentId, chatId: ChatId): void {
    const stmt = this.db.prepare(
      'DELETE FROM transcripts WHERE agent_id = ? AND chat_id = ?'
    );
    stmt.run(agentId, chatId);
  }

  /**
   * 映射数据库行到 AgentMessage
   */
  private mapRowToAgentMessage(row: TranscriptRecord): AgentMessage {
    return {
      id: row.id,
      role: row.role as AgentMessage['role'],
      content: row.content,
      thinking: row.thinking || undefined,
      toolCalls: row.tool_calls ? JSON.parse(row.tool_calls) as ToolCall[] : undefined,
      toolCallId: row.tool_call_id || undefined,
      toolName: row.tool_name || undefined,
      isError: row.is_error === 1 ? true : undefined,
      timestamp: row.created_at,
    };
  }
}
