/**
 * Skill 安装协调器
 *
 * 编排整个安装流程：下载 → 验证 → 解析 → 依赖解析 → 注册
 * 支持回滚、进度查询和取消。
 */

import { v4 as uuidv4 } from 'uuid';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import type {
  AgentId,
  ResourceScope,
  SkillDefinition,
  InstallResult,
  InstallProgress,
  InstallContext,
  InstallStep,
  InstallLog,
  InstallOptions,
  InstallErrorCode,
} from '@/types';
import type { ISkillRegistry } from '@/lib/skills/types';
import { PackageDownloader } from './packageDownloader';
import { PackageValidator } from './packageValidator';
import { SkillParser } from './skillParser';
import { InstallDependencyResolver } from './installDependencyResolver';
import { RollbackManager } from './rollbackManager';
import { InstallLogRepo } from '@/lib/db/installLogRepo';

/** 安装错误类 */
class InstallError extends Error {
  code: InstallErrorCode;
  details?: unknown;

  constructor(code: InstallErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'InstallError';
    this.code = code;
    this.details = details;
  }
}

/** 步骤权重（用于进度计算） */
const STEP_WEIGHTS: Record<string, number> = {
  download: 20,
  validate: 10,
  parse: 10,
  resolve_dependencies: 20,
  register: 40,
};

export class SkillInstaller {
  private activeInstalls = new Map<string, InstallContext>();

  constructor(
    private downloader: PackageDownloader,
    private validator: PackageValidator,
    private parser: SkillParser,
    private dependencyResolver: InstallDependencyResolver,
    private skillRegistry: ISkillRegistry,
    private installLogRepo: InstallLogRepo
  ) {}

  /**
   * 安装 Skill
   */
  async install(
    url: string,
    scope: ResourceScope,
    agentId: AgentId,
    options?: InstallOptions
  ): Promise<InstallResult> {
    const installId = uuidv4();
    const tempDir = await mkdtemp(join(tmpdir(), 'skill-install-'));
    const rollbackManager = new RollbackManager();
    const now = Date.now();

    // 创建安装上下文
    const context: InstallContext = {
      installId,
      agentId,
      scope,
      sourceUrl: url,
      options: options || {},
      tempDir,
      startTime: now,
      steps: [],
    };

    this.activeInstalls.set(installId, context);

    try {
      // 记录开始日志
      this.installLogRepo.create({
        installId,
        resourceType: 'skill',
        resourceId: '',
        agentId,
        sourceUrl: url,
        scope,
        status: 'in_progress',
        step: 'start',
        durationMs: 0,
        createdAt: now,
        updatedAt: now,
      });

      // 步骤 1: 下载
      const downloadStep = this.addStep(context, 'download');
      const downloadResult = await this.downloader.download(url, tempDir, {
        timeout: options?.downloadTimeout,
        maxRetries: options?.maxRetries,
      });

      if (!downloadResult.success) {
        throw new InstallError('DOWNLOAD_FAILED' as InstallErrorCode, downloadResult.error!.message);
      }
      this.completeStep(downloadStep);

      rollbackManager.register('download', async () => {
        await rm(tempDir, { recursive: true }).catch(() => {});
      });

      // 步骤 2: 验证
      if (!options?.skipValidation) {
        const validateStep = this.addStep(context, 'validate');
        const validationResult = await this.validator.validate(downloadResult.packagePath!);

        if (!validationResult.valid) {
          const errorMessages = validationResult.errors.map(e => e.message).join('; ');
          throw new InstallError('VALIDATION_FAILED' as InstallErrorCode, errorMessages, validationResult.errors);
        }
        this.completeStep(validateStep);
      }

      // 步骤 3: 解析
      const parseStep = this.addStep(context, 'parse');
      let skillDefinition: SkillDefinition;
      try {
        skillDefinition = await this.parser.parse(downloadResult.packagePath!);
      } catch (err) {
        throw new InstallError(
          'PARSE_FAILED' as InstallErrorCode,
          `Failed to parse skill package: ${err instanceof Error ? err.message : String(err)}`
        );
      }
      this.completeStep(parseStep);

      // 步骤 4: 解析依赖
      const depStep = this.addStep(context, 'resolve_dependencies');
      const depResolution = await this.dependencyResolver.resolve(
        skillDefinition.dependencies,
        agentId
      );

      if (depResolution.hasCircular) {
        throw new InstallError('CIRCULAR_DEPENDENCY' as InstallErrorCode, 'Circular dependency detected');
      }

      if (depResolution.missing.length > 0) {
        if (options?.autoInstallDependencies !== false) {
          // 自动安装缺失的依赖
          const autoResult = await this.dependencyResolver.autoInstall(depResolution.missing, agentId);
          if (!autoResult.success) {
            const failedMsg = autoResult.failed.map(f => `${f.toolId}: ${f.error}`).join('; ');
            throw new InstallError('DEPENDENCY_MISSING' as InstallErrorCode, `Missing dependencies: ${failedMsg}`);
          }
        } else {
          const missingIds = depResolution.missing.map(d => d.toolId).join(', ');
          throw new InstallError('DEPENDENCY_MISSING' as InstallErrorCode, `Missing required dependencies: ${missingIds}`);
        }
      }
      this.completeStep(depStep);

      // 步骤 5: 注册
      const registerStep = this.addStep(context, 'register');
      try {
        await this.skillRegistry.register(skillDefinition, scope, agentId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('already') || msg.includes('duplicate')) {
          throw new InstallError('DUPLICATE_SKILL_ID' as InstallErrorCode, msg);
        }
        throw new InstallError('REGISTRATION_FAILED' as InstallErrorCode, msg);
      }
      this.completeStep(registerStep);

      rollbackManager.register('register', async () => {
        await this.skillRegistry.unregister(skillDefinition.meta.id, scope, agentId).catch(() => {});
      });

      // 更新日志为成功
      this.installLogRepo.update(installId, {
        resourceId: skillDefinition.meta.id,
        status: 'completed',
        step: 'completed',
        durationMs: Date.now() - context.startTime,
        updatedAt: Date.now(),
      });

      return {
        success: true,
        installId,
        skillId: skillDefinition.meta.id,
      };
    } catch (err) {
      // 执行回滚
      await rollbackManager.rollback();

      const installErr = err instanceof InstallError
        ? err
        : new InstallError('REGISTRATION_FAILED' as InstallErrorCode, err instanceof Error ? err.message : String(err));

      // 更新日志为失败
      const currentStep = context.steps[context.steps.length - 1];
      this.installLogRepo.update(installId, {
        status: 'failed',
        step: currentStep?.name || 'unknown',
        errorMessage: installErr.message,
        errorDetails: JSON.stringify({ code: installErr.code, details: installErr.details }),
        durationMs: Date.now() - context.startTime,
        updatedAt: Date.now(),
      });

      return {
        success: false,
        installId,
        error: {
          code: installErr.code,
          message: installErr.message,
          details: installErr.details,
        },
      };
    } finally {
      // 清理临时资源
      await rm(tempDir, { recursive: true }).catch(() => {});
      this.activeInstalls.delete(installId);
    }
  }

