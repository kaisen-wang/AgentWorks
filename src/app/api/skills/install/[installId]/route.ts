/**
 * GET /api/skills/install/[installId] - 查询安装进度
 * DELETE /api/skills/install/[installId] - 取消安装
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSkillInstaller } from '@/lib/install';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ installId: string }> }
) {
  try {
    const { installId } = await params;

    const installer = await getSkillInstaller();
    const progress = installer.getProgress(installId);

    return NextResponse.json({
      success: true,
      ...progress,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    if (message === 'Install not found') {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Install not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ installId: string }> }
) {
  try {
    const { installId } = await params;

    const installer = await getSkillInstaller();
    await installer.cancel(installId);

    return NextResponse.json({
      success: true,
      message: 'Installation cancelled',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('not found')) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Install not found or already completed' } },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    );
  }
}
