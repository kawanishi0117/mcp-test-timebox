/**
 * ProcessExecutor ユニットテスト
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 * - 3.1: プロセス起動時にstdinを即座に閉じる
 * - 3.2: timeout_ms で指定された時間が経過したらプロセスを強制終了
 * - 3.3: no_output_timeout_ms で指定された時間、出力がなければ強制終了
 * - 3.4: プロセスツリーごと終了する
 * - 3.5: exit code 0 で pass、それ以外で fail を返す
 */
import { describe, it, expect } from 'vitest';
import { ProcessExecutor, createProcessExecutor } from '../../src/executor/process-executor.js';

// テスト用の作業ディレクトリ
const TEST_CWD = process.cwd();

// プラットフォーム判定
const isWindows = process.platform === 'win32';

describe('ProcessExecutor ユニットテスト', () => {
  describe('正常終了（exit code 0）', () => {
    it('正常終了するコマンドは status pass を返す', async () => {
      const executor = new ProcessExecutor();
      
      const command = isWindows ? 'cmd' : 'true';
      const args = isWindows ? ['/c', 'echo', 'hello'] : [];
      
      const result = await executor.execute(command, args, {
        cwd: TEST_CWD,
        timeoutMs: 5000,
        noOutputTimeoutMs: 5000,
      });
      
      expect(result.status).toBe('pass');
      expect(result.exitCode).toBe(0);
      expect(result.timedOut).toBe(false);
      expect(result.noOutput).toBe(false);
    });

    it('stdoutの出力がログに記録される', async () => {
      const executor = new ProcessExecutor();
      
      const command = isWindows ? 'cmd' : 'echo';
      const args = isWindows ? ['/c', 'echo', 'test output'] : ['test output'];
      
      const result = await executor.execute(command, args, {
        cwd: TEST_CWD,
        timeoutMs: 5000,
        noOutputTimeoutMs: 5000,
      });
      
      expect(result.status).toBe('pass');
      expect(result.logs.length).toBeGreaterThan(0);
      
      // stdoutのログが含まれている
      const stdoutLogs = result.logs.filter(log => log.stream === 'stdout');
      expect(stdoutLogs.length).toBeGreaterThan(0);
      
      // 出力内容に 'test output' が含まれている
      const allOutput = stdoutLogs.map(log => log.data).join('');
      expect(allOutput).toContain('test output');
    });

    it('実行時間が記録される', async () => {
      const executor = new ProcessExecutor();
      
      const command = isWindows ? 'cmd' : 'true';
      const args = isWindows ? ['/c', 'echo', 'test'] : [];
      
      const result = await executor.execute(command, args, {
        cwd: TEST_CWD,
        timeoutMs: 5000,
        noOutputTimeoutMs: 5000,
      });
      
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.durationMs).toBeLessThan(5000);
    });
  });

  describe('異常終了（exit code != 0）', () => {
    it('exit code 1 で終了するコマンドは status fail を返す', async () => {
      const executor = new ProcessExecutor();
      
      const command = isWindows ? 'cmd' : 'sh';
      const args = isWindows ? ['/c', 'exit 1'] : ['-c', 'exit 1'];
      
      const result = await executor.execute(command, args, {
        cwd: TEST_CWD,
        timeoutMs: 5000,
        noOutputTimeoutMs: 5000,
      });
      
      expect(result.status).toBe('fail');
      expect(result.exitCode).toBe(1);
      expect(result.timedOut).toBe(false);
      expect(result.noOutput).toBe(false);
    });

    it('exit code 42 で終了するコマンドは status fail を返す', async () => {
      const executor = new ProcessExecutor();
      
      const command = isWindows ? 'cmd' : 'sh';
      const args = isWindows ? ['/c', 'exit 42'] : ['-c', 'exit 42'];
      
      const result = await executor.execute(command, args, {
        cwd: TEST_CWD,
        timeoutMs: 5000,
        noOutputTimeoutMs: 5000,
      });
      
      expect(result.status).toBe('fail');
      expect(result.exitCode).toBe(42);
    });

    it('stderrの出力がログに記録される', async () => {
      const executor = new ProcessExecutor();
      
      const command = isWindows ? 'cmd' : 'sh';
      const args = isWindows 
        ? ['/c', 'echo error message 1>&2 && exit 1']
        : ['-c', 'echo "error message" >&2 && exit 1'];
      
      const result = await executor.execute(command, args, {
        cwd: TEST_CWD,
        timeoutMs: 5000,
        noOutputTimeoutMs: 5000,
      });
      
      expect(result.status).toBe('fail');
      
      // stderrのログが含まれている
      const stderrLogs = result.logs.filter(log => log.stream === 'stderr');
      expect(stderrLogs.length).toBeGreaterThan(0);
      
      // 出力内容に 'error message' が含まれている
      const allStderr = stderrLogs.map(log => log.data).join('');
      expect(allStderr).toContain('error');
    });
  });


  describe('タイムアウト', () => {
    it('ハードタイムアウトで強制終了される', async () => {
      const executor = new ProcessExecutor();
      
      // 長時間実行されるコマンド
      const command = isWindows ? 'ping' : 'sleep';
      const args = isWindows ? ['-n', '100', '127.0.0.1'] : ['100'];
      
      const result = await executor.execute(command, args, {
        cwd: TEST_CWD,
        timeoutMs: 100, // 100msでタイムアウト
        noOutputTimeoutMs: 10000, // 無出力タイムアウトは長め
      });
      
      expect(result.status).toBe('timeout');
      expect(result.timedOut).toBe(true);
      expect(result.noOutput).toBe(false);
      expect(result.exitCode).toBeNull();
      
      // 実行時間はタイムアウト値付近
      expect(result.durationMs).toBeGreaterThanOrEqual(90);
      expect(result.durationMs).toBeLessThan(500);
    }, 10000);

    it('タイムアウト前に終了すればタイムアウトしない', async () => {
      const executor = new ProcessExecutor();
      
      const command = isWindows ? 'cmd' : 'true';
      const args = isWindows ? ['/c', 'echo', 'quick'] : [];
      
      const result = await executor.execute(command, args, {
        cwd: TEST_CWD,
        timeoutMs: 5000,
        noOutputTimeoutMs: 5000,
      });
      
      expect(result.status).toBe('pass');
      expect(result.timedOut).toBe(false);
      expect(result.exitCode).toBe(0);
    });
  });

  describe('無出力タイムアウト', () => {
    it('出力がないプロセスは無出力タイムアウトで終了する', async () => {
      const executor = new ProcessExecutor();
      
      // 出力なしで長時間実行されるコマンド（Unix系のみ確実にテスト可能）
      if (!isWindows) {
        const result = await executor.execute('sleep', ['100'], {
          cwd: TEST_CWD,
          timeoutMs: 10000,
          noOutputTimeoutMs: 100, // 100msで無出力タイムアウト
        });
        
        expect(result.status).toBe('no_output');
        expect(result.noOutput).toBe(true);
        expect(result.timedOut).toBe(false);
        expect(result.exitCode).toBeNull();
      }
    }, 10000);

    it('定期的に出力があれば無出力タイムアウトしない', async () => {
      const executor = new ProcessExecutor();
      
      // 定期的に出力するコマンド
      const command = isWindows ? 'cmd' : 'sh';
      const args = isWindows 
        ? ['/c', 'echo 1 && echo 2 && echo 3']
        : ['-c', 'echo 1; echo 2; echo 3'];
      
      const result = await executor.execute(command, args, {
        cwd: TEST_CWD,
        timeoutMs: 5000,
        noOutputTimeoutMs: 1000,
      });
      
      expect(result.status).toBe('pass');
      expect(result.noOutput).toBe(false);
      expect(result.timedOut).toBe(false);
    });
  });

  describe('ログエントリ', () => {
    it('ログエントリにタイムスタンプが含まれる', async () => {
      const executor = new ProcessExecutor();
      
      const command = isWindows ? 'cmd' : 'echo';
      const args = isWindows ? ['/c', 'echo', 'timestamp test'] : ['timestamp test'];
      
      const startTime = Date.now();
      const result = await executor.execute(command, args, {
        cwd: TEST_CWD,
        timeoutMs: 5000,
        noOutputTimeoutMs: 5000,
      });
      const endTime = Date.now();
      
      expect(result.logs.length).toBeGreaterThan(0);
      
      for (const log of result.logs) {
        expect(log.timestamp).toBeGreaterThanOrEqual(startTime);
        expect(log.timestamp).toBeLessThanOrEqual(endTime);
        expect(log.stream).toMatch(/^(stdout|stderr)$/);
        expect(typeof log.data).toBe('string');
      }
    });

    it('stdout と stderr が区別される', async () => {
      const executor = new ProcessExecutor();
      
      const command = isWindows ? 'cmd' : 'sh';
      const args = isWindows 
        ? ['/c', 'echo stdout && echo stderr 1>&2']
        : ['-c', 'echo stdout; echo stderr >&2'];
      
      const result = await executor.execute(command, args, {
        cwd: TEST_CWD,
        timeoutMs: 5000,
        noOutputTimeoutMs: 5000,
      });
      
      const stdoutLogs = result.logs.filter(log => log.stream === 'stdout');
      const stderrLogs = result.logs.filter(log => log.stream === 'stderr');
      
      expect(stdoutLogs.length).toBeGreaterThan(0);
      expect(stderrLogs.length).toBeGreaterThan(0);
    });
  });

  describe('createProcessExecutor()', () => {
    it('新しいProcessExecutorインスタンスを返す', () => {
      const executor = createProcessExecutor();
      expect(executor).toBeDefined();
      expect(typeof executor.execute).toBe('function');
    });
  });

  describe('エラーハンドリング', () => {
    it('存在しないコマンドは status error を返す', async () => {
      const executor = new ProcessExecutor();
      
      const result = await executor.execute('nonexistent_command_12345', [], {
        cwd: TEST_CWD,
        timeoutMs: 5000,
        noOutputTimeoutMs: 5000,
      });
      
      // エラーまたは失敗として処理される
      expect(['error', 'fail']).toContain(result.status);
    });
  });
});
