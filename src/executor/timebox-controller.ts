/**
 * TimeboxController - タイムアウト監視コンポーネント
 * 
 * プロセス実行のタイムアウトを管理する。
 * - ハードタイムアウト: 指定時間経過で強制終了
 * - 無出力タイムアウト: 出力がない状態が続くと強制終了
 * 
 * Requirements:
 * - 3.2: timeout_ms で指定された時間が経過したらプロセスを強制終了
 * - 3.3: no_output_timeout_ms で指定された時間、出力がなければ強制終了
 */

/**
 * タイムアウトの種類
 */
export type TimeoutType = 'hard' | 'no_output';

/**
 * タイムアウト発生時のコールバック
 */
export type TimeoutCallback = (type: TimeoutType) => void;

/**
 * TimeboxControllerインターフェース
 */
export interface ITimeboxController {
  /** ハードタイムアウトを設定 */
  setHardTimeout(ms: number, onTimeout: TimeoutCallback): void;
  /** 無出力タイムアウトを設定 */
  setNoOutputTimeout(ms: number, onTimeout: TimeoutCallback): void;
  /** 出力があったことを通知（無出力タイマーをリセット） */
  notifyOutput(): void;
  /** すべてのタイマーをクリア */
  clear(): void;
  /** タイムアウトが発生したかどうか */
  isTimedOut(): boolean;
  /** タイムアウトの種類を取得 */
  getTimeoutType(): TimeoutType | null;
}

/**
 * TimeboxController - タイムアウト監視の実装
 * 
 * 2種類のタイムアウトを管理:
 * 1. ハードタイムアウト: 設定後、指定時間で必ず発火
 * 2. 無出力タイムアウト: 出力があるたびにリセットされる
 */
export class TimeboxController implements ITimeboxController {
  /** ハードタイムアウトのタイマーID */
  private hardTimeoutId: ReturnType<typeof setTimeout> | null = null;
  
  /** 無出力タイムアウトのタイマーID */
  private noOutputTimeoutId: ReturnType<typeof setTimeout> | null = null;
  
  /** 無出力タイムアウトの設定値（リセット用） */
  private noOutputTimeoutMs: number | null = null;
  
  /** 無出力タイムアウトのコールバック（リセット用） */
  private noOutputCallback: TimeoutCallback | null = null;
  
  /** タイムアウトが発生したかどうか */
  private timedOut = false;
  
  /** 発生したタイムアウトの種類 */
  private timeoutType: TimeoutType | null = null;

  /**
   * ハードタイムアウトを設定する
   * 
   * 指定時間経過後、コールバックを呼び出す。
   * 一度設定すると、clear()が呼ばれるまでリセットされない。
   * 
   * @param ms - タイムアウト時間（ミリ秒）
   * @param onTimeout - タイムアウト時のコールバック
   */
  setHardTimeout(ms: number, onTimeout: TimeoutCallback): void {
    // 既存のタイマーをクリア
    if (this.hardTimeoutId !== null) {
      clearTimeout(this.hardTimeoutId);
    }

    // 新しいタイマーを設定
    this.hardTimeoutId = setTimeout(() => {
      this.timedOut = true;
      this.timeoutType = 'hard';
      this.clear();
      onTimeout('hard');
    }, ms);
  }

  /**
   * 無出力タイムアウトを設定する
   * 
   * 指定時間、stdout/stderrに出力がない場合にコールバックを呼び出す。
   * notifyOutput()が呼ばれるとタイマーがリセットされる。
   * 
   * @param ms - タイムアウト時間（ミリ秒）
   * @param onTimeout - タイムアウト時のコールバック
   */
  setNoOutputTimeout(ms: number, onTimeout: TimeoutCallback): void {
    // 設定値を保存（リセット用）
    this.noOutputTimeoutMs = ms;
    this.noOutputCallback = onTimeout;

    // タイマーを開始
    this.resetNoOutputTimer();
  }

  /**
   * 出力があったことを通知する
   * 
   * 無出力タイマーをリセットする。
   * ハードタイムアウトには影響しない。
   */
  notifyOutput(): void {
    // 無出力タイマーが設定されている場合のみリセット
    if (this.noOutputTimeoutMs !== null && this.noOutputCallback !== null) {
      this.resetNoOutputTimer();
    }
  }

  /**
   * すべてのタイマーをクリアする
   * 
   * プロセス終了時や、タイムアウト発生時に呼び出す。
   */
  clear(): void {
    // ハードタイムアウトをクリア
    if (this.hardTimeoutId !== null) {
      clearTimeout(this.hardTimeoutId);
      this.hardTimeoutId = null;
    }

    // 無出力タイムアウトをクリア
    if (this.noOutputTimeoutId !== null) {
      clearTimeout(this.noOutputTimeoutId);
      this.noOutputTimeoutId = null;
    }

    // 設定値はクリアしない（状態確認用に保持）
  }

  /**
   * タイムアウトが発生したかどうかを返す
   */
  isTimedOut(): boolean {
    return this.timedOut;
  }

  /**
   * 発生したタイムアウトの種類を返す
   */
  getTimeoutType(): TimeoutType | null {
    return this.timeoutType;
  }

  /**
   * 無出力タイマーをリセットする（内部メソッド）
   */
  private resetNoOutputTimer(): void {
    // 既存のタイマーをクリア
    if (this.noOutputTimeoutId !== null) {
      clearTimeout(this.noOutputTimeoutId);
    }

    // 新しいタイマーを設定
    if (this.noOutputTimeoutMs !== null && this.noOutputCallback !== null) {
      const callback = this.noOutputCallback;
      this.noOutputTimeoutId = setTimeout(() => {
        this.timedOut = true;
        this.timeoutType = 'no_output';
        this.clear();
        callback('no_output');
      }, this.noOutputTimeoutMs);
    }
  }
}

/**
 * TimeboxControllerのファクトリ関数
 * 
 * @returns 新しいTimeboxControllerインスタンス
 */
export function createTimeboxController(): ITimeboxController {
  return new TimeboxController();
}
