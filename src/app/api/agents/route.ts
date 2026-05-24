import { NextRequest, NextResponse } from "next/server";

// Agent API Routes - 真正操作 SQLite 数据库

export async function GET() {
  try {
    const { getAllAgents } = await import("@/lib/db/agentRepo");
    const agents = getAllAgents();
    return NextResponse.json({ agents });
  } catch {
    // SQLite 不可用时降级
    return NextResponse.json({ agents: [], fallback: true });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, role, parentId, capabilities, config, agentId } = body;

    if (!name || !role) {
      return NextResponse.json(
        { error: "缺少必填字段: name, role" },
        { status: 400 }
      );
    }

    try {
      const { createAgent, getSubordinateCount } = await import("@/lib/db/agentRepo");
      const { detectCycle } = await import("@/lib/db/agentRepo");

      // 检查管理幅度
      if (parentId) {
        const count = getSubordinateCount(parentId);
        if (count >= 5) {
          return NextResponse.json(
            { error: `上级 Agent 的管理幅度已达上限 (${count}/5)` },
            { status: 409 }
          );
        }
        // 检查循环引用
        if (agentId && detectCycle(agentId, parentId)) {
          return NextResponse.json(
            { error: "设定此上级会导致循环引用" },
            { status: 409 }
          );
        }
      }

      const id = agentId || `agent_${Date.now()}`;
      createAgent({
        agentId: id,
        name,
        model: config?.model || "gpt-4",
        parentId: parentId || null,
        path: "/",
        spanOfControlLimit: 5,
        capabilityTags: capabilities || [],
        monthlyBudget: config?.monthlyBudget,
        status: "idle",
        avatarUrl: role === "supervisor" ? "supervisor" : "specialist",
        config: config || {},
      });

      return NextResponse.json({ success: true, agentId: id });
    } catch (dbErr) {
      // SQLite 不可用时降级到前端 store
      return NextResponse.json({
        action: "create_agent",
        data: { name, role, parentId: parentId || null, capabilities: capabilities || [], config: config || {} },
        fallback: true,
      });
    }
  } catch {
    return NextResponse.json({ error: "无效的请求体" }, { status: 400 });
  }
}
