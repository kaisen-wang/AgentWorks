/**
 * 资源池管理实现
 */

import type { AgentId } from '@/types';
import type {
  IResourcePool,
  IGlobalPool,
  IPrivatePool,
  IResourceManager,
  SkillRecord,
  ToolRecord,
} from '@/lib/skills/types';
import type { SkillRepo } from '@/lib/db/skillRepo';
import type { ToolRepo } from '@/lib/db/toolRepo';

/**
 * 资源池基类
 */
export class ResourcePool<T extends { id: string }> implements IResourcePool<T> {
  private cache: Map<string, T> = new Map();
  private maxCacheSize: number;

  constructor(
    protected repo: { insert: (entity: T) => void; findById: (id: string) => T | undefined; findAll: () => T[]; delete: (id: string) => void },
    options?: { maxCacheSize?: number }
  ) {
    this.maxCacheSize = options?.maxCacheSize || 100;
  }

  /**
   * 注册资源
   */
  async register(resource: T): Promise<void> {
    // 持久化到数据库
    this.repo.insert(resource);

    // 更新缓存
    this.updateCache(resource.id, resource);
  }

  /**
   * 注销资源
   */
  async unregister(id: string): Promise<void> {
    // 从数据库删除
    this.repo.delete(id);

    // 从缓存移除
    this.cache.delete(id);
  }

  /**
   * 查找资源
   */
  async find(id: string): Promise<T | undefined> {
    // 先查缓存
    const cached = this.cache.get(id);
    if (cached) {
      return cached;
    }

    // 缓存未命中，查数据库
    const resource = this.repo.findById(id);
    if (resource) {
      this.updateCache(id, resource);
    }

    return resource;
  }

  /**
   * 列出所有资源
   */
  async list(): Promise<T[]> {
    // 直接从数据库查询
    return this.repo.findAll();
  }

  /**
   * 检查资源是否存在
   */
  async exists(id: string): Promise<boolean> {
    const resource = await this.find(id);
    return resource !== undefined;
  }

  /**
   * 更新缓存（LRU 策略）
   */
  private updateCache(id: string, resource: T): void {
    // 如果缓存已满，删除最旧的条目
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(id, resource);
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.cache.clear();
  }
}

/**
 * 全局资源池
 */
export class GlobalResourcePool<T extends { id: string }> extends ResourcePool<T> implements IGlobalPool<T> {
  constructor(
    repo: { insert: (entity: T) => void; findById: (id: string) => T | undefined; findAll: () => T[]; delete: (id: string) => void },
    options?: { maxCacheSize?: number }
  ) {
    super(repo, options);
  }

  /**
   * 克隆资源到私有池
   * 注意：这个方法需要在 ResourceManager 中实现具体逻辑
   */
  async cloneToPrivate(agentId: AgentId, resourceId: string): Promise<T> {
    const resource = await this.find(resourceId);
    if (!resource) {
      throw new Error(`Resource ${resourceId} not found in global pool`);
    }

    // 返回克隆的资源（调用者需要设置新的 ID 和 owner）
    return { ...resource };
  }
}

/**
 * 私有资源池
 */
export class PrivateResourcePool<T extends { id: string; ownerId?: string }> extends ResourcePool<T> implements IPrivatePool<T> {
  constructor(
    repo: {
      insert: (entity: T) => void;
      findById: (id: string) => T | undefined;
      findAll: () => T[];
      delete: (id: string) => void;
      findByOwner: (ownerId: AgentId) => T[];
    },
    options?: { maxCacheSize?: number }
  ) {
    super(repo, options);
  }

  /**
   * 列出所有者的所有资源
   */
  async listByOwner(agentId: AgentId): Promise<T[]> {
    return (this.repo as any).findByOwner(agentId);
  }

  /**
   * 提升资源到全局池
   * 注意：这个方法需要在 ResourceManager 中实现具体逻辑
   */
  async promoteToGlobal(resourceId: string): Promise<T> {
    const resource = await this.find(resourceId);
    if (!resource) {
      throw new Error(`Resource ${resourceId} not found in private pool`);
    }

    // 返回资源（调用者需要清除 owner）
    return { ...resource };
  }
}

/**
 * 资源管理器
 * 统一管理全局和私有资源池
 */
export class ResourceManager<T extends { id: string; ownerId?: string }> implements IResourceManager<T> {
  private globalPool: GlobalResourcePool<T>;
  private privatePool: PrivateResourcePool<T>;

  constructor(
    globalRepo: {
      insert: (entity: T) => void;
      findById: (id: string) => T | undefined;
      findAll: () => T[];
      delete: (id: string) => void;
    },
    privateRepo: {
      insert: (entity: T) => void;
      findById: (id: string) => T | undefined;
      findAll: () => T[];
      delete: (id: string) => void;
      findByOwner: (ownerId: AgentId) => T[];
    },
    options?: { maxCacheSize?: number }
  ) {
    this.globalPool = new GlobalResourcePool(globalRepo, options);
    this.privatePool = new PrivateResourcePool(privateRepo, options);
  }

  /**
   * 注册全局资源
   */
  async registerGlobal(resource: T): Promise<void> {
    // 确保没有 owner
    const globalResource = { ...resource, ownerId: undefined };
    await this.globalPool.register(globalResource);
  }

  /**
   * 注册私有资源
   */
  async registerPrivate(agentId: AgentId, resource: T): Promise<void> {
    // 设置 owner
    const privateResource = { ...resource, ownerId: agentId };
    await this.privatePool.register(privateResource);
  }

  /**
   * 查找资源（私有优先）
   */
  async find(agentId: AgentId, resourceId: string): Promise<T | undefined> {
    // 先查私有池
    const privateResource = await this.privatePool.find(resourceId);
    if (privateResource && privateResource.ownerId === agentId) {
      return privateResource;
    }

    // 再查全局池
    return await this.globalPool.find(resourceId);
  }

  /**
   * 列出可访问的所有资源
   */
  async listAccessible(agentId: AgentId): Promise<T[]> {
    // 获取全局资源
    const globalResources = await this.globalPool.list();

    // 获取私有资源
    const privateResources = await this.privatePool.listByOwner(agentId);

    // 合并（私有资源优先）
    const resourceMap = new Map<string, T>();

    // 先添加全局资源
    for (const resource of globalResources) {
      resourceMap.set(resource.id, resource);
    }

    // 再添加私有资源（覆盖同 ID 的全局资源）
    for (const resource of privateResources) {
      resourceMap.set(resource.id, resource);
    }

    return Array.from(resourceMap.values());
  }

  /**
   * 注销资源
   */
  async unregister(resourceId: string, scope: 'global' | 'private', agentId?: AgentId): Promise<void> {
    if (scope === 'global') {
      await this.globalPool.unregister(resourceId);
    } else {
      if (!agentId) {
        throw new Error('agentId is required for private scope');
      }
      await this.privatePool.unregister(resourceId);
    }
  }
}
