/**
 * 全局工具初始化模块
 * 负责在应用启动时自动注册全局工具
 */

import * as fs from 'fs';
import * as path from 'path';
import { ToolRegistry } from '@/lib/skills/toolRegistry';
import { GlobalToolsRegistry, GlobalToolsConfig } from './GlobalToolsRegistry';

/**
 * 加载全局工具配置
 */
export function loadGlobalToolsConfig(): GlobalToolsConfig {
  const configPath = path.join(
    process.cwd(),
    '.codeartsdoer',
    'config',
    'global-tools.json'
  );

  try {
    if (fs.existsSync(configPath)) {
      const configContent = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(configContent);

      // 替换环境变量占位符
      if (config.security?.allowedDirectories) {
        config.security.allowedDirectories = config.security.allowedDirectories.map(
          (dir: string) => {
            if (dir === '${PROJECT_ROOT}') {
              return process.cwd();
            }
            // 替换其他环境变量
            return dir.replace(/\$\{([^}]+)\}/g, (_, key) => {
              return process.env[key] || '';
            });
          }
        );
      }

      return config;
    }
  } catch (error) {
    console.warn('Failed to load global tools config, using defaults:', error);
  }

  // 返回默认配置
  return {};
}

/**
 * 全局工具注册器实例（单例）
 */
let globalToolsRegistryInstance: GlobalToolsRegistry | null = null;

/**
 * 初始化全局工具
 * 在应用启动时调用，将四个工具注册到 ToolRegistry
 */
export async function initializeGlobalTools(
  toolRegistry: ToolRegistry
): Promise<GlobalToolsRegistry> {
  // 如果已经初始化，直接返回实例
  if (globalToolsRegistryInstance && globalToolsRegistryInstance.isRegistered()) {
    console.log('Global tools already initialized');
    return globalToolsRegistryInstance;
  }

  try {
    // 加载配置
    const config = loadGlobalToolsConfig();

    // 创建全局工具注册器
    globalToolsRegistryInstance = new GlobalToolsRegistry(config);

    // 注册所有工具
    await globalToolsRegistryInstance.registerAll(toolRegistry);

    console.log('✅ Global tools initialized successfully');
    console.log('   - Read tool: file reading with line numbers');
    console.log('   - Write tool: file writing and creation');
    console.log('   - Edit tool: file editing with string replacement');
    console.log('   - Bash tool: command execution with sandbox');

    return globalToolsRegistryInstance;
  } catch (error) {
    console.error('❌ Failed to initialize global tools:', error);
    throw error;
  }
}

/**
 * 获取全局工具注册器实例
 */
export function getGlobalToolsRegistry(): GlobalToolsRegistry | null {
  return globalToolsRegistryInstance;
}

/**
 * 清理全局工具
 * 在应用关闭时调用
 */
export async function cleanupGlobalTools(
  toolRegistry: ToolRegistry
): Promise<void> {
  if (globalToolsRegistryInstance) {
    try {
      await globalToolsRegistryInstance.unregisterAll(toolRegistry);
      globalToolsRegistryInstance = null;
      console.log('Global tools cleaned up successfully');
    } catch (error) {
      console.error('Failed to cleanup global tools:', error);
      throw error;
    }
  }
}
