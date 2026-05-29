/**
 * 数据库初始化脚本
 * 确保数据库在应用启动时就被创建
 */

import { getDb, closeDb } from './database';

// 初始化数据库
export function initializeDatabase(): void {
  try {
    const db = getDb();
    console.log('✅ SQLite数据库初始化成功');
    
    // 验证表是否存在
    const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).all() as { name: string }[];
    
    console.log(`📊 已创建 ${tables.length} 个表:`, tables.map(t => t.name).join(', '));
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    throw error;
  }
}

// 清理函数
export function cleanupDatabase(): void {
  closeDb();
  console.log('🔌 数据库连接已关闭');
}
