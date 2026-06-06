/**
 * Skills API 路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSkillsToolsManager } from '@/lib/skills';

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
    const manager = await createSkillsToolsManager();
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
 * GET /api/skills - 列出 Skills
 * - 无参数：返回所有 active skills（用于 UI 能力标签选择）
 * - agentId：返回该 agent 可访问的 skills（全局 + 私有）
 * - agentId + skillId：查找特定 skill
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    const skillId = searchParams.get('skillId');

    const manager = await createSkillsToolsManager();

    // 无 agentId：返回所有 active skills（供 UI 能力标签选择）
    if (!agentId) {
      const { getDb } = await import('@/lib/db/database');
      const { SkillRepo } = await import('@/lib/db/skillRepo');
      const db = getDb();
      const skillRepo = new SkillRepo(db);
      const allSkills = skillRepo.findAll().filter(s => s.status === 'active');

      return NextResponse.json({
        success: true,
        skills: allSkills.map(s => ({
          id: s.id,
          name: s.name,
          description: s.description,
          path: s.path,
          scope: s.scope,
          category: s.category,
          tags: s.tags ? JSON.parse(s.tags) : [],
        })),
      });
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
    const manager = await createSkillsToolsManager();
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
