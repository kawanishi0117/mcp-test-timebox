/**
 * RunTestTool - テスト実行ツール
 * 
 * MCPサーバが公開する唯一のツール。
 * 入力バリデーション、コマンド構築、プロセス実行、レポート生成を統合する。
 * 
 * Requirements:
 * - 2.1-2.6: テスト実行コマンドの制限
 * - 6.1-6.5: MCPレスポンスの必須フィールド
 */

import { validateRunTestInput, type RunTestInput } from '../validation/input-schema.js';
import { buildCommand, formatCommand } from '../validation/command-builder.js';
import { createProcessExecutor, type ProcessResult, type LogEntry } from '../executor/process-executor.js';
import { createReportGenerator, type Summary, type GeneratedArtifacts } from '../report/report-generator.js';
import { createLogExtractor, formatExtractedBlocks } from '../report/log-extractor.js';
import { normalizePath } from '../utils/path-validator.js';

/**
 * RunTestToolの出力インターフェース
 * 
 * Requirements 6.1-6.5に準拠
 */
export interface RunTestOutput {
  /** 実行ステータス（pass/fail/timeout/no_output/error） */
  status: 'pass' | 'fail' | 'timeout' | 'no_output' | 'error';
  /** 終了コード（タイムアウト/エラー時はnull） */
  exit_code: number | null;
  /** 実行時間（ミリ秒） */
  duration_ms: number;
  /** レポートディレクトリのパス */
  report_dir: string;
  /** 生成された成果物のパス */
  artifacts: {
    raw_log: string;
    summary_md: string;
    summary_json: string;
  };
  /** 抜粋（重要行の抽出結果） */
  excerpt: string;
  /** エラーメッセージ（エラー時のみ） */
  error_message?: string;
}

/**
 * RunTestToolのオプション
 */
export interface RunTestToolOptions {
  /** リポジトリルートパス（デフォルト: process.cwd()） */
  repoRoot?: string;
  /** 末尾行数（要約用、デフォルト: 20） */
  tailLineCount?: number;
}

/**
 * デフォルトの末尾行数
 */
const DEFAULT_TAIL_LINE_COUNT = 20;

/**
 * ログエントリを結合してログ文字列を生成する
 * 
 * @param logs - ログエントリの配列
 * @returns 結合されたログ文字列
 */
function combineLogEntries(logs: LogEntry[]): string {
  return logs.map(entry => entry.data).join('');
}

/**
 * RunTestToolクラス
 * 
 * テスト実行の全体フローを管理する
 */
export class RunTestTool {
  private readonly repoRoot: string;
  private readonly tailLineCount: number;

  /**
   * @param options - ツールオプション
   */
  constructor(options: RunTestToolOptions = {}) {
    this.repoRoot = options.repoRoot || process.cwd();
    this.tailLineCount = options.tailLineCount || DEFAULT_TAIL_LINE_COUNT;
  }

  /**
   * テストを実行する
   * 
   * @param input - 入力パラメータ（未検証）
   * @returns 実行結果
   */
  async execute(input: unknown): Promise<RunTestOutput> {
    const startTime = Date.now();

    // 1. 入力バリデーション
    const validationResult = validateRunTestInput(input);
    if (!validationResult.success || !validationResult.data) {
      return this.createErrorResponse(
        startTime,
        `入力バリデーションエラー: ${validationResult.errors?.join(', ')}`
      );
    }

    const validInput = validationResult.data;

    // cwdは必須パラメータ
    const workingDir = validInput.cwd;

    // 2. targetパスの検証（scope が file/pattern の場合）
    if (validInput.target) {
      const pathResult = normalizePath(validInput.target, workingDir);
      if (!pathResult.valid) {
        return this.createErrorResponse(
          startTime,
          `パス検証エラー: ${pathResult.error}`
        );
      }
    }

    // 3. report_dirパスの検証（指定されている場合）
    let reportDirBase: string | undefined;
    if (validInput.report_dir) {
      const pathResult = normalizePath(validInput.report_dir, workingDir);
      if (!pathResult.valid) {
        return this.createErrorResponse(
          startTime,
          `レポートディレクトリパス検証エラー: ${pathResult.error}`
        );
      }
      reportDirBase = validInput.report_dir;
    }

    // 4. コマンド構築
    let commandResult;
    try {
      commandResult = buildCommand(
        validInput.runner,
        validInput.scope,
        validInput.target
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.createErrorResponse(startTime, `コマンド構築エラー: ${message}`);
    }

    // 5. プロセス実行
    const executor = createProcessExecutor();
    let processResult: ProcessResult;
    try {
      processResult = await executor.execute(
        commandResult.command,
        commandResult.args,
        {
          cwd: workingDir,
          timeoutMs: validInput.timeout_ms,
          noOutputTimeoutMs: validInput.no_output_timeout_ms,
        }
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.createErrorResponse(startTime, `プロセス実行エラー: ${message}`);
    }

    // 6. レポート生成
    const reportGenerator = createReportGenerator();
    let reportDir: string;
    let artifacts: GeneratedArtifacts;

    try {
      // レポートディレクトリ作成
      reportDir = await reportGenerator.createReportDir(reportDirBase);

      // ログ抽出
      const logExtractor = createLogExtractor();
      const combinedLog = combineLogEntries(processResult.logs);
      const extractedBlocks = logExtractor.extractImportantLines(
        combinedLog,
        validInput.max_output_bytes
      );
      const tailLines = logExtractor.getTailLines(combinedLog, this.tailLineCount);

      // 要約情報を構築
      const summary: Summary = {
        command: commandResult.command,
        args: commandResult.args,
        status: processResult.status,
        exitCode: processResult.exitCode,
        durationMs: processResult.durationMs,
        excerpts: extractedBlocks.map(block => block.matchedLine),
        tailLines,
      };

      // 成果物を生成
      artifacts = await reportGenerator.writeAll(
        reportDir,
        processResult.logs,
        summary
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.createErrorResponse(startTime, `レポート生成エラー: ${message}`);
    }

    // 7. 抜粋を生成
    const logExtractor = createLogExtractor();
    const combinedLog = combineLogEntries(processResult.logs);
    const extractedBlocks = logExtractor.extractImportantLines(
      combinedLog,
      validInput.max_output_bytes
    );
    const excerpt = formatExtractedBlocks(extractedBlocks);

    // 8. レスポンス生成
    return {
      status: processResult.status,
      exit_code: processResult.exitCode,
      duration_ms: processResult.durationMs,
      report_dir: reportDir,
      artifacts: {
        raw_log: artifacts.rawLog,
        summary_md: artifacts.summaryMd,
        summary_json: artifacts.summaryJson,
      },
      excerpt,
    };
  }

  /**
   * エラーレスポンスを生成する
   * 
   * @param startTime - 開始時刻
   * @param errorMessage - エラーメッセージ
   * @returns エラーレスポンス
   */
  private createErrorResponse(startTime: number, errorMessage: string): RunTestOutput {
    return {
      status: 'error',
      exit_code: null,
      duration_ms: Date.now() - startTime,
      report_dir: '',
      artifacts: {
        raw_log: '',
        summary_md: '',
        summary_json: '',
      },
      excerpt: '',
      error_message: errorMessage,
    };
  }
}

/**
 * RunTestToolのファクトリ関数
 * 
 * @param options - ツールオプション
 * @returns 新しいRunTestToolインスタンス
 */
export function createRunTestTool(options?: RunTestToolOptions): RunTestTool {
  return new RunTestTool(options);
}
