/**
 * OpenAIClientFactory - OpenAI 客户端工厂
 *
 * 管理客户端实例的创建和复用，基于配置的缓存键实现实例复用。
 * 相同配置返回同一实例，不同配置创建新实例。
 */

import OpenAI from "openai";
import type { LLMConfig } from "./LLMService";

/** 客户端实例记录 */
interface ClientEntry {
  client: OpenAI;
  createdAt: number;
}

/** 默认最大重试次数 */
const DEFAULT_MAX_RETRIES = 2;

/**
 * 生成缓存键
 *
 * 使用 endpoint + apiKey + model 的组合作为缓存键，
 * 避免相同配置重复创建客户端实例。
 */
function generateCacheKey(config: LLMConfig): string {
  return `${config.endpoint}::${config.apiKey}::${config.model}`;
}

/**
 * OpenAI 客户端工厂
 *
 * 使用静态 Map 缓存客户端实例，基于配置哈希键实现相同配置的实例复用。
 */
export class OpenAIClientFactory {
  private static clientCache = new Map<string, ClientEntry>();

  /**
   * 获取或创建 OpenAI 客户端实例
   *
   * 相同配置返回同一实例（基于 cacheKey 判断）。
   * 不同配置创建新实例并缓存。
   *
   * @throws {Error} 当 apiKey 为空时抛出配置错误
   */
  static getClient(config: LLMConfig): OpenAI {
    if (!config.apiKey) {
      throw new Error("LLM 配置错误: apiKey 不能为空");
    }

    const cacheKey = generateCacheKey(config);

    // 缓存命中则返回已有实例
    const cached = this.clientCache.get(cacheKey);
    if (cached) {
      return cached.client;
    }

    // 从环境变量获取 maxRetries，默认 2
    const maxRetries = parseInt(
      process.env.OPENAI_MAX_RETRIES ?? String(DEFAULT_MAX_RETRIES),
      10,
    );
    const effectiveMaxRetries = isNaN(maxRetries) ? DEFAULT_MAX_RETRIES : maxRetries;

    // 创建新实例
    const client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.endpoint,
      timeout: config.timeout,
      maxRetries: effectiveMaxRetries,
    });

    // 缓存实例
    this.clientCache.set(cacheKey, {
      client,
      createdAt: Date.now(),
    });

    return client;
  }

  /**
   * 清理指定配置的客户端实例
   */
  static disposeClient(cacheKey: string): void {
    this.clientCache.delete(cacheKey);
  }

  /**
   * 清理所有客户端实例
   */
  static disposeAll(): void {
    this.clientCache.clear();
  }

  /**
   * 获取当前缓存的客户端数量（用于测试和调试）
   */
  static get cacheSize(): number {
    return this.clientCache.size;
  }
}
