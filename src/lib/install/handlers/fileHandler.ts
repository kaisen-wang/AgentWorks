/**
 * 本地文件下载处理器
 *
 * 支持从本地文件路径复制 Skill 包。
 */

import { copyFile, mkdir, stat, readFile } from 'fs/promises';
import { createHash } from 'crypto';
import path from 'path';
import type { DownloadResult } from '@/types';

/**
 * 从本地文件路径复制包
 */
export async function downloadFile(
  url: string,
  targetDir: string
): Promise<DownloadResult> {
  try {
    // 解析 file:// URL 或直接路径
    let sourcePath: string;
    if (url.startsWith('file://')) {
      sourcePath = decodeURIComponent(new URL(url).pathname);
    } else {
      sourcePath = url;
    }

    // 检查源文件存在
    const fileStat = await stat(sourcePath);
    if (!fileStat.isFile()) {
      return { success: false, error: new Error(`Source path is not a file: ${sourcePath}`) };
    }

    // 创建目标目录
    await mkdir(targetDir, { recursive: true });

    // 复制文件
    const fileName = path.basename(sourcePath);
    const targetPath = path.join(targetDir, fileName);
    await copyFile(sourcePath, targetPath);

    // 计算校验和
    const content = await readFile(sourcePath);
    const hash = createHash('sha256').update(content).digest('hex');

    return {
      success: true,
      packagePath: targetPath,
      checksum: hash,
      size: fileStat.size,
    };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { success: false, error };
  }
}