  /**
   * 查询安装进度
   */
  getProgress(installId: string): InstallProgress {
    const log = this.installLogRepo.findById(installId);
    if (!log) {
      throw new Error('Install not found');
    }

    const context = this.activeInstalls.get(installId);
    const currentStep = context?.steps[context.steps.length - 1];

    return {
      installId,
      status: log.status,
      progress: {
        step: currentStep?.name || log.step,
        percentage: this.calculateProgress(context),
        message: currentStep?.status || log.status,
      },
      result: log.status === 'completed' && log.resourceId
        ? { skillId: log.resourceId, skillName: '', scope: log.scope }
        : undefined,
      error: log.errorMessage
        ? { code: 'INSTALL_ERROR', message: log.errorMessage }
        : undefined,
      duration: Date.now() - log.createdAt,
    };
  }

  /**
   * 取消安装
   */
  async cancel(installId: string): Promise<void> {
    const context = this.activeInstalls.get(installId);
    if (!context) {
      throw new Error('Install not found or already completed');
    }

    // 标记当前步骤为失败
    const currentStep = context.steps[context.steps.length - 1];
    if (currentStep) {
      currentStep.status = 'failed';
      currentStep.error = new Error('Cancelled by user');
    }

    // 更新日志
    this.installLogRepo.update(installId, {
      status: 'failed',
      step: 'cancelled',
      errorMessage: 'Installation cancelled by user',
      durationMs: Date.now() - context.startTime,
      updatedAt: Date.now(),
    });
  }

  /**
   * 添加安装步骤
   */
  private addStep(context: InstallContext, name: string): InstallStep {
    const step: InstallStep = {
      name,
      status: 'in_progress',
      startTime: Date.now(),
    };
    context.steps.push(step);
    return step;
  }

  /**
   * 完成安装步骤
   */
  private completeStep(step: InstallStep): void {
    step.status = 'completed';
    step.endTime = Date.now();
  }

  /**
   * 计算安装进度百分比
   */
  private calculateProgress(context?: InstallContext): number {
    if (!context) return 0;

    let progress = 0;
    for (const step of context.steps) {
      const weight = STEP_WEIGHTS[step.name] || 0;
      if (step.status === 'completed') {
        progress += weight;
      } else if (step.status === 'in_progress') {
        progress += weight * 0.5;
      }
    }

    return Math.min(progress, 100);
  }
}
