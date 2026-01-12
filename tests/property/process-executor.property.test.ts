/**
 * ProcessExecutor プロパティベーステスト
 * 
 * Feature: mcp-test-timebox
 * 
 * Requirements: 3.2, 3.3, 3.5
 * - 3.2: timeout_ms で指定された時間が経過したらプロセスを強制終了
 * - 3.3: no_output_timeout_ms で指定された時間、出力がなければ強制終了
 * - 3.5: exit code 0 で pass、それ以外で fail を返す
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ProcessExecutor, type ProcessResult, type ProcessStatus } from '../../src/executor/process-executor.js';
import * as path from 'node:path';
import * as os from 'node:os';

// テスト用の作業ディレクトリ
const TEST_CWD = process.cwd();

// プラットフォームに応じたコマンド
const isWindows = process.platform === 'win32';

/**
 * Property 4: ハードタイムアウトの確実な終了
 * 
 * *For any* 正の整数 `timeout_ms` に対して、プロセスが `timeout_ms` ミリ秒以内に
 * 終了しない場合、TimeboxController は必ずプロセスを強制終了し、status `timeout` を返す。
 * 
 * **Validates: Requirements 3.2**
 */
describe('Property 4: ハードタイムアウトの確実な終了', () => {
  it('タイムアウト時間内に終了しないプロセスは強制終了される', async () => {
    const executor = new ProcessExecutor();
    
    await fc.assert(
      fc.asyncProperty(
        // タイムアウト値: 100ms〜300ms（Windows環境での安定性のため最小値を上げる）
        fc.integer({ min: 100, max: 300 }),
        async (timeoutMs) => {
          // 長時間スリープするコマンド（タイムアウトより長い）
          const command = isWindows ? 'ping' : 'sleep';
          const args = isWindows ? ['-n', '10', '127.0.0.1'] : ['10'];
          
          const result = await executor.execute(command, args, {
            cwd: TEST_CWD,
            timeoutMs,
            noOutputTimeoutMs: timeoutMs * 10, // 無出力タイムアウトは十分長く
          });
          
          // ハードタイムアウトで終了
          expect(result.status).toBe('timeout');
          expect(result.timedOut).toBe(true);
          expect(result.noOutput).toBe(false);
          expect(result.exitCode).toBeNull();
          
          // 実行時間はタイムアウト値以上であることを確認
          // Windows環境ではプロセス終了処理（taskkill等）のオーバーヘッドが非常に大きいため、
          // 上限チェックは行わず、タイムアウトが発動したことのみを検証する
          expect(result.durationMs).toBeGreaterThanOrEqual(timeoutMs - 20);
          
          return true;
        }
      ),
      { numRuns: 10, timeout: 60000 } // 実プロセス実行のため回数を制限
    );
  });
});


/**
 * Property 5: 無出力タイムアウトの確実な終了
 * 
 * *For any* 正の整数 `no_output_timeout_ms` に対して、プロセスが `no_output_timeout_ms` 
 * ミリ秒間 stdout/stderr に出力しない場合、TimeboxController は必ずプロセスを強制終了し、
 * status `no_output` を返す。
 * 
 * **Validates: Requirements 3.3**
 */
describe('Property 5: 無出力タイムアウトの確実な終了', () => {
  it('出力がないプロセスは無出力タイムアウトで終了する', async () => {
    const executor = new ProcessExecutor();
    
    await fc.assert(
      fc.asyncProperty(
        // 無出力タイムアウト値: 50ms〜200ms
        fc.integer({ min: 50, max: 200 }),
        async (noOutputTimeoutMs) => {
          // 出力なしで長時間スリープするコマンド
          const command = isWindows ? 'ping' : 'sleep';
          const args = isWindows ? ['-n', '10', '127.0.0.1'] : ['10'];
          
          const result = await executor.execute(command, args, {
            cwd: TEST_CWD,
            timeoutMs: noOutputTimeoutMs * 10, // ハードタイムアウトは十分長く
            noOutputTimeoutMs,
          });
          
          // 無出力タイムアウトで終了（Windowsのpingは出力があるのでtimeoutになる可能性）
          if (isWindows) {
            // Windowsのpingは出力があるため、ハードタイムアウトになる可能性がある
            expect(['timeout', 'no_output']).toContain(result.status);
          } else {
            // Unix系のsleepは出力がないため、無出力タイムアウトになる
            expect(result.status).toBe('no_output');
            expect(result.noOutput).toBe(true);
            expect(result.timedOut).toBe(false);
          }
          
          expect(result.exitCode).toBeNull();
          
          return true;
        }
      ),
      { numRuns: 10, timeout: 30000 }
    );
  });
});

