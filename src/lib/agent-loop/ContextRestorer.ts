/**
 * ContextRestorer - 上下文恢复服务
 *
 * 重启后从数据库加载 transcript，恢复 LLM 的对话上下文。
 * 当 transcript 超过 token 阈值时，自动压缩为摘要 + 最近 N 条消息。
 */

import type { AgentId, ChatId } from '@/types';
import type { AgentMessage } from './types';
import { TranscriptRepository } from '@/lib/db/transcriptRepo';
import { getDb } from '@/lib/db/database';

/** 上下文恢复配置 */
export interface ContextRestoreConfig {
  /** 最大 token 估算值（超过此值触发压缩），默认 6000 */
  maxTokenEstimate?: number;
  /** 压缩后保留的最近消息条数，默认 6 */
  recentMessageCount?: number;
  /** 每条消息的平均 token 估算（中文约 1.5 token/字，英文约 0.75 token/word），默认 2 token/字符 */
  tokensPerChar?: number;
}

const DEFAULT_CONFIG: Required<ContextRestoreConfig> = {
  maxTokenEstimate: 6000,
  recentMessageCount: 6,
  tokensPerChar: 2,
};

/**
 * 估算 transcript 的 token 数
 */
function estimateTokens(messages: AgentMessage[], tokensPerChar: number): number {
  let totalChars = 0;
  for (const msg of messages) {
    totalChars += msg.content.length;
    if (msg.thinking) totalChars += msg.thinking.length;
    if (msg.toolCalls) {
      for (const tc of msg.toolCalls) {
        totalChars += tc.function.arguments.length;
        totalChars += tc.function.name.length;
      }
    }
  }
  return Math.round(totalChars * tokensPerChar);
}

/**
 * 生成摘要 prompt（将早期消息压缩为一条 system 消息）
 */
function generateSummaryPrompt(earlyMessages: AgentMessage[]): string {
  const parts: string[] = ['[对话历史摘要]'];

  for (const msg of earlyMessages) {
    switch (msg.role) {
      case 'system':
        // system 消息保留完整
        parts.push(`[系统指令] ${msg.content}`);
        break;
      case 'user':
        parts.push(`[用户] ${msg.content.slice(0, 200)}`);
        break;
      case 'assistant':
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          const toolNames = msg.toolCalls.map(tc => tc.function.name).join(', ');
          parts.push(`[助手] 调用了工具: ${toolNames}. ${msg.content.slice(0, 100)}`);
        } else {
          parts.push(`[助手] ${msg.content.slice(0, 200)}`);
        }
        break;
      case 'tool':
        const status = msg.isError ? '失败' : '成功';
        parts.push(`[工具结果:${msg.toolName}] ${status}. ${msg.content.slice(0, 100)}`);
        break;
    }
  }

  parts.push('\n以上是之前的对话历史摘要，请基于此上下文继续对话。');

  return parts.join('\n');
}

/**
 * 从数据库恢复上下文
 *
 * @returns 恢复的 AgentMessage[]，可直接作为 AgentLoop 的 initialTranscript
 */
export function restoreContext(
  agentId: AgentId,
  chatId: ChatId,
  config?: ContextRestoreConfig,
): AgentMessage[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const db = getDb();
  const repo = new TranscriptRepository(db);

  const transcript = repo.loadTranscript(agentId, chatId);

  if (transcript.length === 0) {
    return [];
  }

  // 估算 token 数
  const tokenEstimate = estimateTokens(transcript, cfg.tokensPerChar);

  console.log('[ContextRestorer] 加载 transcript:', {
    agentId,
    chatId,
    messageCount: transcript.length,
    tokenEstimate,
    maxTokenEstimate: cfg.maxTokenEstimate,
  });

  // 未超过阈值，直接返回完整 transcript
  if (tokenEstimate <= cfg.maxTokenEstimate) {
    return transcript;
  }

  // 超过阈值，压缩：摘要 + 最近 N 条消息
  const splitIndex = Math.max(0, transcript.length - cfg.recentMessageCount);
  const earlyMessages = transcript.slice(0, splitIndex);
  const recentMessages = transcript.slice(splitIndex);

  // 保留原始 system prompt（第一条 system 消息）
  const systemMessage = earlyMessages.find(m => m.role === 'system');
  const nonSystemEarly = earlyMessages.filter(m => m.role !== 'system');

  const summaryContent = generateSummaryPrompt(nonSystemEarly);

  // 构建压缩后的 transcript
  const compressed: AgentMessage[] = [];

  if (systemMessage) {
    // 将摘要追加到 system prompt 后面
    compressed.push({
      ...systemMessage,
      content: systemMessage.content + '\n\n' + summaryContent,
    });
  } else {
    compressed.push({
      id: `summary_${Date.now()}`,
      role: 'system',
      content: summaryContent,
      timestamp: Date.now(),
    });
  }

  compressed.push(...recentMessages);

  const compressedTokenEstimate = estimateTokens(compressed, cfg.tokensPerChar);

  console.log('[ContextRestorer] transcript 已压缩:', {
    originalCount: transcript.length,
    originalTokens: tokenEstimate,
    compressedCount: compressed.length,
    compressedTokens: compressedTokenEstimate,
    summaryLength: summaryContent.length,
    recentCount: recentMessages.length,
  });

  return compressed;
}

/**
 * 获取 transcript 的统计信息
 */
export function getTranscriptStats(
  agentId: AgentId,
  chatId: ChatId,
): { messageCount: number; tokenEstimate: number } {
  const db = getDb();
  const repo = new TranscriptRepository(db);
  const transcript = repo.loadTranscript(agentId, chatId);
  return {
    messageCount: transcript.length,
    tokenEstimate: estimateTokens(transcript, DEFAULT_CONFIG.tokensPerChar),
  };
}
