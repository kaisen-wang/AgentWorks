/**
 * 安装模块配置
 */

import { tmpdir } from 'os';
import { join } from 'path';
import type { InstallConfig } from '@/types';

const DEFAULT_CONFIG: InstallConfig = {
  tempDir: join(tmpdir(), 'skill-install'),
  maxPackageSize: 100 * 1024 * 1024, // 100MB
  downloadTimeout: 30000, // 30 seconds
  maxRetries: 3,
  maxConcurrentInstalls: 5,
  enableCache: false,
  cacheDir: join(tmpdir(), 'skill-install-cache'),
};

let config: InstallConfig = { ...DEFAULT_CONFIG };

/**
 * 获取安装配置
 */
export function getInstallConfig(): InstallConfig {
  return config;
}

/**
 * 更新安装配置
 */
export function updateInstallConfig(updates: Partial<InstallConfig>): void {
  config = { ...config, ...updates };
}

/**
 * 重置为默认配置
 */
export function resetInstallConfig(): void {
  config = { ...DEFAULT_CONFIG };
}
