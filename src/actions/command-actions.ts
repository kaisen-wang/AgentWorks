/**
 * 命令执行 Server Actions
 *
 * 将 run_command 和 install_skill 的执行逻辑移到服务端，
 * 客户端通过 Server Action 调用，自动在服务端执行。
 *
 * 安全策略：使用 SecurityManager（黑名单+危险模式检测）+ SandboxController（spawn 执行+超时控制）
 * 替代之前的白名单策略，允许 LLM 执行大部分安全命令。
 */

"use server";

/** 命令执行结果 */
export interface CommandResult {
  success: boolean;
  output?: string;
  error?: string;
}

/** SecurityManager 单例（延迟初始化，避免在客户端环境加载 fs/path） */
let _securityManager: import("@/lib/tools/security").SecurityManager | null = null;
let _sandboxController: import("@/lib/tools/security").SandboxController | null = null;

async function getSecurityInstances() {
  if (!_securityManager || !_sandboxController) {
    const { SecurityManager, SandboxController, defaultSecurityConfig, defaultSecurityPolicy } = await import("@/lib/tools/security");

    _securityManager = new SecurityManager(defaultSecurityConfig, defaultSecurityPolicy);
    _sandboxController = new SandboxController(defaultSecurityConfig.defaultTimeout);
  }
  return { securityManager: _securityManager, sandboxController: _sandboxController };
}

/**
 * 在服务端执行 shell 命令
 *
 * 安全检查：使用 SecurityManager 黑名单+危险模式检测，阻止危险命令，允许安全命令
 */
export async function executeCommand(command: string): Promise<CommandResult> {
  try {
    const { securityManager, sandboxController } = await getSecurityInstances();

    // 安全检查：黑名单+危险模式检测
    const validation = securityManager.validateCommand(command);
    if (!validation.valid) {
      return {
        success: false,
        error: `命令被拒绝: ${validation.errorMessage || "安全检查未通过"}`,
      };
    }

    // 使用 SandboxController 执行命令（spawn + 超时控制）
    const result = await sandboxController.execute(command, [], {
      timeout: 30000,
      cwd: process.cwd(),
    });

    if (result.timedOut) {
      return {
        success: false,
        error: `命令执行超时（30秒）: ${command}`,
      };
    }

    if (result.exitCode !== 0) {
      return {
        success: false,
        error: result.stderr || `命令执行失败，退出码: ${result.exitCode}`,
      };
    }

    return {
      success: true,
      output: result.stdout || result.stderr || "命令执行成功（无输出）",
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: `命令执行失败: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * 在服务端执行 Skill 安装
 */
export async function executeSkillInstall(
  url: string,
  agentId: string,
  scope?: string,
  autoInstallDependencies?: boolean
): Promise<CommandResult> {
  try {
    const { getSkillInstaller } = await import("@/lib/install");
    const installer = await getSkillInstaller();

    const result = await installer.install(
      url,
      (scope === "global" ? "global" : "private") as "global" | "private",
      agentId,
      {
        autoInstallDependencies: autoInstallDependencies !== false,
      }
    );

    if (result.success) {
      return {
        success: true,
        output: `Skill 安装成功: skillId=${result.skillId}, installId=${result.installId}`,
      };
    } else {
      return {
        success: false,
        error: `Skill 安装失败: [${result.error?.code}] ${result.error?.message}`,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: `Skill 安装失败: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
