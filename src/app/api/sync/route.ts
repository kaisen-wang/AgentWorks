import { NextRequest, NextResponse } from "next/server";

/**
 * 数据同步 API - 将前端 Zustand store 数据同步到 SQLite
 *
 * POST /api/sync - 接收 store 快照，写入 SQLite
 * GET /api/sync - 从 SQLite 读取数据，返回给前端
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agents, projects, tasks, chats, messages, archives, scripts, knowledge } = body;

    // 动态导入 SQLite（仅服务端可用）
    try {
      const { getDb } = await import("@/lib/db/database");
      const db = getDb();

      // 使用事务批量写入
      const transaction = db.transaction(() => {
        // 同步 agents
        if (agents) {
          const agentEntries = Object.entries(agents) as [string, unknown][];
          for (const [id, agentData] of agentEntries) {
            const a = agentData as Record<string, unknown>;
            const existing = db.prepare("SELECT agent_id FROM agents WHERE agent_id = ?").get(id);
            if (existing) {
              db.prepare(`
                UPDATE agents SET name=?, model=?, parent_id=?, span_of_control_limit=?,
                  span_exemption=?, span_exemption_reason=?, capability_tags=?,
                  monthly_budget=?, budget_used=?, status=?, avatar_url=?, config=?,
                  updated_at=?
                WHERE agent_id=?
              `).run(
                a.name, (a.config as Record<string, unknown>)?.model || "deepseek-v4-flash", a.parentId,
                a.maxChildren || 5, a.spanExemption ? 1 : 0, a.spanExemptionReason || null,
                JSON.stringify(a.capabilities || []),
                (a.config as Record<string, unknown>)?.monthlyBudget || null,
                (a.config as Record<string, unknown>)?.budgetUsed || 0,
                a.status || "idle", a.avatar || "bot",
                JSON.stringify(a.config || {}),
                Date.now(), id
              );
            } else {
              db.prepare(`
                INSERT OR IGNORE INTO agents (agent_id, name, model, parent_id, path, span_of_control_limit,
                  capability_tags, monthly_budget, status, avatar_url, config, created_at, updated_at)
                VALUES (?, ?, ?, ?, '/', ?, ?, ?, ?, ?, ?, ?, ?)
              `).run(
                id, a.name, (a.config as Record<string, unknown>)?.model || "deepseek-v4-flash", a.parentId,
                a.maxChildren || 5, JSON.stringify(a.capabilities || []),
                (a.config as Record<string, unknown>)?.monthlyBudget || null,
                a.status || "idle", a.avatar || "bot",
                JSON.stringify(a.config || {}), a.createdAt || Date.now(), Date.now()
              );
            }
          }
        }

        // 同步 projects
        if (projects && Array.isArray(projects)) {
          for (const p of projects) {
            const existing = db.prepare("SELECT project_id FROM projects WHERE project_id = ?").get(p.id);
            if (!existing) {
              db.prepare("INSERT OR IGNORE INTO projects (project_id, name, created_at) VALUES (?, ?, ?)")
                .run(p.id, p.name, p.createdAt || Date.now());
            }
          }
        }

        // 同步 tasks
        if (tasks) {
          const taskEntries = Object.entries(tasks) as [string, unknown][];
          for (const [id, taskData] of taskEntries) {
            const t = taskData as Record<string, unknown>;
            const existing = db.prepare("SELECT task_id FROM tasks WHERE task_id = ?").get(id);
            if (!existing) {
              db.prepare(`
                INSERT OR IGNORE INTO tasks (task_id, title, description, assignee_id, parent_task_id,
                  project_id, priority, status, chat_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)
              `).run(
                id, t.title, t.description, t.assigneeId,
                t.projectId || null, t.priority || "medium", t.status || "pending",
                t.chatId || null, t.createdAt || Date.now(), Date.now()
              );
            } else {
              db.prepare("UPDATE tasks SET status=?, priority=?, updated_at=? WHERE task_id=?")
                .run(t.status, t.priority, Date.now(), id);
            }
          }
        }
      });

      transaction();
      return NextResponse.json({ success: true, synced: true });
    } catch (dbError) {
      // SQLite 不可用时降级
      console.warn("[Sync] SQLite 不可用，跳过服务端持久化:", dbError);
      return NextResponse.json({ success: true, synced: false, reason: "sqlite_unavailable" });
    }
  } catch {
    return NextResponse.json({ error: "无效的请求体" }, { status: 400 });
  }
}

export async function GET() {
  try {
    const { getDb } = await import("@/lib/db/database");
    const db = getDb();

    const rawAgents = db.prepare("SELECT * FROM agents ORDER BY created_at ASC").all() as Record<string, unknown>[];
    const projects = db.prepare("SELECT * FROM projects ORDER BY created_at ASC").all();
    const rawTasks = db.prepare("SELECT * FROM tasks ORDER BY created_at ASC").all() as Record<string, unknown>[];

    // 转换Agent数据结构：数据库字段 -> 前端期望的字段
    const agents = rawAgents.map((a) => {
      const config = typeof a.config === "string" ? JSON.parse(a.config as string) : a.config || {};
      const capabilities = typeof a.capability_tags === "string" ? JSON.parse(a.capability_tags as string) : a.capability_tags || [];

      return {
        id: a.agent_id as string,
        name: a.name as string,
        description: (a.description as string) || "",
        role: (a.role as string) || "specialist",
        parentId: a.parent_id as string | null,
        childIds: [] as string[], // 需要从其他Agent计算得出
        maxChildren: (a.span_of_control_limit as number) || 5,
        spanExemption: Boolean(a.span_exemption),
        spanExemptionReason: (a.span_exemption_reason as string) || undefined,
        capabilities: capabilities as Array<{ name: string; description: string; tools?: string[] }>,
        config: {
          model: (a.model as string) || (config.model as string) || "deepseek-v4-flash",
          temperature: (config.temperature as number) || 0.7,
          timeout: (config.timeout as number) || 30000,
          maxRetries: (config.maxRetries as number) || 3,
          decisionThreshold: (config.decisionThreshold as number) || 5,
          monthlyBudget: (a.monthly_budget as number) || (config.monthlyBudget as number) || 10,
          budgetUsed: (a.budget_used as number) || (config.budgetUsed as number) || 0,
          budgetAlertThreshold: (config.budgetAlertThreshold as number) || 0.9,
        },
        status: (a.status as string) || "idle",
        avatar: (a.avatar_url as string) || "bot",
        createdAt: a.created_at as number,
        updatedAt: a.updated_at as number,
      };
    });

    // 计算childIds
    const agentMap = new Map(agents.map((a) => [a.id, a]));
    for (const agent of agents) {
      if (agent.parentId && agentMap.has(agent.parentId)) {
        const parent = agentMap.get(agent.parentId)!;
        parent.childIds.push(agent.id);
      }
    }

    // 转换Task数据结构
    const tasks = rawTasks.map((t) => ({
      id: t.task_id,
      title: t.title,
      description: t.description || "",
      assigneeId: t.assignee_id,
      projectId: t.project_id || null,
      priority: t.priority || "medium",
      status: t.status || "pending",
      chatId: t.chat_id || null,
      subTasks: [], // 需要从其他Task计算得出
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    }));

    return NextResponse.json({ agents, projects, tasks });
  } catch (dbError) {
    return NextResponse.json({ agents: [], projects: [], tasks: [], reason: "sqlite_unavailable" });
  }
}
