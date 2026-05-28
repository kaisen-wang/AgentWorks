/**
 * SmartSync 集成示例
 *
 * 展示如何在 appStore 中集成 SmartSync
 */

import { smartSync } from "@/lib/sync/SmartSync";

// ============================================================
// 方式一：在现有的 appStore 中集成 SmartSync
// ============================================================

/**
 * 修改 createAgent 方法，添加智能同步
 */
export const createAgentWithSync = (
  name: string,
  role: AgentRole,
  parentId: AgentId | null,
  capabilities: AgentCapability[] = [],
  config?: Partial<AgentConfig>,
  description: string = ""
) => {
  // 1. 创建 Agent（现有逻辑）
  const agent = {
    id: uuidv4(),
    name,
    description,
    role,
    parentId,
    childIds: [],
    maxChildren: 5,
    spanExemption: false,
    capabilities,
    config: { ...defaultAgentConfig(), ...config },
    status: "idle",
    avatar: AVATAR_MAP[role] || "bot",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // 2. 更新本地状态（Zustand）
  set((s: AppState) => {
    const agents = { ...s.agents, [agent.id]: agent };
    if (parentId && agents[parentId]) {
      agents[parentId] = {
        ...agents[parentId],
        childIds: [...agents[parentId].childIds, agent.id],
        updatedAt: Date.now(),
      };
    }
    return { agents };
  });

  // 3. 跟踪变更，智能同步到服务端
  smartSync.trackChange("agent", "create", agent.id, agent);

  return agent;
};

/**
 * 修改 updateAgent 方法，添加智能同步
 */
export const updateAgentWithSync = (id: AgentId, updates: Partial<Agent>) => {
  // 1. 更新本地状态
  set((s: AppState) => {
    if (!s.agents[id]) return s;
    const agent = { ...s.agents[id], ...updates, updatedAt: Date.now() };
    return { agents: { ...s.agents, [id]: agent } };
  });

  // 2. 跟踪变更
  const agent = get().agents[id];
  smartSync.trackChange("agent", "update", id, agent);
};

/**
 * 修改 deleteAgent 方法，添加智能同步
 */
export const deleteAgentWithSync = (id: AgentId) => {
  // 1. 删除本地状态
  set((s: AppState) => {
    const agents = { ...s.agents };
    delete agents[id];
    // TODO: 处理子节点、任务转移等
    return { agents };
  });

  // 2. 跟踪变更
  smartSync.trackChange("agent", "delete", id);
};

// ============================================================
// 方式二：创建同步状态指示器组件
// ============================================================

/**
 * 同步状态指示器
 * 显示在页面右上角，告知用户数据同步状态
 */
export function SyncStatusIndicator() {
  const [status, setStatus] = useState<SyncStatus>({
    pending: 0,
    lastSync: null,
    isSyncing: false,
    error: null,
  });

  useEffect(() => {
    return smartSync.subscribe(setStatus);
  }, []);

  if (status.pending === 0 && !status.isSyncing) {
    return null; // 无待同步数据，不显示
  }

  return (
    <div className="fixed top-4 right-4 z-50">
      <div className="glass-medium rounded-lg px-3 py-2 flex items-center gap-2">
        {status.isSyncing ? (
          <>
            <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-xs text-gray-600">同步中...</span>
          </>
        ) : (
          <>
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span className="text-xs text-gray-600">
              {status.pending} 个变更待同步
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// 方式三：页面加载时的智能数据加载
// ============================================================

/**
 * 智能数据加载 Hook
 * 优先显示缓存数据，后台同步服务端数据
 */
export function useSmartDataLoad() {
  const [isLoading, setIsLoading] = useState(true);
  const [isFromCache, setIsFromCache] = useState(false);

  useEffect(() => {
    async function loadData() {
      // 1. 检查 localStorage 缓存
      const cachedData = localStorage.getItem("agentworks-cache");
      if (cachedData) {
        try {
          const parsed = JSON.parse(cachedData);
          // 立即显示缓存数据
          useAppStore.setState(parsed);
          setIsFromCache(true);
          setIsLoading(false);
        } catch (err) {
          console.error("[SmartLoad] 缓存数据解析失败:", err);
        }
      }

      // 2. 从服务端加载最新数据
      try {
        const response = await fetch("/api/sync");
        if (!response.ok) throw new Error("加载失败");

        const serverData = await response.json();

        // 3. 合并数据（服务端优先）
        const currentState = useAppStore.getState();
        const mergedData = mergeData(currentState, serverData);

        useAppStore.setState(mergedData);
        setIsFromCache(false);
        setIsLoading(false);

        // 4. 更新缓存
        localStorage.setItem(
          "agentworks-cache",
          JSON.stringify({
            state: mergedData,
            timestamp: Date.now(),
          })
        );
      } catch (err) {
        console.error("[SmartLoad] 服务端数据加载失败:", err);
        // 如果没有缓存数据，显示错误
        if (!cachedData) {
          setIsLoading(false);
        }
      }
    }

    loadData();
  }, []);

  return { isLoading, isFromCache };
}

/**
 * 数据合并策略
 * 服务端数据优先，但保留本地未同步的变更
 */
function mergeData(localState: AppState, serverData: any): Partial<AppState> {
  // 简单实现：服务端数据覆盖本地
  // TODO: 实现更智能的合并策略（基于时间戳、版本号等）

  return {
    agents: serverData.agents?.reduce((acc: any, a: any) => {
      acc[a.id] = a;
      return acc;
    }, {}) || localState.agents,
    tasks: serverData.tasks?.reduce((acc: any, t: any) => {
      acc[t.id] = t;
      return acc;
    }, {}) || localState.tasks,
    // ... 其他字段
  };
}

// ============================================================
// 使用示例
// ============================================================

/**
 * 在 page.tsx 中使用
 */
export default function HomePage() {
  const { isLoading, isFromCache } = useSmartDataLoad();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <div>
      {/* 同步状态指示器 */}
      <SyncStatusIndicator />

      {/* 如果是从缓存加载，显示提示 */}
      {isFromCache && (
        <div className="fixed bottom-4 right-4 glass-medium rounded-lg px-3 py-2">
          <span className="text-xs text-gray-600">
            正在同步最新数据...
          </span>
        </div>
      )}

      {/* 主内容 */}
      <MainContent />
    </div>
  );
}
