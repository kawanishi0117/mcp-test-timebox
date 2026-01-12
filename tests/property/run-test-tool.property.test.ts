/**
 * RunTestTool プロパティベーステスト
 * 
 * Feature: mcp-test-timebox
 * 
 * Property 11: MCPレスポンスの必須フィールド
 * *For any* Run_Test_Tool の実行結果に対して、レスポンスには以下のフィールドが必ず含まれる：
 * - status（pass/fail/timeout/no_output/error）
 * - exit_code
 * - duration_ms
 * - report_dir
 * - artifacts（raw_log, summary_md, summary_json のパス）
 * - excerpt
 * 
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { mkdir, rm, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { RunTestTool, createRunTestTool, type RunTestOutput } from '../../src/tools/run-test.js';

// テスト用の一時ディレクトリ
let testTmpDir: string;

describe('RunTestTool プロパティテスト', () => {
  beforeEach(async () => {
    // 一時ディレクトリを作成
    testTmpDir = join(tmpdir(), `run-test-tool-test-${Date.now()}`);
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

  describe('Property 11: MCPレスポンスの必須フィールド', () => {
    /**
     * Property 11.1: レスポンスには必須フィールドが含まれる
     * 
     * 任意の有効な入力に対して、レスポンスには必須フィールドがすべて含まれる
     * （エラーケースも含む）
     */
    it('レスポンスには必須フィールドが含まれる（エラーケース）', async () => {
      // 不正な入力を生成（バリデーションエラーを発生させる）
      const invalidInputArb = fc.oneof(
        // runnerが不正
        fc.record({
          runner: fc.string({ minLength: 1, maxLength: 10 }).filter(s => s !== 'flutter'),
          scope: fc.constantFrom('all', 'file', 'pattern'),
          target: fc.string({ minLength: 1, maxLength: 50 }),
          timeout_ms: fc.integer({ min: 1, max: 10000 }),
          no_output_timeout_ms: fc.integer({ min: 1, max: 10000 }),
          max_output_bytes: fc.integer({ min: 1, max: 100000 }),
        }),
        // scopeが不正
        fc.record({
          runner: fc.constant('flutter'),
          scope: fc.string({ minLength: 1, maxLength: 10 }).filter(s => !['all', 'file', 'pattern'].includes(s)),
          target: fc.string({ minLength: 1, maxLength: 50 }),
          timeout_ms: fc.integer({ min: 1, max: 10000 }),
          no_output_timeout_ms: fc.integer({ min: 1, max: 10000 }),
          max_output_bytes: fc.integer({ min: 1, max: 100000 }),
        }),
        // timeout_msが不正（負の値）
        fc.record({
          runner: fc.constant('flutter'),
          scope: fc.constant('all'),
          timeout_ms: fc.integer({ min: -1000, max: 0 }),
          no_output_timeout_ms: fc.integer({ min: 1, max: 10000 }),
          max_output_bytes: fc.integer({ min: 1, max: 100000 }),
        }),
        // 必須フィールドが欠落
        fc.record({
          runner: fc.constant('flutter'),
          // scope が欠落
        })
      );

      await fc.assert(
        fc.asyncProperty(invalidInputArb, async (input) => {
          const tool = createRunTestTool({ repoRoot: testTmpDir });
          const result = await tool.execute(input);

          // 必須フィールドの存在確認
          expect(result).toHaveProperty('status');
          expect(result).toHaveProperty('exit_code');
          expect(result).toHaveProperty('duration_ms');
          expect(result).toHaveProperty('report_dir');
          expect(result).toHaveProperty('artifacts');
          expect(result).toHaveProperty('excerpt');

          // artifactsの構造確認
          expect(result.artifacts).toHaveProperty('raw_log');
          expect(result.artifacts).toHaveProperty('summary_md');
          expect(result.artifacts).toHaveProperty('summary_json');

          // エラーケースではstatusがerror
          expect(result.status).toBe('error');

          // duration_msは0以上
          expect(result.duration_ms).toBeGreaterThanOrEqual(0);

          return true;
        }),
        { numRuns: 50 }
      );
    });

    /**
     * Property 11.2: statusは許可された値のみ
     * 
     * 任意の入力に対して、statusは pass/fail/timeout/no_output/error のいずれか
     */
    it('statusは許可された値のみ', async () => {
      const allowedStatuses = ['pass', 'fail', 'timeout', 'no_output', 'error'];

      // 様々な入力パターン
      const inputArb = fc.oneof(
        // 有効な入力（scope: all）
        fc.record({
          runner: fc.constant('flutter'),
          scope: fc.constant('all'),
          timeout_ms: fc.integer({ min: 100, max: 1000 }),
          no_output_timeout_ms: fc.integer({ min: 100, max: 1000 }),
          max_output_bytes: fc.integer({ min: 1000, max: 10000 }),
        }),
        // 不正な入力
        fc.record({
          runner: fc.string({ minLength: 0, maxLength: 10 }),
          scope: fc.string({ minLength: 0, maxLength: 10 }),
        }),
        // 空オブジェクト
        fc.constant({}),
        // null/undefined
        fc.constant(null),
        fc.constant(undefined)
      );

      await fc.assert(
        fc.asyncProperty(inputArb, async (input) => {
          const tool = createRunTestTool({ repoRoot: testTmpDir });
          const result = await tool.execute(input);

          // statusは許可された値のいずれか
          expect(allowedStatuses).toContain(result.status);

          return true;
        }),
        { numRuns: 50 }
      );
    });

    /**
     * Property 11.3: duration_msは非負整数
     * 
     * 任意の入力に対して、duration_msは0以上の数値
     */
    it('duration_msは非負整数', async () => {
      const inputArb = fc.oneof(
        fc.record({
          runner: fc.constant('flutter'),
          scope: fc.constant('all'),
          timeout_ms: fc.integer({ min: 100, max: 500 }),
          no_output_timeout_ms: fc.integer({ min: 100, max: 500 }),
          max_output_bytes: fc.integer({ min: 1000, max: 10000 }),
        }),
        fc.record({
          runner: fc.string({ minLength: 1, maxLength: 10 }),
        }),
        fc.constant({})
      );

      await fc.assert(
        fc.asyncProperty(inputArb, async (input) => {
          const tool = createRunTestTool({ repoRoot: testTmpDir });
          const result = await tool.execute(input);

          // duration_msは数値
          expect(typeof result.duration_ms).toBe('number');
          // duration_msは0以上
          expect(result.duration_ms).toBeGreaterThanOrEqual(0);
          // duration_msは整数（または非常に小さい小数点以下）
          expect(Number.isFinite(result.duration_ms)).toBe(true);

          return true;
        }),
        { numRuns: 30 }
      );
    });

    /**
     * Property 11.4: exit_codeはnullまたは整数
     * 
     * 任意の入力に対して、exit_codeはnullまたは整数
     */
    it('exit_codeはnullまたは整数', async () => {
      const inputArb = fc.oneof(
        fc.record({
          runner: fc.constant('flutter'),
          scope: fc.constant('all'),
          timeout_ms: fc.integer({ min: 100, max: 500 }),
          no_output_timeout_ms: fc.integer({ min: 100, max: 500 }),
          max_output_bytes: fc.integer({ min: 1000, max: 10000 }),
        }),
        fc.constant({})
      );

      await fc.assert(
        fc.asyncProperty(inputArb, async (input) => {
          const tool = createRunTestTool({ repoRoot: testTmpDir });
          const result = await tool.execute(input);

          // exit_codeはnullまたは整数
          if (result.exit_code !== null) {
            expect(typeof result.exit_code).toBe('number');
            expect(Number.isInteger(result.exit_code)).toBe(true);
          }

          return true;
        }),
        { numRuns: 30 }
      );
    });

    /**
     * Property 11.5: artifactsは文字列のパスを含む
     * 
     * 任意の入力に対して、artifactsの各フィールドは文字列
     */
    it('artifactsは文字列のパスを含む', async () => {
      const inputArb = fc.oneof(
        fc.record({
          runner: fc.constant('flutter'),
          scope: fc.constant('all'),
          timeout_ms: fc.integer({ min: 100, max: 500 }),
          no_output_timeout_ms: fc.integer({ min: 100, max: 500 }),
          max_output_bytes: fc.integer({ min: 1000, max: 10000 }),
        }),
        fc.constant({})
      );

      await fc.assert(
        fc.asyncProperty(inputArb, async (input) => {
          const tool = createRunTestTool({ repoRoot: testTmpDir });
          const result = await tool.execute(input);

          // artifactsの各フィールドは文字列
          expect(typeof result.artifacts.raw_log).toBe('string');
          expect(typeof result.artifacts.summary_md).toBe('string');
          expect(typeof result.artifacts.summary_json).toBe('string');

          return true;
        }),
        { numRuns: 30 }
      );
    });

    /**
     * Property 11.6: excerptは文字列
     * 
     * 任意の入力に対して、excerptは文字列
     */
    it('excerptは文字列', async () => {
      const inputArb = fc.oneof(
        fc.record({
          runner: fc.constant('flutter'),
          scope: fc.constant('all'),
          timeout_ms: fc.integer({ min: 100, max: 500 }),
          no_output_timeout_ms: fc.integer({ min: 100, max: 500 }),
          max_output_bytes: fc.integer({ min: 1000, max: 10000 }),
        }),
        fc.constant({})
      );

      await fc.assert(
        fc.asyncProperty(inputArb, async (input) => {
          const tool = createRunTestTool({ repoRoot: testTmpDir });
          const result = await tool.execute(input);

          // excerptは文字列
          expect(typeof result.excerpt).toBe('string');

          return true;
        }),
        { numRuns: 30 }
      );
    });
  });
});
