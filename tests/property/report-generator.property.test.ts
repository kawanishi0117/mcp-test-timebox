/**
 * ReportGenerator プロパティベーステスト
 * 
 * Feature: mcp-test-timebox
 * 
 * Property 7: 成果物の生成
 * *For any* テスト実行完了後、report_dir に以下の3ファイルが必ず生成される：
 * - raw.log（stdout/stderrを区別して記録）
 * - summary.md
 * - summary.json
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4
 * 
 * Property 10: summary.jsonの必須フィールド
 * *For any* 生成された summary.json に対して、以下のフィールドが必ず含まれる：
 * - command（実行コマンド）
 * - exit_code
 * - status
 * - duration_ms（実行時間）
 * - excerpts（抜粋ブロック）
 * - tail_lines（末尾N行）
 * Validates: Requirements 5.4
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { mkdir, rm, readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  ReportGenerator,
  createReportGenerator,
  type Summary,
} from '../../src/report/report-generator.js';
import type { LogEntry } from '../../src/executor/process-executor.js';

// テスト用の一時ディレクトリ
let testTmpDir: string;

describe('ReportGenerator プロパティテスト', () => {
  beforeEach(async () => {
    // 一時ディレクトリを作成
    testTmpDir = join(tmpdir(), `report-gen-test-${Date.now()}`);
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

  describe('Property 7: 成果物の生成', () => {
    /**
     * Property 7.1: writeAllは3つのファイルを生成する
     * 
     * 任意のログエントリと要約情報に対して、
     * writeAllは raw.log, summary.md, summary.json の3ファイルを生成する
     */
    it('writeAllは3つのファイルを生成する', async () => {
      // ログエントリ生成器
      const logEntryArb = fc.record({
        timestamp: fc.integer({ min: 1000000000000, max: 2000000000000 }),
        stream: fc.constantFrom('stdout', 'stderr') as fc.Arbitrary<'stdout' | 'stderr'>,
        data: fc.string({ minLength: 1, maxLength: 100 }),
      });

      // 要約情報生成器
      const summaryArb = fc.record({
        command: fc.constantFrom('flutter', 'npm', 'yarn'),
        args: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 5 }),
        status: fc.constantFrom('pass', 'fail', 'timeout', 'no_output', 'error'),
        exitCode: fc.oneof(fc.constant(null), fc.integer({ min: 0, max: 255 })),
        durationMs: fc.integer({ min: 0, max: 1000000 }),
        excerpts: fc.array(fc.string({ minLength: 0, maxLength: 100 }), { minLength: 0, maxLength: 5 }),
        tailLines: fc.array(fc.string({ minLength: 0, maxLength: 100 }), { minLength: 0, maxLength: 10 }),
      });

      await fc.assert(
        fc.asyncProperty(
          fc.array(logEntryArb, { minLength: 0, maxLength: 10 }),
          summaryArb,
          async (entries, summary) => {
            const generator = createReportGenerator();
            const reportDir = join(testTmpDir, `test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
            await mkdir(reportDir, { recursive: true });

            const artifacts = await generator.writeAll(reportDir, entries as LogEntry[], summary as Summary);

            // 3つのファイルパスが返される
            expect(artifacts.rawLog).toBeDefined();
            expect(artifacts.summaryMd).toBeDefined();
            expect(artifacts.summaryJson).toBeDefined();

            // ファイルが実際に存在する
            await expect(access(artifacts.rawLog)).resolves.toBeUndefined();
            await expect(access(artifacts.summaryMd)).resolves.toBeUndefined();
            await expect(access(artifacts.summaryJson)).resolves.toBeUndefined();

            return true;
          }
        ),
        { numRuns: 20 } // ファイルI/Oがあるため回数を減らす
      );
    });

    /**
     * Property 7.2: raw.logはstdout/stderrを区別して記録する
     * 
     * 任意のログエントリに対して、
     * raw.logには各エントリのstream情報が含まれる
     */
    it('raw.logはstdout/stderrを区別して記録する', async () => {
      const logEntryArb = fc.record({
        timestamp: fc.integer({ min: 1000000000000, max: 2000000000000 }),
        stream: fc.constantFrom('stdout', 'stderr') as fc.Arbitrary<'stdout' | 'stderr'>,
        data: fc.stringMatching(/^[a-zA-Z0-9 ]+$/u, { minLength: 1, maxLength: 50 }),
      });

      await fc.assert(
        fc.asyncProperty(
          fc.array(logEntryArb, { minLength: 1, maxLength: 10 }),
          async (entries) => {
            const generator = createReportGenerator();
            const reportDir = join(testTmpDir, `test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
            await mkdir(reportDir, { recursive: true });

            const rawLogPath = await generator.writeRawLog(reportDir, entries as LogEntry[]);
            const content = await readFile(rawLogPath, 'utf-8');

            // 各エントリのstream情報が含まれている
            for (const entry of entries) {
              expect(content).toContain(`[${entry.stream}]`);
            }

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * Property 7.3: createReportDirはディレクトリを作成する
     * 
     * 任意のベースパスに対して、
     * createReportDirは新しいディレクトリを作成する
     */
    it('createReportDirはディレクトリを作成する', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null), // ダミー
          async () => {
            const generator = createReportGenerator();
            const basePath = join(testTmpDir, `base-${Date.now()}`);

            const reportDir = await generator.createReportDir(basePath);

            // ディレクトリが存在する
            await expect(access(reportDir)).resolves.toBeUndefined();

            // パスがベースパス配下にある
            expect(reportDir.startsWith(basePath)).toBe(true);

            return true;
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('Property 10: summary.jsonの必須フィールド', () => {
    /**
     * Property 10.1: summary.jsonには必須フィールドが含まれる
     * 
     * 任意の要約情報に対して、
     * 生成されたsummary.jsonには必須フィールドがすべて含まれる
     */
    it('summary.jsonには必須フィールドが含まれる', async () => {
      const summaryArb = fc.record({
        command: fc.constantFrom('flutter', 'npm', 'yarn', 'test'),
        args: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 5 }),
        status: fc.constantFrom('pass', 'fail', 'timeout', 'no_output', 'error'),
        exitCode: fc.oneof(fc.constant(null), fc.integer({ min: 0, max: 255 })),
        durationMs: fc.integer({ min: 0, max: 1000000 }),
        excerpts: fc.array(fc.string({ minLength: 0, maxLength: 100 }), { minLength: 0, maxLength: 5 }),
        tailLines: fc.array(fc.string({ minLength: 0, maxLength: 100 }), { minLength: 0, maxLength: 10 }),
      });

      await fc.assert(
        fc.asyncProperty(summaryArb, async (summary) => {
          const generator = createReportGenerator();
          const reportDir = join(testTmpDir, `test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
          await mkdir(reportDir, { recursive: true });

          const jsonPath = await generator.writeSummaryJson(reportDir, summary as Summary);
          const content = await readFile(jsonPath, 'utf-8');
          const parsed = JSON.parse(content);

          // 必須フィールドの存在確認
          expect(parsed).toHaveProperty('command');
          expect(parsed).toHaveProperty('exit_code');
          expect(parsed).toHaveProperty('status');
          expect(parsed).toHaveProperty('duration_ms');
          expect(parsed).toHaveProperty('excerpts');
          expect(parsed).toHaveProperty('tail_lines');

          // フィールドの値が正しい
          expect(parsed.status).toBe(summary.status);
          expect(parsed.exit_code).toBe(summary.exitCode);
          expect(parsed.duration_ms).toBe(summary.durationMs);
          expect(parsed.excerpts).toEqual(summary.excerpts);
          expect(parsed.tail_lines).toEqual(summary.tailLines);

          return true;
        }),
        { numRuns: 30 }
      );
    });

    /**
     * Property 10.2: summary.jsonは有効なJSONである
     * 
     * 任意の要約情報に対して、
     * 生成されたsummary.jsonはパース可能な有効なJSONである
     */
    it('summary.jsonは有効なJSONである', async () => {
      const summaryArb = fc.record({
        command: fc.string({ minLength: 1, maxLength: 50 }),
        args: fc.array(fc.string({ minLength: 0, maxLength: 20 }), { minLength: 0, maxLength: 5 }),
        status: fc.constantFrom('pass', 'fail', 'timeout', 'no_output', 'error'),
        exitCode: fc.oneof(fc.constant(null), fc.integer({ min: 0, max: 255 })),
        durationMs: fc.integer({ min: 0, max: 1000000 }),
        excerpts: fc.array(fc.string({ minLength: 0, maxLength: 100 }), { minLength: 0, maxLength: 5 }),
        tailLines: fc.array(fc.string({ minLength: 0, maxLength: 100 }), { minLength: 0, maxLength: 10 }),
      });

      await fc.assert(
        fc.asyncProperty(summaryArb, async (summary) => {
          const generator = createReportGenerator();
          const reportDir = join(testTmpDir, `test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
          await mkdir(reportDir, { recursive: true });

          const jsonPath = await generator.writeSummaryJson(reportDir, summary as Summary);
          const content = await readFile(jsonPath, 'utf-8');

          // JSONとしてパース可能
          expect(() => JSON.parse(content)).not.toThrow();

          return true;
        }),
        { numRuns: 30 }
      );
    });

    /**
     * Property 10.3: commandフィールドはコマンドと引数を含む
     * 
     * 任意の要約情報に対して、
     * commandフィールドはコマンドと引数を結合した文字列である
     */
    it('commandフィールドはコマンドと引数を含む', async () => {
      const summaryArb = fc.record({
        command: fc.constantFrom('flutter', 'npm', 'yarn'),
        args: fc.array(fc.stringMatching(/^[a-zA-Z0-9-]+$/u, { minLength: 1, maxLength: 10 }), { minLength: 1, maxLength: 3 }),
        status: fc.constant('pass'),
        exitCode: fc.constant(0),
        durationMs: fc.constant(1000),
        excerpts: fc.constant([]),
        tailLines: fc.constant([]),
      });

      await fc.assert(
        fc.asyncProperty(summaryArb, async (summary) => {
          const generator = createReportGenerator();
          const reportDir = join(testTmpDir, `test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
          await mkdir(reportDir, { recursive: true });

          const jsonPath = await generator.writeSummaryJson(reportDir, summary as Summary);
          const content = await readFile(jsonPath, 'utf-8');
          const parsed = JSON.parse(content);

          // commandフィールドにコマンドが含まれる
          expect(parsed.command).toContain(summary.command);

          // commandフィールドに引数が含まれる
          for (const arg of summary.args) {
            expect(parsed.command).toContain(arg);
          }

          return true;
        }),
        { numRuns: 20 }
      );
    });
  });
});
