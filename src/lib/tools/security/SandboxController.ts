/**
 * 沙箱控制器
 * 负责在沙箱环境中执行命令
 */

import { spawn, ChildProcess } from 'child_process';
import { SandboxOptions, CommandResult, ToolErrorCode, ToolError } from './types';

export class SandboxController {
  private activeProcesses: Map<string, ChildProcess> = new Map();
  private defaultTimeout: number;

  constructor(defaultTimeout: number = 30000) {
    this.defaultTimeout = defaultTimeout;
  }

  /**
   * 在沙箱中执行命令
   */
  async execute(
    command: string,
    args: string[] = [],
    options: SandboxOptions = {}
  ): Promise<CommandResult> {
    const timeout = options.timeout || this.defaultTimeout;
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      let processKilled = false;

      // 创建子进程
      const childProcess = spawn(command, args, {
        cwd: options.cwd,
        env: options.env || process.env,
        detached: options.detached || false,
        shell: true,
      });

      const processId = `${command}-${startTime}`;
      this.activeProcesses.set(processId, childProcess);

      // 设置超时
      const timeoutId = setTimeout(() => {
        timedOut = true;
        processKilled = true;
        this.kill(processId);
        
        resolve({
          stdout,
          stderr,
          exitCode: null,
          duration: Date.now() - startTime,
          timedOut: true,
        });
      }, timeout);

      // 捕获标准输出
      childProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      // 捕获标准错误
      childProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      // 处理进程结束
      childProcess.on('close', (code) => {
        clearTimeout(timeoutId);
        this.activeProcesses.delete(processId);

        if (!processKilled) {
          resolve({
            stdout,
            stderr,
            exitCode: code,
            duration: Date.now() - startTime,
            timedOut: false,
          });
        }
      });

      // 处理错误
      childProcess.on('error', (error) => {
        clearTimeout(timeoutId);
        this.activeProcesses.delete(processId);

        if (!processKilled) {
          reject(
            new ToolError(
              ToolErrorCode.EXECUTION_FAILED,
              `命令执行失败: ${error.message}`,
              { command, args, error: error.message }
            )
          );
        }
      });
    });
  }

  /**
   * 强制终止进程
   */
  kill(processId: string): boolean {
    const process = this.activeProcesses.get(processId);
    
    if (process) {
      try {
        // 在 Windows 上使用 taskkill，在 Unix 上使用 SIGTERM
        if (process.platform === 'win32') {
          spawn('taskkill', ['/pid', String(process.pid), '/f', '/t']);
        } else {
          process.kill('SIGTERM');
          
          // 如果进程在 5 秒内没有终止，强制杀死
          setTimeout(() => {
            try {
              process.kill('SIGKILL');
            } catch {
              // 进程可能已经终止
            }
          }, 5000);
        }
        
        this.activeProcesses.delete(processId);
        return true;
      } catch (error) {
        return false;
      }
    }
    
    return false;
  }

  /**
   * 终止所有活动进程
   */
  killAll(): void {
    for (const [processId] of this.activeProcesses) {
      this.kill(processId);
    }
  }

  /**
   * 获取活动进程数量
   */
  getActiveProcessCount(): number {
    return this.activeProcesses.size;
  }

  /**
   * 检查命令是否可用
   */
  async isCommandAvailable(command: string): Promise<boolean> {
    try {
      const result = await this.execute('which', [command], { timeout: 5000 });
      return result.exitCode === 0;
    } catch {
      return false;
    }
  }
}
