/**
 * ReportGenerator - レポート生成コンポーネント
 * 
 * テスト実行結果から成果物（raw.log, summary.md, summary.json）を生成する。
 * 
 * Requirements:
 * - 4.1: report_dir に raw.log を生成する
 * - 4.2: report_dir に summary.md を生成する
 * - 4.3: report_dir に summary.json を生成する
 * - 4.4: raw.log は stdout/stderr の出力元を区別して記録する
 * - 4.5: report_dir が未指定の場合、デフォルトパスを使用する
 * - 5.4: summary.json に必須フィールドを含める
 * - 5.5: summary.md に人間が読みやすい形式で情報を含める
 */

import { mkdir, writeFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { LogEntry } from '../executor/process-executor.js';

/**
 * 保持するレポートの最大数
 */
const MAX_REPORTS = 5;

/**
 * 要約情報
 */
export interface Summary {
  /** 実行コマンド */
  command: string;
  /** コマンド引数 */
  args: string[];
  /** 実行ステータス */
  status: string;
  /** 終了コード */
  exitCode: number | null;
  /** 実行時間（ミリ秒） */
  durationMs: number;
  /** 抜粋ブロック */
  excerpts: string[];
  /** 末尾N行 */
  tailLines: string[];
}

/**
 * 生成された成果物のパス
 */
export interface GeneratedArtifacts {
  /** raw.log のパス */
  rawLog: string;
  /** summary.md のパス */
  summaryMd: string;
  /** summary.json のパス */
  summaryJson: string;
}

/**
 * ReportGeneratorインターフェース
 */
export interface IReportGenerator {
  /**
   * レポートディレクトリを作成する
   * 
   * @param basePath - ベースパス（省略時はデフォルトパス）
   * @returns 作成されたディレクトリのパス
   */
  createReportDir(basePath?: string): Promise<string>;

  /**
   * raw.log を生成する（stdout/stderr を区別して記録）
   * 
   * @param reportDir - レポートディレクトリ
   * @param entries - ログエントリの配列
   * @returns 生成されたファイルのパス
   */
  writeRawLog(reportDir: string, entries: LogEntry[]): Promise<string>;

  /**
   * summary.md を生成する
   * 
   * @param reportDir - レポートディレクトリ
   * @param summary - 要約情報
   * @returns 生成されたファイルのパス
   */
  writeSummaryMd(reportDir: string, summary: Summary): Promise<string>;

  /**
   * summary.json を生成する
   * 
   * @param reportDir - レポートディレクトリ
   * @param summary - 要約情報
   * @returns 生成されたファイルのパス
   */
  writeSummaryJson(reportDir: string, summary: Summary): Promise<string>;

  /**
   * すべての成果物を生成する
   * 
   * @param reportDir - レポートディレクトリ
   * @param entries - ログエントリの配列
   * @param summary - 要約情報
   * @returns 生成された成果物のパス
   */
  writeAll(
    reportDir: string,
    entries: LogEntry[],
    summary: Summary
  ): Promise<GeneratedArtifacts>;
}


/**
 * デフォルトのレポートディレクトリベースパス
 */
const DEFAULT_REPORT_BASE = '.cache/mcp-test-timebox/reports';

/**
 * タイムスタンプをISO8601形式でフォーマットする
 * 
 * @param timestamp - Unix timestamp (ms)
 * @returns ISO8601形式の文字列
 */
function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

/**
 * タイムスタンプをディレクトリ名用にフォーマットする
 * 
 * @returns ディレクトリ名用の文字列（例: 20260113-123456）
 */
function generateTimestampDirName(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

/**
 * ステータスに対応する絵文字を取得する
 * 
 * @param status - 実行ステータス
 * @returns 絵文字
 */
function getStatusEmoji(status: string): string {
  switch (status) {
    case 'pass':
      return '✅';
    case 'fail':
      return '❌';
    case 'timeout':
      return '⏱️';
    case 'no_output':
      return '🔇';
    case 'error':
      return '⚠️';
    default:
      return '❓';
  }
}

/**
 * ミリ秒を人間が読みやすい形式に変換する
 * 
 * @param ms - ミリ秒
 * @returns 人間が読みやすい形式（例: "1m 23s" or "456ms"）
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  
  return `${seconds}s`;
}

/**
 * ReportGenerator - レポート生成の実装
 */
export class ReportGenerator implements IReportGenerator {
  /**
   * 古いレポートを削除して最新N件のみ保持する
   * 
   * @param basePath - レポートのベースパス
   */
  private async cleanupOldReports(basePath: string): Promise<void> {
    try {
      const entries = await readdir(basePath, { withFileTypes: true });
      
      // ディレクトリのみをフィルタし、名前でソート（タイムスタンプ形式なので降順で新しい順）
      const dirs = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
        .reverse();
      
      // MAX_REPORTS を超える古いディレクトリを削除
      const toDelete = dirs.slice(MAX_REPORTS);
      
      for (const dir of toDelete) {
        const dirPath = join(basePath, dir);
        await rm(dirPath, { recursive: true, force: true });
      }
    } catch {
      // ディレクトリが存在しない場合などは無視
    }
  }

  /**
   * レポートディレクトリを作成する
   * 
   * @param basePath - ベースパス（省略時はデフォルトパス）
   * @returns 作成されたディレクトリのパス
   */
  async createReportDir(basePath?: string): Promise<string> {
    // デフォルトパスを使用（Requirements 4.5）
    const base = basePath || DEFAULT_REPORT_BASE;
    const timestampDir = generateTimestampDirName();
    const reportDir = join(base, timestampDir);
    
    // ディレクトリを再帰的に作成
    await mkdir(reportDir, { recursive: true });
    
    // 古いレポートをクリーンアップ
    await this.cleanupOldReports(base);
    
    return reportDir;
  }

  /**
   * raw.log を生成する（stdout/stderr を区別して記録）
   * 
   * @param reportDir - レポートディレクトリ
   * @param entries - ログエントリの配列
   * @returns 生成されたファイルのパス
   */
  async writeRawLog(reportDir: string, entries: LogEntry[]): Promise<string> {
    const filePath = join(reportDir, 'raw.log');
    
    // ログエントリをフォーマット（Requirements 4.4）
    // フォーマット: [timestamp] [stream] data
    const lines = entries.map((entry) => {
      const timestamp = formatTimestamp(entry.timestamp);
      return `[${timestamp}] [${entry.stream}] ${entry.data}`;
    });
    
    const content = lines.join('');
    await writeFile(filePath, content, 'utf-8');
    
    return filePath;
  }

  /**
   * summary.md を生成する
   * 
   * @param reportDir - レポートディレクトリ
   * @param summary - 要約情報
   * @returns 生成されたファイルのパス
   */
  async writeSummaryMd(reportDir: string, summary: Summary): Promise<string> {
    const filePath = join(reportDir, 'summary.md');
    
    // Markdown形式で要約を生成（Requirements 5.5）
    const statusEmoji = getStatusEmoji(summary.status);
    const durationFormatted = formatDuration(summary.durationMs);
    const commandLine = `${summary.command} ${summary.args.join(' ')}`.trim();
    
    const sections: string[] = [
      `# Test Execution Summary`,
      '',
      `## Result`,
      '',
      `| Item | Value |`,
      `|------|-------|`,
      `| Status | ${statusEmoji} ${summary.status} |`,
      `| Exit Code | ${summary.exitCode ?? 'N/A'} |`,
      `| Duration | ${durationFormatted} (${summary.durationMs}ms) |`,
      '',
      `## Command`,
      '',
      '```',
      commandLine,
      '```',
      '',
    ];
    
    // 抜粋ブロック
    if (summary.excerpts.length > 0) {
      sections.push(`## Excerpts`);
      sections.push('');
      sections.push('```');
      sections.push(...summary.excerpts);
      sections.push('```');
      sections.push('');
    }
    
    // 末尾N行
    if (summary.tailLines.length > 0) {
      sections.push(`## Tail Lines`);
      sections.push('');
      sections.push('```');
      sections.push(...summary.tailLines);
      sections.push('```');
      sections.push('');
    }
    
    const content = sections.join('\n');
    await writeFile(filePath, content, 'utf-8');
    
    return filePath;
  }

  /**
   * summary.json を生成する
   * 
   * @param reportDir - レポートディレクトリ
   * @param summary - 要約情報
   * @returns 生成されたファイルのパス
   */
  async writeSummaryJson(reportDir: string, summary: Summary): Promise<string> {
    const filePath = join(reportDir, 'summary.json');
    
    // JSON形式で要約を生成（Requirements 5.4）
    // 必須フィールド: command, exit_code, status, duration_ms, excerpts, tail_lines
    const jsonContent = {
      command: `${summary.command} ${summary.args.join(' ')}`.trim(),
      args: summary.args,
      status: summary.status,
      exit_code: summary.exitCode,
      duration_ms: summary.durationMs,
      excerpts: summary.excerpts,
      tail_lines: summary.tailLines,
      generated_at: new Date().toISOString(),
    };
    
    const content = JSON.stringify(jsonContent, null, 2);
    await writeFile(filePath, content, 'utf-8');
    
    return filePath;
  }

  /**
   * すべての成果物を生成する
   * 
   * @param reportDir - レポートディレクトリ
   * @param entries - ログエントリの配列
   * @param summary - 要約情報
   * @returns 生成された成果物のパス
   */
  async writeAll(
    reportDir: string,
    entries: LogEntry[],
    summary: Summary
  ): Promise<GeneratedArtifacts> {
    const [rawLog, summaryMd, summaryJson] = await Promise.all([
      this.writeRawLog(reportDir, entries),
      this.writeSummaryMd(reportDir, summary),
      this.writeSummaryJson(reportDir, summary),
    ]);
    
    return {
      rawLog,
      summaryMd,
      summaryJson,
    };
  }
}

/**
 * ReportGeneratorのファクトリ関数
 * 
 * @returns 新しいReportGeneratorインスタンス
 */
export function createReportGenerator(): IReportGenerator {
  return new ReportGenerator();
}
