/**
 * LogExtractor - ログ抽出ユーティリティ
 * 
 * ログから重要な行を抽出し、要約生成を支援する。
 * 正規表現パターンによるマッチングと前後コンテキストの付与を行う。
 * 
 * Requirements:
 * - 5.1: raw.log の末尾 max_output_bytes バイトを対象とする
 * - 5.2: 正規表現パターンにマッチする行を抽出する
 * - 5.3: 前後N行のコンテキストを付与する
 */

/**
 * 重要行抽出パターン
 * 
 * テスト失敗やエラーを示す一般的なパターン
 */
export const IMPORTANT_PATTERNS: RegExp[] = [
  /FAIL/i,
  /FAILED/i,
  /ERROR/i,
  /FATAL/i,
  /Exception/,
  /Traceback/,
  /panic/,
  /AssertionError/,
];

/**
 * 抽出された重要行とそのコンテキスト
 */
export interface ExtractedBlock {
  /** マッチした行番号（0始まり） */
  lineNumber: number;
  /** マッチした行の内容 */
  matchedLine: string;
  /** マッチしたパターン */
  pattern: string;
  /** 前後コンテキストを含む行の配列 */
  contextLines: string[];
  /** コンテキストの開始行番号（0始まり） */
  contextStartLine: number;
  /** コンテキストの終了行番号（0始まり） */
  contextEndLine: number;
}

/**
 * ログ抽出オプション
 */
export interface ExtractOptions {
  /** 対象とする末尾バイト数 */
  maxBytes?: number;
  /** 前後に付与するコンテキスト行数 */
  contextLines?: number;
  /** 使用するパターン（デフォルトはIMPORTANT_PATTERNS） */
  patterns?: RegExp[];
}

/**
 * デフォルトのコンテキスト行数
 */
const DEFAULT_CONTEXT_LINES = 3;

/**
 * ログの末尾から指定バイト数を取得する
 * 
 * @param log - 対象のログ文字列
 * @param maxBytes - 取得する最大バイト数
 * @returns 末尾のログ文字列
 */
export function getTailBytes(log: string, maxBytes: number): string {
  // バイト数でカット
  const encoder = new TextEncoder();
  const encoded = encoder.encode(log);
  
  if (encoded.length <= maxBytes) {
    return log;
  }
  
  // 末尾からmaxBytesを取得
  const tailBytes = encoded.slice(-maxBytes);
  const decoder = new TextDecoder('utf-8', { fatal: false });
  let result = decoder.decode(tailBytes);
  
  // 先頭の不完全な文字を除去（改行まで読み飛ばす）
  const firstNewline = result.indexOf('\n');
  if (firstNewline > 0) {
    result = result.slice(firstNewline + 1);
  }
  
  return result;
}

/**
 * ログの末尾N行を取得する
 * 
 * @param log - 対象のログ文字列
 * @param lineCount - 取得する行数
 * @returns 末尾の行の配列
 */
export function getTailLines(log: string, lineCount: number): string[] {
  if (!log || lineCount <= 0) {
    return [];
  }
  
  const lines = log.split('\n');
  
  // 末尾の空行を除去
  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  
  // 末尾N行を返す
  return lines.slice(-lineCount);
}

/**
 * 重要行を抽出する
 * 
 * 正規表現パターンにマッチする行を抽出し、
 * 前後のコンテキスト行を付与する。
 * 
 * @param log - 対象のログ文字列
 * @param options - 抽出オプション
 * @returns 抽出されたブロックの配列
 */
