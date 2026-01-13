/**
 * ReportGenerator ユニットテスト
 * 
 * Requirements: 4.1-4.5, 5.4, 5.5
 * - 4.1: report_dir に raw.log を生成する
 * - 4.2: report_dir に summary.md を生成する
 * - 4.3: report_dir に summary.json を生成する
 * - 4.4: raw.log は stdout/stderr の出力元を区別して記録する
 * - 4.5: report_dir が未指定の場合、デフォルトパスを使用する
 * - 5.4: summary.json に必須フィールドを含める
 * - 5.5: summary.md に人間が読みやすい形式で情報を含める
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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

describe('ReportGenerator ユニットテスト', () => {
  beforeEach(async () => {
    // 一時ディレクトリを作成
    testTmpDir = join(tmpdir(), `report-gen-unit-test-${Date.now()}`);
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

  describe('createReportDir()', () => {
    describe('正常系: ディレクトリ作成', () => {
      it('指定されたベースパス配下にディレクトリを作成する', async () => {
        const generator = createReportGenerator();
        const basePath = join(testTmpDir, 'reports');

        const reportDir = await generator.createReportDir(basePath);

        // ディレクトリが存在する
        await expect(access(reportDir)).resolves.toBeUndefined();
        // ベースパス配下にある
        expect(reportDir.startsWith(basePath)).toBe(true);
      });

      it('タイムスタンプ形式のディレクトリ名を生成する', async () => {
        const generator = createReportGenerator();
        const basePath = join(testTmpDir, 'reports');

        const reportDir = await generator.createReportDir(basePath);

        // ディレクトリ名がタイムスタンプ形式（YYYYMMDD-HHMMSS-mmm-xxxx）
        // ミリ秒とランダム文字列を含めて一意性を保証
        const dirName = reportDir.split(/[/\\]/).pop();
        expect(dirName).toMatch(/^\d{8}-\d{6}-\d{3}-[a-z0-9]{4}$/);
      });
    });

    describe('正常系: デフォルトパス', () => {
      it('ベースパス未指定時はデフォルトパスを使用する', async () => {
        const generator = createReportGenerator();

        // デフォルトパスを使用（カレントディレクトリ配下）
        const reportDir = await generator.createReportDir();

        // デフォルトパス配下にある
        expect(reportDir).toContain('.cache');
        expect(reportDir).toContain('mcp-test-timebox');
        expect(reportDir).toContain('reports');

        // クリーンアップ
        try {
          await rm(reportDir, { recursive: true, force: true });
          // 親ディレクトリも削除を試みる
          await rm('.cache/mcp-test-timebox', { recursive: true, force: true });
        } catch {
          // 削除失敗は無視
        }
      });
    });
  });

  describe('writeRawLog()', () => {
    describe('正常系: raw.logフォーマット', () => {
      it('ログエントリをフォーマットして書き込む', async () => {
        const generator = createReportGenerator();
        const reportDir = join(testTmpDir, 'test-report');
        await mkdir(reportDir, { recursive: true });

        const entries: LogEntry[] = [
          { timestamp: 1704067200000, stream: 'stdout', data: 'Hello\n' },
          { timestamp: 1704067201000, stream: 'stderr', data: 'Warning\n' },
        ];

        const filePath = await generator.writeRawLog(reportDir, entries);
        const content = await readFile(filePath, 'utf-8');

        // ファイルパスが正しい
        expect(filePath).toBe(join(reportDir, 'raw.log'));
        // タイムスタンプが含まれる
        expect(content).toContain('2024-01-01');
        // ストリーム情報が含まれる
        expect(content).toContain('[stdout]');
        expect(content).toContain('[stderr]');
        // データが含まれる
        expect(content).toContain('Hello');
        expect(content).toContain('Warning');
      });

      it('stdout/stderrを区別して記録する', async () => {
        const generator = createReportGenerator();
        const reportDir = join(testTmpDir, 'test-report');
        await mkdir(reportDir, { recursive: true });

        const entries: LogEntry[] = [
          { timestamp: 1704067200000, stream: 'stdout', data: 'stdout message\n' },
          { timestamp: 1704067200100, stream: 'stderr', data: 'stderr message\n' },
          { timestamp: 1704067200200, stream: 'stdout', data: 'another stdout\n' },
        ];

        const filePath = await generator.writeRawLog(reportDir, entries);
        const content = await readFile(filePath, 'utf-8');

        // 各エントリが正しいストリームでマークされている
        const lines = content.split('\n').filter(l => l.length > 0);
        expect(lines[0]).toContain('[stdout]');
        expect(lines[0]).toContain('stdout message');
        expect(lines[1]).toContain('[stderr]');
        expect(lines[1]).toContain('stderr message');
        expect(lines[2]).toContain('[stdout]');
        expect(lines[2]).toContain('another stdout');
      });

      it('ISO8601形式のタイムスタンプを使用する', async () => {
        const generator = createReportGenerator();
        const reportDir = join(testTmpDir, 'test-report');
        await mkdir(reportDir, { recursive: true });

        const entries: LogEntry[] = [
          { timestamp: 1704067200000, stream: 'stdout', data: 'test\n' },
        ];

        const filePath = await generator.writeRawLog(reportDir, entries);
        const content = await readFile(filePath, 'utf-8');

        // ISO8601形式（例: 2024-01-01T00:00:00.000Z）
        expect(content).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);
      });
    });

    describe('エッジケース', () => {
      it('空のログエントリ配列を処理する', async () => {
        const generator = createReportGenerator();
        const reportDir = join(testTmpDir, 'test-report');
        await mkdir(reportDir, { recursive: true });

        const filePath = await generator.writeRawLog(reportDir, []);
        const content = await readFile(filePath, 'utf-8');

        expect(content).toBe('');
      });
    });
  });

  describe('writeSummaryMd()', () => {
    describe('正常系: summary.mdフォーマット', () => {
      it('Markdown形式で要約を書き込む', async () => {
        const generator = createReportGenerator();
        const reportDir = join(testTmpDir, 'test-report');
        await mkdir(reportDir, { recursive: true });

        const summary: Summary = {
          command: 'flutter',
          args: ['test'],
          status: 'pass',
          exitCode: 0,
          durationMs: 5000,
          excerpts: ['Test passed'],
          tailLines: ['All tests completed'],
        };

        const filePath = await generator.writeSummaryMd(reportDir, summary);
        const content = await readFile(filePath, 'utf-8');

        // ファイルパスが正しい
        expect(filePath).toBe(join(reportDir, 'summary.md'));
        // Markdownヘッダーが含まれる
        expect(content).toContain('# Test Execution Summary');
        // ステータスが含まれる
        expect(content).toContain('pass');
        // コマンドが含まれる
        expect(content).toContain('flutter test');
        // 実行時間が含まれる
        expect(content).toContain('5000ms');
      });

      it('ステータスに応じた絵文字を表示する', async () => {
        const generator = createReportGenerator();
        const reportDir = join(testTmpDir, 'test-report');
        await mkdir(reportDir, { recursive: true });

        const testCases: Array<{ status: string; emoji: string }> = [
          { status: 'pass', emoji: '✅' },
          { status: 'fail', emoji: '❌' },
          { status: 'timeout', emoji: '⏱️' },
          { status: 'no_output', emoji: '🔇' },
          { status: 'error', emoji: '⚠️' },
        ];

        for (const { status, emoji } of testCases) {
          const summary: Summary = {
            command: 'test',
            args: [],
            status,
            exitCode: 0,
            durationMs: 1000,
            excerpts: [],
            tailLines: [],
          };

          const filePath = await generator.writeSummaryMd(reportDir, summary);
          const content = await readFile(filePath, 'utf-8');

          expect(content).toContain(emoji);
        }
      });

      it('人間が読みやすい実行時間形式を使用する', async () => {
        const generator = createReportGenerator();
        const reportDir = join(testTmpDir, 'test-report');
        await mkdir(reportDir, { recursive: true });

        // 1分23秒
        const summary: Summary = {
          command: 'test',
          args: [],
          status: 'pass',
          exitCode: 0,
          durationMs: 83000,
          excerpts: [],
          tailLines: [],
        };

        const filePath = await generator.writeSummaryMd(reportDir, summary);
        const content = await readFile(filePath, 'utf-8');

        // 人間が読みやすい形式（1m 23s）
        expect(content).toContain('1m 23s');
      });

      it('抜粋ブロックを含める', async () => {
        const generator = createReportGenerator();
        const reportDir = join(testTmpDir, 'test-report');
        await mkdir(reportDir, { recursive: true });

        const summary: Summary = {
          command: 'test',
          args: [],
          status: 'fail',
          exitCode: 1,
          durationMs: 1000,
          excerpts: ['ERROR: test failed', 'AssertionError: expected true'],
          tailLines: [],
        };

        const filePath = await generator.writeSummaryMd(reportDir, summary);
        const content = await readFile(filePath, 'utf-8');

        expect(content).toContain('## Excerpts');
        expect(content).toContain('ERROR: test failed');
        expect(content).toContain('AssertionError: expected true');
      });

      it('末尾行を含める', async () => {
        const generator = createReportGenerator();
        const reportDir = join(testTmpDir, 'test-report');
        await mkdir(reportDir, { recursive: true });

        const summary: Summary = {
          command: 'test',
          args: [],
          status: 'pass',
          exitCode: 0,
          durationMs: 1000,
          excerpts: [],
          tailLines: ['Line 1', 'Line 2', 'Line 3'],
        };

        const filePath = await generator.writeSummaryMd(reportDir, summary);
        const content = await readFile(filePath, 'utf-8');

        expect(content).toContain('## Tail Lines');
        expect(content).toContain('Line 1');
        expect(content).toContain('Line 2');
        expect(content).toContain('Line 3');
      });
    });

    describe('エッジケース', () => {
      it('exitCodeがnullの場合、N/Aを表示する', async () => {
        const generator = createReportGenerator();
        const reportDir = join(testTmpDir, 'test-report');
        await mkdir(reportDir, { recursive: true });

        const summary: Summary = {
          command: 'test',
          args: [],
          status: 'timeout',
          exitCode: null,
          durationMs: 1000,
          excerpts: [],
          tailLines: [],
        };

        const filePath = await generator.writeSummaryMd(reportDir, summary);
        const content = await readFile(filePath, 'utf-8');

        expect(content).toContain('N/A');
      });

      it('抜粋と末尾行が空の場合、セクションを省略する', async () => {
        const generator = createReportGenerator();
        const reportDir = join(testTmpDir, 'test-report');
        await mkdir(reportDir, { recursive: true });

        const summary: Summary = {
          command: 'test',
          args: [],
          status: 'pass',
          exitCode: 0,
          durationMs: 1000,
          excerpts: [],
          tailLines: [],
        };

        const filePath = await generator.writeSummaryMd(reportDir, summary);
        const content = await readFile(filePath, 'utf-8');

        expect(content).not.toContain('## Excerpts');
        expect(content).not.toContain('## Tail Lines');
      });
    });
  });

  describe('writeSummaryJson()', () => {
    describe('正常系: summary.jsonフィールド', () => {
      it('必須フィールドを含むJSONを書き込む', async () => {
        const generator = createReportGenerator();
        const reportDir = join(testTmpDir, 'test-report');
        await mkdir(reportDir, { recursive: true });

        const summary: Summary = {
          command: 'flutter',
          args: ['test', '--coverage'],
          status: 'pass',
          exitCode: 0,
          durationMs: 5000,
          excerpts: ['Test passed'],
          tailLines: ['All tests completed'],
        };

        const filePath = await generator.writeSummaryJson(reportDir, summary);
        const content = await readFile(filePath, 'utf-8');
        const parsed = JSON.parse(content);

        // ファイルパスが正しい
        expect(filePath).toBe(join(reportDir, 'summary.json'));
        // 必須フィールドが含まれる
        expect(parsed).toHaveProperty('command');
        expect(parsed).toHaveProperty('exit_code');
        expect(parsed).toHaveProperty('status');
        expect(parsed).toHaveProperty('duration_ms');
        expect(parsed).toHaveProperty('excerpts');
        expect(parsed).toHaveProperty('tail_lines');
      });

      it('commandフィールドにコマンドと引数を結合する', async () => {
        const generator = createReportGenerator();
        const reportDir = join(testTmpDir, 'test-report');
        await mkdir(reportDir, { recursive: true });

        const summary: Summary = {
          command: 'flutter',
          args: ['test', '--coverage'],
          status: 'pass',
          exitCode: 0,
          durationMs: 1000,
          excerpts: [],
          tailLines: [],
        };

        const filePath = await generator.writeSummaryJson(reportDir, summary);
        const content = await readFile(filePath, 'utf-8');
        const parsed = JSON.parse(content);

        expect(parsed.command).toBe('flutter test --coverage');
      });

      it('フィールドの値が正しい', async () => {
        const generator = createReportGenerator();
        const reportDir = join(testTmpDir, 'test-report');
        await mkdir(reportDir, { recursive: true });

        const summary: Summary = {
          command: 'test',
          args: ['arg1', 'arg2'],
          status: 'fail',
          exitCode: 1,
          durationMs: 12345,
          excerpts: ['excerpt1', 'excerpt2'],
          tailLines: ['tail1', 'tail2'],
        };

        const filePath = await generator.writeSummaryJson(reportDir, summary);
        const content = await readFile(filePath, 'utf-8');
        const parsed = JSON.parse(content);

        expect(parsed.status).toBe('fail');
        expect(parsed.exit_code).toBe(1);
        expect(parsed.duration_ms).toBe(12345);
        expect(parsed.excerpts).toEqual(['excerpt1', 'excerpt2']);
        expect(parsed.tail_lines).toEqual(['tail1', 'tail2']);
      });

      it('generated_atフィールドを含む', async () => {
        const generator = createReportGenerator();
        const reportDir = join(testTmpDir, 'test-report');
        await mkdir(reportDir, { recursive: true });

        const summary: Summary = {
          command: 'test',
          args: [],
          status: 'pass',
          exitCode: 0,
          durationMs: 1000,
          excerpts: [],
          tailLines: [],
        };

        const filePath = await generator.writeSummaryJson(reportDir, summary);
        const content = await readFile(filePath, 'utf-8');
        const parsed = JSON.parse(content);

        expect(parsed).toHaveProperty('generated_at');
        // ISO8601形式
        expect(parsed.generated_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      });
    });

    describe('エッジケース', () => {
      it('exitCodeがnullの場合、nullを出力する', async () => {
        const generator = createReportGenerator();
        const reportDir = join(testTmpDir, 'test-report');
        await mkdir(reportDir, { recursive: true });

        const summary: Summary = {
          command: 'test',
          args: [],
          status: 'timeout',
          exitCode: null,
          durationMs: 1000,
          excerpts: [],
          tailLines: [],
        };

        const filePath = await generator.writeSummaryJson(reportDir, summary);
        const content = await readFile(filePath, 'utf-8');
        const parsed = JSON.parse(content);

        expect(parsed.exit_code).toBeNull();
      });

      it('引数が空の場合、コマンドのみを出力する', async () => {
        const generator = createReportGenerator();
        const reportDir = join(testTmpDir, 'test-report');
        await mkdir(reportDir, { recursive: true });

        const summary: Summary = {
          command: 'test',
          args: [],
          status: 'pass',
          exitCode: 0,
          durationMs: 1000,
          excerpts: [],
          tailLines: [],
        };

        const filePath = await generator.writeSummaryJson(reportDir, summary);
        const content = await readFile(filePath, 'utf-8');
        const parsed = JSON.parse(content);

        expect(parsed.command).toBe('test');
      });
    });
  });

  describe('writeAll()', () => {
    it('3つのファイルを同時に生成する', async () => {
      const generator = createReportGenerator();
      const reportDir = join(testTmpDir, 'test-report');
      await mkdir(reportDir, { recursive: true });

      const entries: LogEntry[] = [
        { timestamp: 1704067200000, stream: 'stdout', data: 'test output\n' },
      ];

      const summary: Summary = {
        command: 'flutter',
        args: ['test'],
        status: 'pass',
        exitCode: 0,
        durationMs: 1000,
        excerpts: [],
        tailLines: [],
      };

      const artifacts = await generator.writeAll(reportDir, entries, summary);

      // 3つのパスが返される
      expect(artifacts.rawLog).toBe(join(reportDir, 'raw.log'));
      expect(artifacts.summaryMd).toBe(join(reportDir, 'summary.md'));
      expect(artifacts.summaryJson).toBe(join(reportDir, 'summary.json'));

      // ファイルが存在する
      await expect(access(artifacts.rawLog)).resolves.toBeUndefined();
      await expect(access(artifacts.summaryMd)).resolves.toBeUndefined();
      await expect(access(artifacts.summaryJson)).resolves.toBeUndefined();
    });
  });

  describe('createReportGenerator()', () => {
    it('ReportGeneratorインスタンスを返す', () => {
      const generator = createReportGenerator();
      expect(generator).toBeInstanceOf(ReportGenerator);
    });
  });
});
