/**
 * 乐观更新管理器
 * 管理前端乐观更新和回滚机制
 */

/** 乐观更新操作 */
export interface OptimisticUpdate {
  id: string;
  type: 'create' | 'update' | 'delete';
  entityType: string; // 'agent' | 'task' | 'chat' | 'message'
  entityId: string;
  snapshot: any; // 更新前的状态快照
  timestamp: number;
}

/** 乐观更新管理器接口 */
export interface IOptimisticUpdateManager {
  apply(update: Omit<OptimisticUpdate, 'id' | 'timestamp'>): string;
  confirm(updateId: string): void;
  rollback(updateId: string): void;
  getPending(): OptimisticUpdate[];
  clear(): void;
}

export class OptimisticUpdateManager implements IOptimisticUpdateManager {
  private pendingUpdates: Map<string, OptimisticUpdate> = new Map();
  private rollbackHandlers: Map<string, (snapshot: any) => void> = new Map();

  /**
   * 注册回滚处理器
   */
  registerRollbackHandler(
    entityType: string,
    handler: (snapshot: any) => void
  ): void {
    this.rollbackHandlers.set(entityType, handler);
  }

  /**
   * 应用乐观更新
   */
  apply(update: Omit<OptimisticUpdate, 'id' | 'timestamp'>): string {
    const id = `${update.entityType}_${update.entityId}_${Date.now()}`;
    const fullUpdate: OptimisticUpdate = {
      ...update,
      id,
      timestamp: Date.now(),
    };

    this.pendingUpdates.set(id, fullUpdate);
    return id;
  }

  /**
   * 确认更新（API 调用成功后调用）
   */
  confirm(updateId: string): void {
    this.pendingUpdates.delete(updateId);
  }

  /**
   * 回滚更新（API 调用失败后调用）
   */
  rollback(updateId: string): void {
    const update = this.pendingUpdates.get(updateId);
    if (!update) return;

    // 执行回滚处理器
    const handler = this.rollbackHandlers.get(update.entityType);
    if (handler) {
      handler(update.snapshot);
    }

    // 移除待确认的更新
    this.pendingUpdates.delete(updateId);
  }

  /**
   * 获取所有待确认的更新
   */
  getPending(): OptimisticUpdate[] {
    return Array.from(this.pendingUpdates.values());
  }

  /**
   * 清空所有待确认的更新
   */
  clear(): void {
    this.pendingUpdates.clear();
  }

  /**
   * 批量确认更新
   */
  confirmBatch(updateIds: string[]): void {
    for (const id of updateIds) {
      this.confirm(id);
    }
  }

  /**
   * 批量回滚更新
   */
  rollbackBatch(updateIds: string[]): void {
    for (const id of updateIds) {
      this.rollback(id);
    }
  }
}

/** 全局单例 */
export const optimisticManager = new OptimisticUpdateManager();
