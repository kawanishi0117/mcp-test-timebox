/**
 * ProcessExecutor - プロセス実行とタイムアウト監視コンポーネント
 * 
 * 子プロセスを生成し、タイムアウト監視を行う。
 * - stdinを即座に閉じる
 * - tree-killでプロセスツリーごと終了
 * - stdout/stderrをLogEntryとして収集
 * 
 * Requirements:
 * - 3.1: プロセス起動時にstdinを即座に閉じる
 * - 3.2: timeout_ms で指定された時間が経過したらプロセスを強制終了
 * - 3.3: no_output_timeout_ms で指定された時間、出力がなければ強制終了
 * - 3.4: プロセスツリーごと終了する
 * - 3.5: exit code 0 で pass、それ以外で fail を返す
 */

import { spawn, type ChildProcess } from 'node:child_process';
import treeKill from 'tree-kill';
import { createTimeboxController, type ITimeboxController, type TimeoutType } from './timebox-controller.js';

/**
 * ログエントリ - stdout/stderrの出力を記録
 */
export interface LogEntry {
  /** Unix timestamp (ms) */
  timestamp: number;
  /** 出力元ストリーム */
  stream: 'stdout' | 'stderr';
  /** 出力データ */
  data: string;
}

/**
 * プロセス実行結果のステータス
 */
export type ProcessStatus = 'pass' | 'fail' | 'timeout' | 'no_output' | 'error';

/**
 * プロセス実行結果
 */
export interface ProcessResult {
  /** 実行ステータス */
  status: ProcessStatus;
  /** 終了コード（タイムアウト時はnull） */
  exitCode: number | null;
  /** 実行時間（ミリ秒） */
  durationMs: number;
  /** ログエントリ（stdout/stderr） */
  logs: LogEntry[];
  /** タイムアウトしたかどうか */
  timedOut: boolean;
  /** 無出力タイムアウトしたかどうか */
  noOutput: boolean;
}

/**
 * プロセス実行オプション
 */
export interface ProcessExecutorOptions {
  /** 作業ディレクトリ */
  cwd: string;
  /** ハードタイムアウト（ミリ秒） */
  timeoutMs: number;
  /** 無出力タイムアウト（ミリ秒） */
  noOutputTimeoutMs: number;
}


/**
 * ProcessExecutorインターフェース
 */
export interface IProcessExecutor {
  /**
   * プロセスを実行し、タイムアウト監視を行う
   * 
   * @param command - 実行するコマンド
   * @param args - コマンド引数
   * @param options - 実行オプション
   * @returns プロセス実行結果
   */
  execute(
    command: string,
    args: string[],
    options: ProcessExecutorOptions
  ): Promise<ProcessResult>;
}

/**
 * ProcessExecutor - プロセス実行の実装
 */
export class ProcessExecutor implements IProcessExecutor {
  /**
   * プロセスを実行し、タイムアウト監視を行う
   * 
   * @param command - 実行するコマンド
   * @param args - コマンド引数
   * @param options - 実行オプション
   * @returns プロセス実行結果
   */
  async execute(
    command: string,
    args: string[],
    options: ProcessExecutorOptions
  ): Promise<ProcessResult> {
    const startTime = Date.now();
    const logs: LogEntry[] = [];
    const timebox = createTimeboxController();
    
    return new Promise<ProcessResult>((resolve) => {
      let childProcess: ChildProcess | null = null;
      let resolved = false;

      /**
       * 結果を返す（一度だけ）
       */
      const finalize = (result: ProcessResult) => {
        if (resolved) return;
        resolved = true;
        timebox.clear();
        resolve(result);
      };

      /**
       * プロセスを強制終了する
       */
      const killProcess = (timeoutType: TimeoutType) => {
        if (childProcess && childProcess.pid) {
          // tree-killでプロセスツリーごと終了（Requirements 3.4）
          treeKill(childProcess.pid, 'SIGKILL', (err) => {
            if (err) {
              // エラーが発生してもログに記録するのみ
              console.error(`[ProcessExecutor] tree-kill error: ${err.message}`);
            }
          });
        }

        const durationMs = Date.now() - startTime;
        const isNoOutput = timeoutType === 'no_output';
        
        finalize({
          status: isNoOutput ? 'no_output' : 'timeout',
          exitCode: null,
          durationMs,
          logs,
          timedOut: !isNoOutput,
          noOutput: isNoOutput,
        });
      };

      try {
        // プロセスを起動
        childProcess = spawn(command, args, {
          cwd: options.cwd,
          stdio: ['pipe', 'pipe', 'pipe'],
          // Windowsでは shell: true が必要な場合がある
          shell: process.platform === 'win32',
        });

        // stdinを即座に閉じる（Requirements 3.1）
        if (childProcess.stdin) {
          childProcess.stdin.end();
        }

        // タイムアウト設定（Requirements 3.2, 3.3）
        timebox.setHardTimeout(options.timeoutMs, killProcess);
        timebox.setNoOutputTimeout(options.noOutputTimeoutMs, killProcess);

        // stdout監視
        if (childProcess.stdout) {
          childProcess.stdout.on('data', (data: Buffer) => {
            const entry: LogEntry = {
              timestamp: Date.now(),
              stream: 'stdout',
              data: data.toString(),
            };
            logs.push(entry);
            timebox.notifyOutput();
          });
        }

        // stderr監視
        if (childProcess.stderr) {
          childProcess.stderr.on('data', (data: Buffer) => {
            const entry: LogEntry = {
              timestamp: Date.now(),
              stream: 'stderr',
              data: data.toString(),
            };
            logs.push(entry);
            timebox.notifyOutput();
          });
        }

        // プロセス終了時
        childProcess.on('close', (code: number | null) => {
          const durationMs = Date.now() - startTime;
          
          // exit code に基づいてステータスを決定（Requirements 3.5）
          const status: ProcessStatus = code === 0 ? 'pass' : 'fail';
          
          finalize({
            status,
            exitCode: code,
            durationMs,
            logs,
            timedOut: false,
            noOutput: false,
          });
        });

        // プロセスエラー時
        childProcess.on('error', (err: Error) => {
          const durationMs = Date.now() - startTime;
          
          finalize({
            status: 'error',
            exitCode: null,
            durationMs,
            logs,
            timedOut: false,
            noOutput: false,
          });
        });

      } catch (err) {
        // spawn自体が失敗した場合
        const durationMs = Date.now() - startTime;
        
        finalize({
          status: 'error',
          exitCode: null,
          durationMs,
          logs,
          timedOut: false,
          noOutput: false,
        });
      }
    });
  }
}

/**
 * ProcessExecutorのファクトリ関数
 * 
 * @returns 新しいProcessExecutorインスタンス
 */
export function createProcessExecutor(): IProcessExecutor {
  return new ProcessExecutor();
}
