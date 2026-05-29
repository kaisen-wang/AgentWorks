"use client";

/**
 * SyncStatusIndicator - 同步状态指示器
 *
 * 显示在页面右上角，告知用户数据同步状态
 * 已简化：不再使用SmartSync，直接显示SQLite状态
 */

import { useState, useEffect } from "react";

export function SyncStatusIndicator() {
  const [status, setStatus] = useState<'ready' | 'syncing' | 'error'>('ready');
  const [isVisible, setIsVisible] = useState(false);

  // 简化：不再监听SmartSync，直接显示就绪状态
  useEffect(() => {
    // 可以在这里添加SQLite状态检查逻辑
    setStatus('ready');
  }, []);

  // 自动隐藏：3秒后隐藏
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed top-14 right-4 z-50 animate-slide-down">
      <div className="glass-medium rounded-lg px-3 py-2 flex items-center gap-2 shadow-lg">
        {status === 'syncing' ? (
          <>
            <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-[11px] text-[var(--text-secondary)]">同步中...</span>
          </>
        ) : status === 'error' ? (
          <>
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-[11px] text-[var(--text-secondary)]">同步失败</span>
          </>
        ) : (
          <>
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-[11px] text-[var(--text-secondary)]">SQLite 已就绪</span>
          </>
        )}
      </div>
    </div>
  );
}
