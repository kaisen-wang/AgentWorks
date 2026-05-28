import { NextRequest, NextResponse } from "next/server";
import type { SyncChange } from "@/lib/sync/SmartSync";

/**
 * 批量同步 API - 处理多个数据变更
 *
 * POST /api/sync/batch - 接收变更数组，批量写入 SQLite
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { changes } = body as { changes: SyncChange[] };

    if (!Array.isArray(changes) || changes.length === 0) {
      return NextResponse.json({ success: true, processed: 0 });
    }

    // 动态导入 SQLite
    try {
      const { getDb } = await import("@/lib/db/database");
      const db = getDb();

      // 使用事务批量处理
      const transaction = db.transaction(() => {
        for (const change of changes) {
          try {
            processChange(db, change);
          } catch (err) {
            console.error(`[BatchSync] 处理变更失败:`, change, err);
            // 继续处理其他变更
          }
        }
      });

      transaction();

      return NextResponse.json({
        success: true,
        processed: changes.length,
        timestamp: Date.now(),
      });
    } catch (dbError) {
      console.warn("[BatchSync] SQLite 不可用:", dbError);
      return NextResponse.json({
        success: false,
        reason: "sqlite_unavailable",
        processed: 0,
      });
    }
  } catch (error) {
    console.error("[BatchSync] 错误:", error);
    return NextResponse.json(
      { error: "无效的请求体" },
      { status: 400 }
    );
  }
}

/**
 * 处理单个变更
 */
function processChange(db: any, change: SyncChange): void {
  switch (change.type) {
    case "agent":
      processAgentChange(db, change);
      break;
    case "chat":
      processChatChange(db, change);
      break;
    case "task":
      processTaskChange(db, change);
      break;
    case "message":
      processMessageChange(db, change);
      break;
    default:
      console.warn(`[BatchSync] 未知变更类型: ${change.type}`);
  }
}

/**
 * 处理 Agent 变更
 */
function processAgentChange(db: any, change: SyncChange): void {
  const { action, id, data } = change;

  switch (action) {
    case "create":
    case "update":
      const existing = db.prepare("SELECT agent_id FROM agents WHERE agent_id = ?").get(id);
      const config = data.config || {};
      const capabilities = data.capabilities || [];

      if (existing) {
        db.prepare(`
          UPDATE agents SET
            name=?, model=?, parent_id=?, span_of_control_limit=?,
            span_exemption=?, span_exemption_reason=?, capability_tags=?,
            monthly_budget=?, budget_used=?, status=?, avatar_url=?, config=?,
            updated_at=?
          WHERE agent_id=?
        `).run(
          data.name,
          config.model || "deepseek-v4-flash",
          data.parentId,
          data.maxChildren || 5,
          data.spanExemption ? 1 : 0,
          data.spanExemptionReason || null,
          JSON.stringify(capabilities),
          config.monthlyBudget || null,
          config.budgetUsed || 0,
          data.status || "idle",
          data.avatar || "bot",
          JSON.stringify(config),
          Date.now(),
          id
        );
      } else {
        db.prepare(`
          INSERT OR IGNORE INTO agents (
            agent_id, name, model, parent_id, path, span_of_control_limit,
            capability_tags, monthly_budget, status, avatar_url, config,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, '/', ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          data.name,
          config.model || "deepseek-v4-flash",
          data.parentId,
          data.maxChildren || 5,
          JSON.stringify(capabilities),
          config.monthlyBudget || null,
          data.status || "idle",
          data.avatar || "bot",
          JSON.stringify(config),
          data.createdAt || Date.now(),
          Date.now()
        );
      }
      break;

    case "delete":
      db.prepare("DELETE FROM agents WHERE agent_id = ?").run(id);
      break;
  }
}

/**
 * 处理 Chat 变更
 */
function processChatChange(db: any, change: SyncChange): void {
  // TODO: 实现 Chat 表的批量同步
  console.log(`[BatchSync] Chat ${change.action}: ${change.id}`);
}

/**
 * 处理 Task 变更
 */
function processTaskChange(db: any, change: SyncChange): void {
  const { action, id, data } = change;

  switch (action) {
    case "create":
    case "update":
      const existing = db.prepare("SELECT task_id FROM tasks WHERE task_id = ?").get(id);
      if (!existing && data) {
        db.prepare(`
          INSERT OR IGNORE INTO tasks (
            task_id, title, description, assignee_id, parent_task_id,
            project_id, priority, status, chat_id, created_at, updated_at
          ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          data.title,
          data.description || "",
          data.assigneeId,
          data.projectId || null,
          data.priority || "medium",
          data.status || "pending",
          data.chatId || null,
          data.createdAt || Date.now(),
          Date.now()
        );
      } else if (existing && data) {
        db.prepare(`
          UPDATE tasks SET
            title=?, description=?, assignee_id=?, priority=?, status=?,
            updated_at=?
          WHERE task_id=?
        `).run(
          data.title,
          data.description || "",
          data.assigneeId,
          data.priority || "medium",
          data.status || "pending",
          Date.now(),
          id
        );
      }
      break;

    case "delete":
      db.prepare("DELETE FROM tasks WHERE task_id = ?").run(id);
      break;
  }
}

/**
 * 处理 Message 变更
 */
function processMessageChange(db: any, change: SyncChange): void {
  // TODO: 实现 Message 表的批量同步
  console.log(`[BatchSync] Message ${change.action}: ${change.id}`);
}
