/**
 * HTTP/HTTPS 下载处理器
 *
 * 支持流式下载、超时控制、重试机制和进度回调。
 */

import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { createHash } from 'crypto';
import path from 'path';
import type { DownloadOptions, DownloadResult, DownloadProgress } from '@/types';

const DEFAULT_TIMEOUT = 30000;
const DEFAULT_MAX_RETRIES = 3;

/**
 * 通过 HTTP/HTTPS 下载包
 */
export async function downloadHttp(
  url: string,
  targetDir: string,
  options?: DownloadOptions
): Promise<DownloadResult> {
  const timeout = options?.timeout ?? DEFAULT_TIMEOUT;
  const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;

  await mkdir(targetDir, { recursive: true });

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      // 流式下载
      const filePath = path.join(targetDir, 'package.tar.gz');
      const fileStream = createWriteStream(filePath);
      const hash = createHash('sha256');

      const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
      let downloaded = 0;

      const reader = response.body.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          fileStream.write(value);
          hash.update(value);
          downloaded += value.length;

          if (options?.onProgress && contentLength > 0) {
            options.onProgress({
              total: contentLength,
              downloaded,
              percentage: (downloaded / contentLength) * 100,
            } satisfies DownloadProgress);
          }
        }
      } finally {
        fileStream.end();
        reader.releaseLock();
      }

      // 等待文件写入完成
      await new Promise<void>((resolve, reject) => {
        fileStream.on('finish', resolve);
        fileStream.on('error', reject);
      });

      return {
        success: true,
        packagePath: filePath,
        checksum: hash.digest('hex'),
        size: downloaded,
      };
    } catch (err) {
      const isLastAttempt = attempt === maxRetries - 1;
      if (isLastAttempt) {
        const error = err instanceof Error ? err : new Error(String(err));
        return { success: false, error };
      }

      // 等待后重试（指数退避）
      await sleep(1000 * Math.pow(2, attempt));
    }
  }

  return { success: false, error: new Error('Max retries exceeded') };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
