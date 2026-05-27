/**
 * Tool 执行 API
 * POST /api/tools/execute
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSkillsToolsManager } from '@/lib/skills';

const manager = createSkillsToolsManager();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { toolId, params, context } = body;

    // 验证必需字段
    if (!toolId) {
      return NextResponse.json(
        {
          success: false,
          error: 'toolId is required',
        },
        { status: 400 }
      );
    }

    // 执行 Tool
    const result = await manager.toolExecutor.execute(
      toolId,
      params || {},
      context
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