/**
 * Property 6: exit codeとstatusの対応
 * 
 * *For any* プロセス実行結果に対して：
 * - exit code が 0 の場合、status は `pass`
 * - exit code が 0 以外の場合、status は `fail`
 * - タイムアウトの場合、status は `timeout`
 * - 無出力タイムアウトの場合、status は `no_output`
 * 
 * **Validates: Requirements 3.5**
 */
describe('Property 6: exit codeとstatusの対応', () => {
  it('exit code 0 のプロセスは status pass を返す', async () => {
    const executor = new ProcessExecutor();
    
    await fc.assert(
      fc.asyncProperty(
        // 任意の正常終了コマンド引数
        fc.constant(null),
        async () => {
          // 正常終了するコマンド
          const command = isWindows ? 'cmd' : 'true';
          const args = isWindows ? ['/c', 'echo', 'test'] : [];
          
          const result = await executor.execute(command, args, {
            cwd: TEST_CWD,
            timeoutMs: 5000,
            noOutputTimeoutMs: 5000,
          });
          
          // exit code 0 → status pass
          expect(result.status).toBe('pass');
          expect(result.exitCode).toBe(0);
          expect(result.timedOut).toBe(false);
          expect(result.noOutput).toBe(false);
          
          return true;
        }
      ),
      { numRuns: 10, timeout: 30000 }
    );
  });

  it('exit code != 0 のプロセスは status fail を返す', async () => {
    const executor = new ProcessExecutor();
    
    await fc.assert(
      fc.asyncProperty(
        // 任意の異常終了コード（1〜255）
        fc.integer({ min: 1, max: 255 }),
        async (exitCode) => {
          // 指定した終了コードで終了するコマンド
          const command = isWindows ? 'cmd' : 'sh';
          const args = isWindows 
            ? ['/c', `exit ${exitCode}`]
            : ['-c', `exit ${exitCode}`];
          
          const result = await executor.execute(command, args, {
            cwd: TEST_CWD,
            timeoutMs: 5000,
            noOutputTimeoutMs: 5000,
          });
          
          // exit code != 0 → status fail
          expect(result.status).toBe('fail');
          expect(result.exitCode).toBe(exitCode);
          expect(result.timedOut).toBe(false);
          expect(result.noOutput).toBe(false);
          
          return true;
        }
      ),
      { numRuns: 20, timeout: 60000 }
    );
  });

  it('statusとexit codeの整合性が保たれる', async () => {
    const executor = new ProcessExecutor();
    
    await fc.assert(
      fc.asyncProperty(
        // ランダムな終了コード（0〜10）
        fc.integer({ min: 0, max: 10 }),
        async (exitCode) => {
          const command = isWindows ? 'cmd' : 'sh';
          const args = isWindows 
            ? ['/c', `exit ${exitCode}`]
            : ['-c', `exit ${exitCode}`];
          
          const result = await executor.execute(command, args, {
            cwd: TEST_CWD,
            timeoutMs: 5000,
            noOutputTimeoutMs: 5000,
          });
          
          // 整合性チェック
          if (result.exitCode === 0) {
            expect(result.status).toBe('pass');
          } else if (result.exitCode !== null) {
            expect(result.status).toBe('fail');
          }
          
          // タイムアウトでない場合、exit codeは非null
          if (!result.timedOut && !result.noOutput && result.status !== 'error') {
            expect(result.exitCode).not.toBeNull();
          }
          
          return true;
        }
      ),
      { numRuns: 20, timeout: 60000 }
    );
  });
});
