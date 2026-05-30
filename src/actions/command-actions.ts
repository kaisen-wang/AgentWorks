/**
 * 命令执行 Server Actions
 *
 * 将 run_command 和 install_skill 的执行逻辑移到服务端，
 * 客户端通过 Server Action 调用，自动在服务端执行。
 */

"use server";

/** 命令执行结果 */
export interface CommandResult {
  success: boolean;
  output?: string;
  error?: string;
}

/** 允许执行的命令白名单 */
const ALLOWED_COMMANDS = [
  "npm install",
  "npm run build",
  "npm run dev",
  "npm test",
  "npm run lint",
  "yarn install",
  "yarn build",
  "yarn dev",
  "yarn test",
  "pnpm install",
  "pnpm build",
  "pnpm dev",
  "pnpm test",
  "git clone",
  "ls",
  "cat",
  "curl",
  "wget",
  "mkdir",
  "cp",
  "mv",
];

/**
 * 在服务端执行 shell 命令
 *
 * 安全检查：只允许白名单中的命令
 */
export async function executeCommand(command: string): Promise<CommandResult> {
  // 安全检查：只允许特定命令
  const isAllowed = ALLOWED_COMMANDS.some((allowed) => command.startsWith(allowed));

  if (!isAllowed) {
    return {
      success: false,
      error: `命令不允许执行: ${command}。只允许: ${ALLOWED_COMMANDS.join(", ")}`,
    };
  }

  try {
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);

    const { stdout, stderr } = await execAsync(command, {
      cwd: process.cwd(),
      timeout: 30000, // 30秒超时
    });

    return {
      success: true,
      output: stdout || stderr || "命令执行成功",
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