export function extractImportantLines(
  log: string,
  options: ExtractOptions = {}
): ExtractedBlock[] {
  const {
    maxBytes,
    contextLines = DEFAULT_CONTEXT_LINES,
    patterns = IMPORTANT_PATTERNS,
  } = options;
  
  // maxBytesが指定されている場合、末尾を切り出す
  const targetLog = maxBytes !== undefined ? getTailBytes(log, maxBytes) : log;
  
  if (!targetLog) {
    return [];
  }
  
  const lines = targetLog.split('\n');
  const results: ExtractedBlock[] = [];
  const matchedLineNumbers = new Set<number>();
  
  // 各行をパターンでチェック
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // undefinedチェック
    if (line === undefined) {
      continue;
    }
    
    for (const pattern of patterns) {
      if (pattern.test(line)) {
        // 既にマッチ済みの行はスキップ
        if (matchedLineNumbers.has(i)) {
          continue;
        }
        
        matchedLineNumbers.add(i);
        
        // コンテキスト範囲を計算
        const contextStart = Math.max(0, i - contextLines);
        const contextEnd = Math.min(lines.length - 1, i + contextLines);
        
        // コンテキスト行を取得
        const contextLinesArray = lines.slice(contextStart, contextEnd + 1);
        
        results.push({
          lineNumber: i,
          matchedLine: line,
          pattern: pattern.source,
          contextLines: contextLinesArray,
          contextStartLine: contextStart,
          contextEndLine: contextEnd,
        });
        
        // 1つのパターンにマッチしたら次の行へ
        break;
      }
    }
  }
  
  return results;
}

/**
 * 抽出結果を文字列に整形する
 * 
 * @param blocks - 抽出されたブロックの配列
 * @returns 整形された文字列
 */
export function formatExtractedBlocks(blocks: ExtractedBlock[]): string {
  if (blocks.length === 0) {
    return '';
  }
  
  const parts: string[] = [];
  
  for (const block of blocks) {
    // ヘッダー
    parts.push(`--- Line ${block.lineNumber + 1} (matched: ${block.pattern}) ---`);
    
    // コンテキスト行（行番号付き）
    for (let i = 0; i < block.contextLines.length; i++) {
      const lineNum = block.contextStartLine + i + 1;
      const marker = (block.contextStartLine + i === block.lineNumber) ? '>' : ' ';
      parts.push(`${marker} ${lineNum}: ${block.contextLines[i]}`);
    }
    
    parts.push('');
  }
  
  return parts.join('\n');
}

/**
 * LogExtractorクラス（オブジェクト指向インターフェース）
 * 
 * ログ抽出の設定を保持し、抽出操作を行う
 */
export class LogExtractor {
  private readonly patterns: RegExp[];
  private readonly contextLines: number;
  
  /**
   * @param patterns - 使用するパターン（デフォルトはIMPORTANT_PATTERNS）
   * @param contextLines - 前後に付与するコンテキスト行数
   */
  constructor(
    patterns: RegExp[] = IMPORTANT_PATTERNS,
    contextLines: number = DEFAULT_CONTEXT_LINES
  ) {
    this.patterns = patterns;
    this.contextLines = contextLines;
  }
  
  /**
   * 重要行を抽出する
   * 
   * @param log - 対象のログ文字列
   * @param maxBytes - 対象とする末尾バイト数（省略時は全体）
   * @returns 抽出されたブロックの配列
   */
  extractImportantLines(log: string, maxBytes?: number): ExtractedBlock[] {
    return extractImportantLines(log, {
      maxBytes,
      contextLines: this.contextLines,
      patterns: this.patterns,
    });
  }
  
  /**
   * 末尾N行を取得する
   * 
   * @param log - 対象のログ文字列
   * @param lineCount - 取得する行数
   * @returns 末尾の行の配列
   */
  getTailLines(log: string, lineCount: number): string[] {
    return getTailLines(log, lineCount);
  }
  
  /**
   * 抽出結果を文字列に整形する
   * 
   * @param blocks - 抽出されたブロックの配列
   * @returns 整形された文字列
   */
  formatBlocks(blocks: ExtractedBlock[]): string {
    return formatExtractedBlocks(blocks);
  }
}

/**
 * LogExtractorのファクトリ関数
 * 
 * @param patterns - 使用するパターン
 * @param contextLines - 前後に付与するコンテキスト行数
 * @returns 新しいLogExtractorインスタンス
 */
export function createLogExtractor(
  patterns?: RegExp[],
  contextLines?: number
): LogExtractor {
  return new LogExtractor(patterns, contextLines);
}
