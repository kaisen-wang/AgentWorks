/**
 * Skills API 路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSkillsToolsManager } from '@/lib/skills';

const manager = createSkillsToolsManager();

/**
 * POST /api/skills - 注册 Skill
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
          error: 'Invalid skill definition',
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

    // 注册 Skill
    await manager.skillRegistry.register(definition, scope, agentId);

    return NextResponse.json({
      success: true,
      skillId: definition.meta.id,
      message: 'Skill registered successfully',
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
 * GET /api/skills - 列出可访问的 Skills
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    const skillId = searchParams.get('skillId');

    if (!agentId) {
      return NextResponse.json(
        {
          success: false,
          error: 'agentId is required',
        },
        { status: 400 }
      );
    }

    // 查找特定 Skill
    if (skillId) {
      const skill = await manager.skillRegistry.find(agentId, skillId);

      if (!skill) {
        return NextResponse.json(
          {
            success: false,
            error: 'Skill not found',
          },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        skill,
      });
    }

    // 列出所有可访问的 Skills
    const skills = await manager.skillRegistry.listAccessible(agentId);

    return NextResponse.json({
      success: true,
      skills,
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
 * DELETE /api/skills - 注销 Skill
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const skillId = searchParams.get('skillId');
    const scope = searchParams.get('scope') as 'global' | 'private';
    const agentId = searchParams.get('agentId');

    if (!skillId) {
      return NextResponse.json(
        {
          success: false,
          error: 'skillId is required',
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

    // 注销 Skill
    await manager.skillRegistry.unregister(skillId, scope, agentId || undefined);

    return NextResponse.json({
      success: true,
      message: 'Skill unregistered successfully',
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
