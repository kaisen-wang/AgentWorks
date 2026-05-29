/**
 * 应用初始化组件
 * 负责从SQLite加载数据
 */

'use client';

import { useEffect, useState } from 'react';

interface AppInitializerProps {
  children: React.ReactNode;
}

type InitStatus = 'loading' | 'ready' | 'error';

export function AppInitializer({ children }: AppInitializerProps) {
  const [status, setStatus] = useState<InitStatus>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function initialize() {
      try {
        // 从SQLite加载数据
        setStatus('loading');
        const syncRes = await fetch('/api/sync');
        if (!syncRes.ok) {
          throw new Error('加载数据失败');
        }

        const syncData = await syncRes.json();
        
        // 触发全局数据加载事件
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('appDataLoaded', { detail: syncData }));
        }

        setStatus('ready');
      } catch (err) {
        console.error('初始化失败:', err);
        setError(err instanceof Error ? err.message : '未知错误');
        setStatus('error');
      }
    }

    initialize();
  }, []);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">加载数据...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.468 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-red-600 font-semibold mb-2">初始化失败</p>
          <p className="text-gray-600 text-sm">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
