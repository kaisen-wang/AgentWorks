/**
 * Git 仓库下载处理器
 *
 * 支持从 Git 仓库克隆 Skill 包。
 */

import { mkdir, readFile } from 'fs/promises';
import { createHash } from 'crypto';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { DownloadResult } from '@/types';

const execFileAsync = promisify(execFile);

/**
 * 从 Git 仓库克隆包
 */
export async function downloadGit(
  url: string,
  targetDir: string
): Promise<DownloadResult> {
  try {
    await mkdir(targetDir, { recursive: true });

    // 解析 Git URL
    // 支持 git://host/repo.git 和 https://host/repo.git 格式
    let cloneUrl = url;
    if (url.startsWith('git://')) {
      cloneUrl = url;
    } else if (url.endsWith('.git')) {
      cloneUrl = url;
    }

    const cloneDir = path.join(targetDir, 'repo');

    // 执行 git clone
    await execFileAsync('git', ['clone', '--depth', '1', cloneUrl, cloneDir], {
      timeout: 60000,
    });

    // 计算校验和（对 skill.json 文件）
    const skillJsonPath = path.join(cloneDir, 'skill.json');
    let checksum = '';
    try {
      const content = await readFile(skillJsonPath);
      checksum = createHash('sha256').update(content).digest('hex');
    } catch {
      // skill.json 可能不存在，校验和留空
    }

    // 获取目录大小
    const { stdout } = await execFileAsync('du', ['-sb', cloneDir], {
      timeout: 10000,
    });
    const size = parseInt(stdout.split('\t')[0], 10) || 0;

    return {
      success: true,
      packagePath: cloneDir,
      checksum,
      size,
    };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { success: false, error };
  }
}
