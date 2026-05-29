/**
 * Skill 执行 API
 * POST /api/skills/execute
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSkillsToolsManager } from '@/lib/skills';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, skillId, params } = body;

    // 验证必需字段
    if (!agentId) {
      return NextResponse.json(
        {
          success: false,
          error: 'agentId is required',
        },
        { status: 400 }
      );
    }

    if (!skillId) {
      return NextResponse.json(
        {
          success: false,
          error: 'skillId is required',
        },
        { status: 400 }
      );
    }

    // 创建管理器并执行 Skill
    const manager = await createSkillsToolsManager();
    const result = await manager.skillExecutor.execute(
      agentId,
      skillId,
      params || {}
    );

    return NextResponse.json({
      success: result.success,
      data: result.data,
      error: result.error,
      metadata: result.metadata,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
