/**
 * 包下载器
 *
 * 支持多种 URL 类型的下载，根据 URL 类型自动选择下载策略。
 */

import { validateUrl } from './urlValidator';
import { downloadHttp } from './handlers/httpHandler';
import { downloadFile } from './handlers/fileHandler';
import { downloadGit } from './handlers/gitHandler';
import type { DownloadOptions, DownloadResult, UrlValidationResult } from '@/types';

export class PackageDownloader {
  /**
   * 下载包
   */
  async download(
    url: string,
    targetDir: string,
    options?: DownloadOptions
  ): Promise<DownloadResult> {
    // 验证 URL
    const validation = validateUrl(url);
    if (!validation.valid) {
      return { success: false, error: new Error(validation.error) };
    }

    // 根据类型选择下载策略
    switch (validation.type) {
      case 'http':
      case 'https':
        // 检查是否为 Git HTTPS URL
        if (url.endsWith('.git')) {
          return await downloadGit(url, targetDir);
        }
        return await downloadHttp(url, targetDir, options);
      case 'file':
        return await downloadFile(url, targetDir);
      case 'git':
        return await downloadGit(url, targetDir);
      default:
        return { success: false, error: new Error(`Unsupported URL type: ${validation.type}`) };
    }
  }

  /**
   * 验证 URL 可访问性
   */
  async validateUrl(url: string): Promise<UrlValidationResult> {
    return validateUrl(url);
  }
}
