/**
 * Tools API 路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSkillsToolsManager } from '@/lib/skills';

/**
 * POST /api/tools - 注册 Tool
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { definition, scope, agentId } = body;

    // 验证必需字段
    if (!definition || !definition.meta || !definition.meta.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid tool definition',
        },
        { status: 400 }
      );
    }

    if (!scope || !['global', 'private'].includes(scope)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid scope, must be "global" or "private"',
        },
        { status: 400 }
      );
    }

    if (scope === 'private' && !agentId) {
      return NextResponse.json(
        {
          success: false,
          error: 'agentId is required for private scope',
        },
        { status: 400 }
      );
    }

    // 注册 Tool
    const manager = await createSkillsToolsManager();
    await manager.toolRegistry.register(definition, scope, agentId);

    return NextResponse.json({
      success: true,
      toolId: definition.meta.id,
      message: 'Tool registered successfully',
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

/**
 * GET /api/tools - 列出可访问的 Tools
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    const toolId = searchParams.get('toolId');

    if (!agentId) {
      return NextResponse.json(
        {
          success: false,
          error: 'agentId is required',
        },
        { status: 400 }
      );
    }

    const manager = await createSkillsToolsManager();

    // 查找特定 Tool
    if (toolId) {
      const tool = await manager.toolRegistry.find(agentId, toolId);

      if (!tool) {
        return NextResponse.json(
          {
            success: false,
            error: 'Tool not found',
          },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        tool,
      });
    }

    // 列出所有可访问的 Tools
    const tools = await manager.toolRegistry.listAccessible(agentId);

    return NextResponse.json({
      success: true,
      tools,
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

/**
 * DELETE /api/tools - 注销 Tool
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const toolId = searchParams.get('toolId');
    const scope = searchParams.get('scope') as 'global' | 'private';
    const agentId = searchParams.get('agentId');

    if (!toolId) {
      return NextResponse.json(
        {
          success: false,
          error: 'toolId is required',
        },
        { status: 400 }
      );
    }

    if (!scope || !['global', 'private'].includes(scope)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid scope, must be "global" or "private"',
        },
        { status: 400 }
      );
    }

    if (scope === 'private' && !agentId) {
      return NextResponse.json(
        {
          success: false,
          error: 'agentId is required for private scope',
        },
        { status: 400 }
      );
    }

    // 注销 Tool
    const manager = await createSkillsToolsManager();
    await manager.toolRegistry.unregister(toolId, scope, agentId || undefined);

    return NextResponse.json({
      success: true,
      message: 'Tool unregistered successfully',
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
