"use client";

/**
 * SyncStatusIndicator - 同步状态指示器
 *
 * 显示在页面右上角，告知用户数据同步状态
 */

import { useState, useEffect } from "react";
import { smartSync, type SyncStatus } from "@/lib/sync/SmartSync";

export function SyncStatusIndicator() {
  const [status, setStatus] = useState<SyncStatus>({
    pending: 0,
    lastSync: null,
    isSyncing: false,
    error: null,
  });

  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    return smartSync.subscribe(setStatus);
  }, []);

  // 自动隐藏：无待同步数据且不在同步中，3秒后隐藏
  useEffect(() => {
    if (status.pending === 0 && !status.isSyncing) {
      const timer = setTimeout(() => setIsVisible(false), 3000);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(true);
    }
  }, [status.pending, status.isSyncing]);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed top-14 right-4 z-50 animate-slide-down">
      <div className="glass-medium rounded-lg px-3 py-2 flex items-center gap-2 shadow-lg">
        {status.isSyncing ? (
          <>
            <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-[11px] text-[var(--text-secondary)]">同步中...</span>
          </>
        ) : status.pending > 0 ? (
          <>
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span className="text-[11px] text-[var(--text-secondary)]">
              {status.pending} 个变更待同步
            </span>
          </>
        ) : (
          <>
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-[11px] text-[var(--text-secondary)]">已同步</span>
          </>
        )}

        {status.error && (
          <span className="text-[10px] text-[var(--error)] ml-2">{status.error}</span>
        )}
      </div>
    </div>
  );
}
