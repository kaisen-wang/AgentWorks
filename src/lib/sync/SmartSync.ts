/**
 * SmartSync - 智能数据同步管理器
 *
 * 实现混合模式：
 * - localStorage作为缓存层（快速响应）
 * - SQLite作为主数据源（数据一致）
 * - 智能同步策略（防抖、批量、冲突解决）
 */

export interface SyncChange {
  type: "agent" | "chat" | "task" | "message";
  action: "create" | "update" | "delete";
  id: string;
  data?: any;
  timestamp: number;
}

export interface SyncStatus {
  pending: number;
  lastSync: number | null;
  isSyncing: boolean;
  error: string | null;
}

class SmartSyncManager {
  private pendingChanges: Map<string, SyncChange> = new Map();
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private isSyncing: boolean = false;
  private lastSyncTime: number | null = null;
  private listeners: Set<(status: SyncStatus) => void> = new Set();

  private readonly SYNC_DELAY = 500; // 防抖延迟（毫秒）
  private readonly MAX_BATCH_SIZE = 50; // 单次最大同步数量
  private readonly RETRY_DELAY = 5000; // 重试延迟
  private readonly SYNC_ENDPOINT = "/api/sync/batch";

  /**
   * 记录数据变更
   */
  trackChange(type: SyncChange["type"], action: SyncChange["action"], id: string, data?: any): void {
    const key = `${type}:${id}`;
    const change: SyncChange = {
      type,
      action,
      id,
      data,
      timestamp: Date.now(),
    };

    // 如果已有相同key的变更，合并
    const existing = this.pendingChanges.get(key);
    if (existing) {
      // create + update = create
      // update + update = update
      // create + delete = 移除
      if (existing.action === "create" && action === "update") {
        change.action = "create";
      } else if (existing.action === "create" && action === "delete") {
        this.pendingChanges.delete(key);
        this.notifyListeners();
        return;
      }
    }

    this.pendingChanges.set(key, change);
    this.notifyListeners();
    this.scheduleSync();
  }

  /**
   * 安排同步（防抖）
   */
  private scheduleSync(): void {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }
    this.syncTimer = setTimeout(() => {
      this.sync();
    }, this.SYNC_DELAY);
  }

  /**
   * 执行同步
   */
  async sync(): Promise<void> {
    if (this.isSyncing || this.pendingChanges.size === 0) {
      return;
    }

    this.isSyncing = true;
    this.notifyListeners();

    try {
      // 取出待同步的变更
      const changes = Array.from(this.pendingChanges.values())
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(0, this.MAX_BATCH_SIZE);

      // 标记为正在同步
      const syncingKeys = new Set(
        changes.map((c) => `${c.type}:${c.id}`)
      );

      // 调用批量同步API
      const response = await fetch(this.SYNC_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes }),
      });

      if (!response.ok) {
        throw new Error(`同步失败: HTTP ${response.status}`);
      }

      const result = await response.json();

      // 移除已成功同步的变更
      for (const key of syncingKeys) {
        this.pendingChanges.delete(key);
      }

      this.lastSyncTime = Date.now();
      this.notifyListeners();

      // 如果还有未同步的变更，继续同步
      if (this.pendingChanges.size > 0) {
        this.scheduleSync();
      }
    } catch (error) {
      console.error("[SmartSync] 同步失败:", error);

      // 5秒后重试
      setTimeout(() => {
        this.isSyncing = false;
        this.scheduleSync();
      }, this.RETRY_DELAY);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * 强制立即同步所有待同步的变更
   */
  async flush(): Promise<void> {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
    await this.sync();
  }

  /**
   * 获取同步状态
   */
  getStatus(): SyncStatus {
    return {
      pending: this.pendingChanges.size,
      lastSync: this.lastSyncTime,
      isSyncing: this.isSyncing,
      error: null,
    };
  }

  /**
   * 订阅状态变化
   */
  subscribe(listener: (status: SyncStatus) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 通知所有监听器
   */
  private notifyListeners(): void {
    const status = this.getStatus();
    this.listeners.forEach((listener) => {
      try {
        listener(status);
      } catch (error) {
        console.error("[SmartSync] 监听器错误:", error);
      }
    });
  }

  /**
   * 清空待同步队列
   */
  clear(): void {
    this.pendingChanges.clear();
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
    this.notifyListeners();
  }
}

// 单例
export const smartSync = new SmartSyncManager();
