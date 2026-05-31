/**
 * ContextRestorer - 上下文恢复服务
 *
 * 重启后从数据库加载 transcript，恢复 LLM 的对话上下文。
 * 当 transcript 超过 token 阈值时，自动压缩为摘要 + 最近 N 条消息。
 *
 * 注意：此模块使用动态 import 访问数据库，避免 better-sqlite3 被打包进客户端 bundle。
 */

import type { AgentId, ChatId } from '@/types';
import type { AgentMessage } from './types';

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
 * 找到安全的截断位置，确保不会破坏 assistant(tool_calls) + tool 消息的配对关系。
 *
 * OpenAI API 要求：
 * 1. assistant 消息包含 tool_calls 时，后面必须紧跟对应的 tool 消息
 * 2. tool 消息前面必须有包含对应 tool_call_id 的 assistant 消息
 *
 * 因此截断位置不能：
 * - 在 assistant(tool_calls) 和其第一个 tool 消息之间
 * - 在连续的 tool 消息中间（如果它们属于同一个 assistant 的 tool_calls）
 * - 让 recentMessages 以孤立的 tool 消息开头
 */
function findSafeSplitIndex(messages: AgentMessage[], initialIndex: number): number {
  if (initialIndex <= 0 || initialIndex >= messages.length) {
    return initialIndex;
  }

  let idx = initialIndex;

  // 情况1：splitIndex 处的消息是 tool 消息
  // 这意味着它可能是一个 assistant(tool_calls) 的响应，
  // 需要向前找到对应的 assistant 消息，把整个配对组都放入 recentMessages
  if (messages[idx].role === 'tool') {
    // 收集从 idx 开始的所有连续 tool 消息的 tool_call_id
    const toolCallIds = new Set<string>();
    let scanIdx = idx;
    while (scanIdx < messages.length && messages[scanIdx].role === 'tool') {
      if (messages[scanIdx].toolCallId) {
        toolCallIds.add(messages[scanIdx].toolCallId!);
      }
      scanIdx++;
    }

    // 向前查找包含这些 tool_call_id 的 assistant 消息
    for (let i = idx - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
        const hasMatch = msg.toolCalls.some(tc => toolCallIds.has(tc.id));
        if (hasMatch) {
          idx = i;
          break;
        }
      }
      // 如果遇到非 tool/非 assistant(tool_calls) 消息，停止向前搜索
      if (msg.role !== 'assistant' && msg.role !== 'tool') {
        break;
      }
    }
  }

  // 情况2：splitIndex-1 处是 assistant(tool_calls) 消息，但 splitIndex 处不是对应的 tool 消息
  // 这意味着截断位置在 assistant(tool_calls) 和其 tool 响应之间
  if (idx > 0) {
    const prevMsg = messages[idx - 1];
    if (prevMsg.role === 'assistant' && prevMsg.toolCalls && prevMsg.toolCalls.length > 0) {
      // assistant(tool_calls) 必须和其 tool 响应在同一分区
      // 把 splitIndex 移到 assistant 消息之前
      idx = idx - 1;
    }
  }

  // 递归检查：调整后可能又产生了新的问题（如 idx 处现在是 tool 消息）
  // 但只递归一次避免无限循环
  if (idx !== initialIndex && idx > 0 && messages[idx].role === 'tool') {
    // 再次向前查找
    for (let i = idx - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
        const toolMsg = messages[idx];
        if (toolMsg.toolCallId && msg.toolCalls.some(tc => tc.id === toolMsg.toolCallId)) {
          idx = i;
          break;
        }
      }
      if (msg.role !== 'assistant' && msg.role !== 'tool') {
        break;
      }
    }
  }

  return idx;
}

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
 * 使用动态 import 访问数据库，避免 better-sqlite3 被打包进客户端 bundle。
 *
 * @returns 恢复的 AgentMessage[]，可直接作为 AgentLoop 的 initialTranscript
 */
export async function restoreContext(
  agentId: AgentId,
  chatId: ChatId,
  config?: ContextRestoreConfig,
): Promise<AgentMessage[]> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // 动态 import 避免 better-sqlite3 进入客户端 bundle
  const { getDb } = await import('@/lib/db/database');
  const { TranscriptRepository } = await import('@/lib/db/transcriptRepo');

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
  // 关键：必须保证 assistant(tool_calls) 和对应的 tool 消息在同一个分区，
  // 否则 OpenAI API 会报错 "insufficient tool messages following tool_calls message"
  let splitIndex = Math.max(0, transcript.length - cfg.recentMessageCount);

  // 向前调整 splitIndex，确保不会在 assistant(tool_calls) 和其 tool 消息之间截断
  // 也不会让 recentMessages 以孤立的 tool 消息开头
  splitIndex = findSafeSplitIndex(transcript, splitIndex);

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
export async function getTranscriptStats(
  agentId: AgentId,
  chatId: ChatId,
): Promise<{ messageCount: number; tokenEstimate: number }> {
  const { getDb } = await import('@/lib/db/database');
  const { TranscriptRepository } = await import('@/lib/db/transcriptRepo');
  const db = getDb();
  const repo = new TranscriptRepository(db);
  const transcript = repo.loadTranscript(agentId, chatId);
  return {
    messageCount: transcript.length,
    tokenEstimate: estimateTokens(transcript, DEFAULT_CONFIG.tokensPerChar),
  };
}
