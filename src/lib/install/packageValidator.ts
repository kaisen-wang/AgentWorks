/**
 * 包验证器
 *
 * 验证 Skill 包的完整性、结构和安全性。
 */

import { readFile, stat, readdir } from 'fs/promises';
import { join } from 'path';
import type {
  ValidationResult,
  ValidationError,
  ValidationWarning,
  PackageMetadata,
} from '@/types';

const MAX_PACKAGE_SIZE = 100 * 1024 * 1024; // 100MB
const REQUIRED_FILES = ['skill.json'];

/** 可疑代码模式（安全扫描） */
const SUSPICIOUS_PATTERNS = [
  { pattern: /eval\s*\(/, name: 'eval() usage' },
  { pattern: /Function\s*\(/, name: 'Function() constructor' },
  { pattern: /require\s*\(\s*['"]child_process['"]\s*\)/, name: 'child_process require' },
  { pattern: /process\.exit/, name: 'process.exit() call' },
];

export class PackageValidator {
  private maxPackageSize: number;

  constructor(maxPackageSize: number = MAX_PACKAGE_SIZE) {
    this.maxPackageSize = maxPackageSize;
  }

  /**
   * 验证包
   */
  async validate(packagePath: string): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let metadata: PackageMetadata | undefined;

    // 检查包路径存在
    try {
      const stats = await stat(packagePath);
      if (stats.isDirectory()) {
        // 目录形式的包
        await this.validateDirectory(packagePath, errors, warnings);
      } else if (stats.isFile()) {
        // 文件形式的包（压缩包）
        if (stats.size > this.maxPackageSize) {
          errors.push({
            code: 'SIZE_EXCEEDED',
            message: `Package size ${stats.size} exceeds limit ${this.maxPackageSize}`,
          });
        }
      }
    } catch {
      errors.push({
        code: 'PATH_NOT_FOUND',
        message: `Package path not found: ${packagePath}`,
      });
      return { valid: false, errors, warnings };
    }

    // 检查必需文件
    for (const file of REQUIRED_FILES) {
      const filePath = join(packagePath, file);
      if (!(await fileExists(filePath))) {
        errors.push({
          code: 'MISSING_FILE',
          message: `Required file "${file}" not found`,
          path: file,
        });
      }
    }

    // 验证 skill.json
    const skillJsonPath = join(packagePath, 'skill.json');
    if (await fileExists(skillJsonPath)) {
      try {
        const content = await readFile(skillJsonPath, 'utf-8');
        const skillJson = JSON.parse(content);
        const skillErrors = this.validateSkillJson(skillJson);
        errors.push(...skillErrors);

        // 提取元数据
        if (skillJson.meta) {
          metadata = {
            name: skillJson.meta.name || '',
            version: skillJson.meta.version || '0.0.0',
            description: skillJson.meta.description || '',
            author: skillJson.meta.author,
          };
        }
      } catch (err) {
        errors.push({
          code: 'INVALID_JSON',
          message: `Failed to parse skill.json: ${err instanceof Error ? err.message : String(err)}`,
          path: 'skill.json',
        });
      }
    }

    // 安全扫描
    const securityWarnings = await this.scanForSecurityIssues(packagePath);
    warnings.push(...securityWarnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      metadata,
    };
  }

  /**
   * 验证目录结构
   */
  private async validateDirectory(
    dirPath: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): Promise<void> {
    try {
      const entries = await readdir(dirPath, { withFileTypes: true });
      let totalSize = 0;

      for (const entry of entries) {
        if (entry.isFile()) {
          const filePath = join(dirPath, entry.name);
          const fileStat = await stat(filePath);
          totalSize += fileStat.size;
        }
      }

      if (totalSize > this.maxPackageSize) {
        errors.push({
          code: 'SIZE_EXCEEDED',
          message: `Package size ${totalSize} exceeds limit ${this.maxPackageSize}`,
        });
      }
    } catch (err) {
      warnings.push({
        code: 'DIR_SCAN_WARNING',
        message: `Could not scan directory: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  /**
   * 验证 skill.json 内容
   */
  private validateSkillJson(skillJson: Record<string, unknown>): ValidationError[] {
    const errors: ValidationError[] = [];
    const meta = skillJson.meta as Record<string, unknown> | undefined;

    if (!meta?.id) {
      errors.push({ code: 'MISSING_FIELD', message: 'meta.id is required', path: 'meta.id' });
    }
    if (!meta?.name) {
      errors.push({ code: 'MISSING_FIELD', message: 'meta.name is required', path: 'meta.name' });
    }
    if (!skillJson.inputSchema) {
      errors.push({ code: 'MISSING_FIELD', message: 'inputSchema is required', path: 'inputSchema' });
    }
    if (!skillJson.outputSchema) {
      errors.push({ code: 'MISSING_FIELD', message: 'outputSchema is required', path: 'outputSchema' });
    }
    if (!skillJson.executor) {
      errors.push({ code: 'MISSING_FIELD', message: 'executor is required', path: 'executor' });
    }

    // 验证 ID 格式
    if (meta?.id && typeof meta.id === 'string') {
      if (!/^[a-zA-Z0-9_-]+$/.test(meta.id)) {
        errors.push({
          code: 'INVALID_FORMAT',
          message: 'meta.id must contain only alphanumeric characters, hyphens, and underscores',
          path: 'meta.id',
        });
      }
    }

    return errors;
  }

  /**
   * 安全扫描：检测可疑代码模式
   */
  private async scanForSecurityIssues(packagePath: string): Promise<ValidationWarning[]> {
    const warnings: ValidationWarning[] = [];

    try {
      const entries = await readdir(packagePath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile() && isScannableFile(entry.name)) {
          const filePath = join(packagePath, entry.name);
          try {
            const content = await readFile(filePath, 'utf-8');
            for (const { pattern, name } of SUSPICIOUS_PATTERNS) {
              if (pattern.test(content)) {
                warnings.push({
                  code: 'SUSPICIOUS_CODE',
                  message: `Suspicious pattern detected: ${name}`,
                  path: entry.name,
                });
              }
            }
          } catch {
            // 忽略读取错误
          }
        }
      }
    } catch {
      // 忽略目录读取错误
    }

    return warnings;
  }
}

/**
 * 检查文件是否存在
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 判断文件是否需要安全扫描
 */
function isScannableFile(fileName: string): boolean {
  const scannableExtensions = ['.js', '.ts', '.mjs', '.cjs'];
  return scannableExtensions.some(ext => fileName.endsWith(ext));
}
