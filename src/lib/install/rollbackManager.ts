/**
 * 回滚管理器
 *
 * 管理安装过程中的回滚操作，按相反顺序执行。
 */

export class RollbackManager {
  private operations: Array<{ step: string; operation: () => Promise<void> }> = [];

  /**
   * 注册回滚操作
   */
  register(step: string, operation: () => Promise<void>): void {
    this.operations.push({ step, operation });
  }

  /**
   * 执行回滚（按相反顺序）
   */
  async rollback(): Promise<void> {
    const errors: Error[] = [];

    for (let i = this.operations.length - 1; i >= 0; i--) {
      const { step, operation } = this.operations[i];
      try {
        await operation();
      } catch (err) {
        errors.push(
          new Error(`Rollback failed for step "${step}": ${err instanceof Error ? err.message : String(err)}`)
        );
      }
    }

    if (errors.length > 0) {
      // 记录回滚错误，但不抛出（避免掩盖原始错误）
      console.error('[RollbackManager] Rollback errors:', errors.map(e => e.message));
    }
  }

  /**
   * 获取已注册的步骤数
   */
  get size(): number {
    return this.operations.length;
  }

  /**
   * 清空所有回滚操作
   */
  clear(): void {
    this.operations = [];
  }
}
