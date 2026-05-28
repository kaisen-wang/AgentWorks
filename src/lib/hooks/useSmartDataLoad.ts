"use client";

/**
 * useSmartDataLoad - 智能数据加载 Hook
 *
 * 优先显示缓存数据，后台同步服务端数据
 */

import { useState, useEffect } from "react";
import { useAppStore } from "@/stores/appStore";
import type { AppState } from "@/stores/appStore";

export interface SmartDataLoadResult {
  isLoading: boolean;
  isFromCache: boolean;
  error: string | null;
}

export function useSmartDataLoad(): SmartDataLoadResult {
  const [isLoading, setIsLoading] = useState(true);
  const [isFromCache, setIsFromCache] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      // 1. 检查 localStorage 缓存
      const cacheKey = "agentworks-store";
      const cachedData = localStorage.getItem(cacheKey);

      if (cachedData) {
        try {
          const parsed = JSON.parse(cachedData);
          if (parsed.state) {
            // 立即显示缓存数据
            useAppStore.setState(parsed.state as Partial<AppState>);
            setIsFromCache(true);
            setIsLoading(false);
            console.log("[SmartLoad] 从缓存加载数据");
          }
        } catch (err) {
          console.error("[SmartLoad] 缓存数据解析失败:", err);
        }
      }

      // 2. 从服务端加载最新数据
      try {
        const response = await fetch("/api/sync");
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const serverData = await response.json();

        // 3. 合并数据（服务端优先）
        if (serverData.agents && Array.isArray(serverData.agents)) {
          const currentState = useAppStore.getState();
          const mergedAgents = mergeAgents(currentState.agents, serverData.agents);

          useAppStore.setState({
            agents: mergedAgents,
          });

          setIsFromCache(false);
          setIsLoading(false);
          setError(null);

          console.log("[SmartLoad] 从服务端加载数据，合并完成");
        }
      } catch (err) {
        console.error("[SmartLoad] 服务端数据加载失败:", err);
        setError(err instanceof Error ? err.message : "加载失败");

        // 如果没有缓存数据，显示错误
        if (!cachedData) {
          setIsLoading(false);
        }
      }
    }

    loadData();
  }, []);

  return { isLoading, isFromCache, error };
}

/**
 * 合并Agent数据
 * 服务端数据优先，但保留本地未同步的变更
 */
function mergeAgents(
  localAgents: Record<string, any>,
  serverAgents: any[]
): Record<string, any> {
  const merged: Record<string, any> = { ...localAgents };

  // 服务端数据覆盖本地
  for (const agent of serverAgents) {
    if (agent.id) {
      merged[agent.id] = agent;
    }
  }

  return merged;
}
