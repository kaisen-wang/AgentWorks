/**
 * Skill 安装模块统一导出
 */

// 导出核心类
export { SkillInstaller } from './skillInstaller';
export { PackageDownloader } from './packageDownloader';
export { PackageValidator } from './packageValidator';
export { SkillParser } from './skillParser';
export { InstallDependencyResolver } from './installDependencyResolver';
export { RollbackManager } from './rollbackManager';
export { validateUrl, sanitizePath } from './urlValidator';

// 导出配置
export { getInstallConfig, updateInstallConfig, resetInstallConfig } from './config';

// 导出数据访问层
export { InstallLogRepo } from '@/lib/db/installLogRepo';

// 导出处理器
export { downloadHttp } from './handlers/httpHandler';
export { downloadFile } from './handlers/fileHandler';
export { downloadGit } from './handlers/gitHandler';

// --- 模块初始化 ---

import { getDb } from '@/lib/db/database';
import { SkillRepo } from '@/lib/db/skillRepo';
import { ToolRepo } from '@/lib/db/toolRepo';
import { ExecutionLogRepo } from '@/lib/db/executionLogRepo';
import { InstallLogRepo } from '@/lib/db/installLogRepo';
import { ToolRegistry } from '@/lib/skills/toolRegistry';
import { SkillRegistry } from '@/lib/skills/skillRegistry';
import { PackageDownloader } from './packageDownloader';
import { PackageValidator } from './packageValidator';
import { SkillParser } from './skillParser';
import { InstallDependencyResolver } from './installDependencyResolver';
import { SkillInstaller } from './skillInstaller';
import { getInstallConfig } from './config';

let skillInstaller: SkillInstaller | null = null;

/**
 * 获取 SkillInstaller 实例（单例）
 */
export async function getSkillInstaller(): Promise<SkillInstaller> {
  if (skillInstaller) {
    return skillInstaller;
  }

  const db = getDb();
  const config = getInstallConfig();

  // 创建数据访问层
  const skillRepo = new SkillRepo(db);
  const toolRepo = new ToolRepo(db);
  const executionLogRepo = new ExecutionLogRepo(db);
  const installLogRepo = new InstallLogRepo(db);

  // 创建注册表
  const toolRegistry = new ToolRegistry(toolRepo, executionLogRepo);
  const skillRegistry = new SkillRegistry(skillRepo, toolRegistry, executionLogRepo);

  // 初始化全局工具
  const { initializeGlobalTools } = await import('@/lib/tools/init');
  await initializeGlobalTools(toolRegistry);

  // 创建安装组件
  const downloader = new PackageDownloader();
  const validator = new PackageValidator(config.maxPackageSize);
  const parser = new SkillParser();
  const resolver = new InstallDependencyResolver(toolRegistry);

  skillInstaller = new SkillInstaller(
    downloader,
    validator,
    parser,
    resolver,
    skillRegistry,
    installLogRepo
  );

  return skillInstaller;
}
