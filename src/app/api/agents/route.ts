import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/database";
import { AgentRepository } from "@/lib/db/agentRepo";
import { v4 as uuidv4 } from "uuid";
import type { Agent, AgentCapability, AgentConfig, AgentRole } from "@/types";

const defaultAgentConfig = (): AgentConfig => ({
  model: "deepseek-v4-flash",
  temperature: 0.7,
  timeout: 30000,
  maxRetries: 3,
  decisionThreshold: 5,
  monthlyBudget: 10,
  budgetUsed: 0,
  budgetAlertThreshold: 0.9,
});

/**
 * GET /api/agents - 获取所有 Agents
 */
export async function GET() {
  try {
    const db = getDb();
    const repo = new AgentRepository(db);
    const agents = repo.findAll();
    return NextResponse.json({ agents });
  } catch (error) {
    console.error("获取 Agents 失败:", error);
    return NextResponse.json({ agents: [], error: "数据库错误" }, { status: 500 });
  }
}

/**
 * POST /api/agents - 创建 Agent
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, role, parentId, capabilities = [], config, description = "" } = body;

    if (!name || !role) {
      return NextResponse.json(
        { error: "缺少必填字段: name, role" },
        { status: 400 }
      );
    }

    const db = getDb();
    const repo = new AgentRepository(db);

    // 检查管理幅度
    if (parentId) {
      const children = repo.findByParentId(parentId);
      if (children.length >= 5) {
        return NextResponse.json(
          { error: `上级 Agent 的管理幅度已达上限 (${children.length}/5)` },
          { status: 409 }
        );
      }
    }

    const id = uuidv4();
    const now = Date.now();
    const avatarMap: Record<string, string> = {
      supervisor: "supervisor",
      specialist: "specialist",
      general: "bot",
    };

    const agent: Agent = {
      id,
      name,
      description,
      role: role as AgentRole,
      parentId: parentId || null,
      childIds: [],
      maxChildren: 5,
      spanExemption: false,
      capabilities: capabilities as AgentCapability[],
      config: { ...defaultAgentConfig(), ...config },
      status: "idle",
      avatar: avatarMap[role] || "bot",
      createdAt: now,
      updatedAt: now,
    };

    repo.create(agent);

    return NextResponse.json({ success: true, agent });
  } catch (error) {
    console.error("创建 Agent 失败:", error);
    return NextResponse.json({ error: "创建失败" }, { status: 500 });
  }
}

/**
 * PUT /api/agents - 更新 Agent
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, updates } = body;

    if (!id) {
      return NextResponse.json({ error: "缺少 Agent ID" }, { status: 400 });
    }

    const db = getDb();
    const repo = new AgentRepository(db);
    const existing = repo.findById(id);

    if (!existing) {
      return NextResponse.json({ error: "Agent 不存在" }, { status: 404 });
    }

    const updated = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    };

    repo.update(updated);

    return NextResponse.json({ success: true, agent: updated });
  } catch (error) {
    console.error("更新 Agent 失败:", error);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}

/**
 * DELETE /api/agents - 删除 Agent
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "缺少 Agent ID" }, { status: 400 });
    }

    const db = getDb();
    const repo = new AgentRepository(db);
    repo.delete(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("删除 Agent 失败:", error);
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}
