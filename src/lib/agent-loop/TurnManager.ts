/**
 * TurnManager - Turn 管理器
 *
 * 在 turn 之间调用 prepareNextTurn 钩子修改上下文/模型，
 * 判断 shouldStopAfterTurn 停止条件。
 */

import type {
  PrepareNextTurnFn,
  PrepareNextTurnResult,
  ShouldStopAfterTurnFn,
  TurnContext,
} from "./types";

export class TurnManager {
  constructor(
    private readonly prepareNextTurnFn?: PrepareNextTurnFn,
    private readonly shouldStopAfterTurnFn?: ShouldStopAfterTurnFn,
  ) {}

  /**
   * 在 turn 之间调用 prepareNextTurn 钩子
   *
   * 若配置了钩子则调用并返回修改结果，否则返回空对象（不修改）。
   */
  async prepareNextTurn(context: TurnContext): Promise<PrepareNextTurnResult> {
    if (!this.prepareNextTurnFn) {
      return {};
    }
    const result = await this.prepareNextTurnFn(context);
    return result ?? {};
  }

  /**
   * 判断是否应在当前 turn 后停止
   *
   * 若配置了钩子则调用并返回其结果，否则返回 false（使用默认条件）。
   */
  async shouldStopAfterTurn(context: TurnContext): Promise<boolean> {
    if (!this.shouldStopAfterTurnFn) {
      return false;
    }
    return this.shouldStopAfterTurnFn(context);
  }
}
