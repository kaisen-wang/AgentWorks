/**
 * POST /api/skills/install - 安装 Skill
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSkillInstaller } from '@/lib/install';

/**
 * 检查全局安装权限
 */
async function checkGlobalInstallPermission(agentId: string): Promise<boolean> {
  // 基于简单策略：supervisor 角色的 Agent 有全局安装权限
  // 可以通过 Agent 配置扩展
  try {
    const { getDb } = await import('@/lib/db/database');
    const db = getDb();
    const stmt = db.prepare('SELECT role, config FROM agents WHERE agent_id = ?');
    const row = stmt.get(agentId) as Record<string, unknown> | undefined;
    if (!row) return false;

    if (row.role === 'supervisor') return true;

    // 检查配置中的权限
    if (row.config) {
      try {
        const config = JSON.parse(row.config as string);
        if (config.canInstallGlobal === true) return true;
      } catch {
        // 忽略配置解析错误
      }
    }

    return false;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, scope = 'private', agentId, options } = body;

    // 验证必需字段
    if (!url) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_URL', message: 'url is required' } },
        { status: 400 }
      );
    }

    if (!agentId) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_REQUEST', message: 'agentId is required' } },
        { status: 400 }
      );
    }

    // 验证 scope
    if (scope && !['global', 'private'].includes(scope)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_REQUEST', message: 'scope must be "global" or "private"' } },
        { status: 400 }
      );
    }

    // 检查全局安装权限
    if (scope === 'global') {
      const hasPermission = await checkGlobalInstallPermission(agentId);
      if (!hasPermission) {
        return NextResponse.json(
          { success: false, error: { code: 'PERMISSION_DENIED', message: 'Permission denied for global installation' } },
          { status: 403 }
        );
      }
    }

    // 执行安装
    const installer = await getSkillInstaller();
    const result = await installer.install(url, scope, agentId, options);

    if (result.success) {
      return NextResponse.json({
        success: true,
        installId: result.installId,
        skillId: result.skillId,
        message: 'Skill installed successfully',
      });
    } else {
      const statusCode = result.error?.code === 'PERMISSION_DENIED' ? 403 : 500;
      return NextResponse.json(
        { success: false, error: result.error },
        { status: statusCode }
      );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    );
  }
}
