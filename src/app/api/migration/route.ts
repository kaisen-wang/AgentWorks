/**
 * 数据迁移 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { MigrationTool } from '@/lib/migration/MigrationTool';

const migrationTool = new MigrationTool();

/**
 * GET /api/migration - 检查迁移状态
 */
export async function GET() {
  try {
    const localData = migrationTool.checkLocalStorage();
    
    return NextResponse.json({
      hasLocalData: localData !== null,
      status: localData ? 'pending' : 'none',
    });
  } catch (error) {
    return NextResponse.json(
      { error: '检查迁移状态失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/migration - 执行迁移操作
 * 
 * Body: { action: 'start' | 'status' | 'rollback' }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'start': {
        const localData = migrationTool.checkLocalStorage();
        if (!localData) {
          return NextResponse.json({
            success: false,
            error: '没有需要迁移的数据',
          });
        }

        const result = migrationTool.migrate(localData);
        
        if (result.success) {
          // 验证迁移结果
          const verified = migrationTool.verify();
          if (verified) {
            // 清空 localStorage
            migrationTool.cleanup();
          } else {
            return NextResponse.json({
              success: false,
              error: '迁移验证失败',
              migrated: result.migrated,
            });
          }
        }

        return NextResponse.json(result);
      }

      case 'status': {
        const localData = migrationTool.checkLocalStorage();
        return NextResponse.json({
          hasLocalData: localData !== null,
          status: localData ? 'pending' : 'completed',
        });
      }

      case 'rollback': {
        migrationTool.rollback();
        return NextResponse.json({
          success: true,
          message: '已回滚到 localStorage',
        });
      }

      default:
        return NextResponse.json(
          { error: '无效的操作' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('迁移操作失败:', error);
    return NextResponse.json(
      { error: '迁移操作失败' },
      { status: 500 }
    );
  }
}
