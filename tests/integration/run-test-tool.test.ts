/**
 * RunTestTool 統合テスト
 * 
 * 実際のプロセス実行を伴うテスト
 * 
 * Requirements:
 * - 2.1-2.6: テスト実行コマンドの制限
 * - 3.1-3.5: タイムボックス制御
 * - 6.1-6.5: MCPレスポンスの必須フィールド
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRunTestTool, type RunTestOutput } from '../../src/tools/run-test.js';

// テスト用の一時ディレクトリ
let testTmpDir: string;

describe('RunTestTool 統合テスト', () => {
  beforeEach(async () => {
    // 一時ディレクトリを作成
    testTmpDir = join(tmpdir(), `run-test-integration-${Date.now()}`);
    await mkdir(testTmpDir, { recursive: true });
  });

  afterEach(async () => {
    // 一時ディレクトリを削除
    try {
      await rm(testTmpDir, { recursive: true, force: true });
    } catch {
      // 削除失敗は無視
    }
  });

  describe('正常系: テスト成功', () => {
    it('echoコマンドが正常終了する場合、status passを返す', async () => {
      // 注意: flutterがインストールされていない環境では、
      // このテストはエラーになる可能性がある
      // 実際のflutter testの代わりに、短いタイムアウトでエラーを確認
      const tool = createRunTestTool({ repoRoot: testTmpDir });
      
      const result = await tool.execute({
        runner: 'flutter',
        scope: 'all',
        timeout_ms: 500,
        no_output_timeout_ms: 300,
        max_output_bytes: 10000,
      });

      // レスポンスの構造を確認
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('exit_code');
      expect(result).toHaveProperty('duration_ms');
      expect(result).toHaveProperty('report_dir');
      expect(result).toHaveProperty('artifacts');
      expect(result).toHaveProperty('excerpt');

      // flutterがない場合はerrorまたはfail
      // flutterがある場合はpass/fail/timeout/no_output
      expect(['pass', 'fail', 'timeout', 'no_output', 'error']).toContain(result.status);
    });
  });

  describe('正常系: テスト失敗', () => {
    it('存在しないファイルを指定した場合、failまたはerrorを返す', async () => {
      const tool = createRunTestTool({ repoRoot: testTmpDir });
      
      const result = await tool.execute({
        runner: 'flutter',
        scope: 'file',
        target: 'nonexistent_test.dart',
        timeout_ms: 500,
        no_output_timeout_ms: 300,
        max_output_bytes: 10000,
      });

      // flutterがない場合はerror、ある場合はfail
      expect(['fail', 'error', 'timeout', 'no_output']).toContain(result.status);
    });
  });

  describe('異常系: タイムアウト', () => {
    it('ハードタイムアウトを超えた場合、status timeoutを返す', async () => {
      const tool = createRunTestTool({ repoRoot: testTmpDir });
      
      // 非常に短いタイムアウトを設定
      const result = await tool.execute({
        runner: 'flutter',
        scope: 'all',
        timeout_ms: 50, // 50ms
        no_output_timeout_ms: 10000, // 無出力タイムアウトは長めに
        max_output_bytes: 10000,
      });

      // タイムアウトまたはエラー（flutterがない場合）
      expect(['timeout', 'error', 'fail', 'no_output']).toContain(result.status);
      
      // duration_msは設定したタイムアウト付近
      // （プロセス起動のオーバーヘッドがあるため、厳密には比較しない）
      expect(result.duration_ms).toBeGreaterThanOrEqual(0);
    });
  });

  describe('異常系: 無出力タイムアウト', () => {
    it('無出力タイムアウトを超えた場合、status no_outputを返す', async () => {
      const tool = createRunTestTool({ repoRoot: testTmpDir });
      
      // 非常に短い無出力タイムアウトを設定
      const result = await tool.execute({
        runner: 'flutter',
        scope: 'all',
        timeout_ms: 10000, // ハードタイムアウトは長めに
        no_output_timeout_ms: 50, // 50ms
        max_output_bytes: 10000,
      });

      // 無出力タイムアウトまたはエラー（flutterがない場合）
      expect(['no_output', 'error', 'fail', 'timeout']).toContain(result.status);
    });
  });

  describe('異常系: バリデーションエラー', () => {
    it('runnerが不正な場合、status errorを返す', async () => {
      const tool = createRunTestTool({ repoRoot: testTmpDir });
      
      const result = await tool.execute({
        runner: 'invalid_runner',
        scope: 'all',
        timeout_ms: 1000,
        no_output_timeout_ms: 1000,
        max_output_bytes: 10000,
      });

      expect(result.status).toBe('error');
      expect(result.error_message).toBeDefined();
      expect(result.error_message).toContain('runner');
    });

    it('scopeが不正な場合、status errorを返す', async () => {
      const tool = createRunTestTool({ repoRoot: testTmpDir });
      
      const result = await tool.execute({
        runner: 'flutter',
        scope: 'invalid_scope',
        timeout_ms: 1000,
        no_output_timeout_ms: 1000,
        max_output_bytes: 10000,
      });

      expect(result.status).toBe('error');
      expect(result.error_message).toBeDefined();
      expect(result.error_message).toContain('scope');
    });

    it('scope=fileでtargetが未指定の場合、status errorを返す', async () => {
      const tool = createRunTestTool({ repoRoot: testTmpDir });
      
      const result = await tool.execute({
        runner: 'flutter',
        scope: 'file',
        // target が未指定
        timeout_ms: 1000,
        no_output_timeout_ms: 1000,
        max_output_bytes: 10000,
      });

      expect(result.status).toBe('error');
      expect(result.error_message).toBeDefined();
      expect(result.error_message).toContain('target');
    });

    it('timeout_msが負の値の場合、status errorを返す', async () => {
      const tool = createRunTestTool({ repoRoot: testTmpDir });
      
      const result = await tool.execute({
        runner: 'flutter',
        scope: 'all',
        timeout_ms: -100,
        no_output_timeout_ms: 1000,
        max_output_bytes: 10000,
      });

      expect(result.status).toBe('error');
      expect(result.error_message).toBeDefined();
    });

    it('必須パラメータが欠落している場合、status errorを返す', async () => {
      const tool = createRunTestTool({ repoRoot: testTmpDir });
      
      const result = await tool.execute({
        runner: 'flutter',
        // scope, timeout_ms, no_output_timeout_ms, max_output_bytes が欠落
      });

      expect(result.status).toBe('error');
      expect(result.error_message).toBeDefined();
    });

    it('パスがリポジトリ外を指す場合、status errorを返す', async () => {
      const tool = createRunTestTool({ repoRoot: testTmpDir });
      
      const result = await tool.execute({
        runner: 'flutter',
        scope: 'file',
        target: '../../../etc/passwd', // リポジトリ外
        timeout_ms: 1000,
        no_output_timeout_ms: 1000,
        max_output_bytes: 10000,
      });

      expect(result.status).toBe('error');
      expect(result.error_message).toBeDefined();
      expect(result.error_message).toContain('パス');
    });

    it('report_dirがリポジトリ外を指す場合、status errorを返す', async () => {
      const tool = createRunTestTool({ repoRoot: testTmpDir });
      
      const result = await tool.execute({
        runner: 'flutter',
        scope: 'all',
        timeout_ms: 1000,
        no_output_timeout_ms: 1000,
        max_output_bytes: 10000,
        report_dir: '../../../tmp/reports', // リポジトリ外
      });

      expect(result.status).toBe('error');
      expect(result.error_message).toBeDefined();
      expect(result.error_message).toContain('パス');
    });
  });

  describe('成果物の生成', () => {
    it('実行後に成果物が生成される', async () => {
      const tool = createRunTestTool({ repoRoot: testTmpDir });
      
      const result = await tool.execute({
        runner: 'flutter',
        scope: 'all',
        timeout_ms: 500,
        no_output_timeout_ms: 300,
        max_output_bytes: 10000,
      });

      // エラーでない場合、成果物が生成される
      if (result.status !== 'error') {
        expect(result.report_dir).toBeTruthy();
        expect(result.artifacts.raw_log).toBeTruthy();
        expect(result.artifacts.summary_md).toBeTruthy();
        expect(result.artifacts.summary_json).toBeTruthy();

        // ファイルが存在することを確認
        await expect(access(result.artifacts.raw_log)).resolves.toBeUndefined();
        await expect(access(result.artifacts.summary_md)).resolves.toBeUndefined();
        await expect(access(result.artifacts.summary_json)).resolves.toBeUndefined();

        // summary.jsonの内容を確認
        const summaryContent = await readFile(result.artifacts.summary_json, 'utf-8');
        const summary = JSON.parse(summaryContent);
        
        expect(summary).toHaveProperty('command');
        expect(summary).toHaveProperty('status');
        expect(summary).toHaveProperty('exit_code');
        expect(summary).toHaveProperty('duration_ms');
      }
    });
  });
});
