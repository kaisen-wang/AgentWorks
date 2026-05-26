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

    const agents = db.prepare("SELECT * FROM agents ORDER BY created_at ASC").all();
    const projects = db.prepare("SELECT * FROM projects ORDER BY created_at ASC").all();
    const tasks = db.prepare("SELECT * FROM tasks ORDER BY created_at ASC").all();

    return NextResponse.json({ agents, projects, tasks });
  } catch (dbError) {
    return NextResponse.json({ agents: [], projects: [], tasks: [], reason: "sqlite_unavailable" });
  }
}
