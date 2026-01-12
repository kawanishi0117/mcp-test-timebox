/**
 * LogExtractor プロパティベーステスト
 * 
 * Feature: mcp-test-timebox
 * 
 * Property 8: ログ抽出のバイト制限
 * *For any* ログ文字列と正の整数 max_output_bytes に対して、
 * LogExtractor が処理する対象は末尾 max_output_bytes バイト以内である。
 * Validates: Requirements 5.1
 * 
 * Property 9: 重要行の抽出とコンテキスト付与
 * *For any* ログ文字列に対して、LogExtractor は：
 * - 正規表現パターンにマッチする行を抽出する
 * - 抽出された各行に前後N行のコンテキストを付与する
 * Validates: Requirements 5.2, 5.3
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  LogExtractor,
  extractImportantLines,
  getTailLines,
  getTailBytes,
  IMPORTANT_PATTERNS,
  type ExtractedBlock,
} from '../../src/report/log-extractor.js';

describe('LogExtractor プロパティテスト', () => {
  describe('Property 8: ログ抽出のバイト制限', () => {
    /**
     * Property 8.1: getTailBytesは指定バイト数以内を返す
     * 
     * 任意のログ文字列と正の整数maxBytesに対して、
     * getTailBytesの結果はmaxBytesバイト以内である
     */
    it('getTailBytesは指定バイト数以内を返す', () => {
      // ログ文字列生成器（ASCII文字のみ）
      const logString = fc.string({ minLength: 0, maxLength: 10000 });
      // 正の整数
      const maxBytes = fc.integer({ min: 1, max: 5000 });

      fc.assert(
        fc.property(logString, maxBytes, (log, max) => {
          const result = getTailBytes(log, max);
          const encoder = new TextEncoder();
          const resultBytes = encoder.encode(result).length;
          
          // 結果のバイト数はmaxBytes以内
          return resultBytes <= max;
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property 8.2: extractImportantLinesはmaxBytes制限を尊重する
     * 
     * 任意のログ文字列とmaxBytesに対して、
     * extractImportantLinesが処理する対象は末尾maxBytesバイト以内
     */
    it('extractImportantLinesはmaxBytes制限を尊重する', () => {
      // 重要パターンを含む可能性のあるログ行
      const logLine = fc.oneof(
        fc.constant('Normal log line'),
        fc.constant('ERROR: something went wrong'),
        fc.constant('FAIL: test failed'),
        fc.constant('Exception occurred'),
        fc.string({ minLength: 1, maxLength: 100 })
      );
      
      // 複数行のログ
      const logLines = fc.array(logLine, { minLength: 1, maxLength: 100 });
      const maxBytes = fc.integer({ min: 10, max: 1000 });

      fc.assert(
        fc.property(logLines, maxBytes, (lines, max) => {
          const log = lines.join('\n');
          const results = extractImportantLines(log, { maxBytes: max });
          
          // 結果が空の場合はOK
          if (results.length === 0) {
            return true;
          }
          
          // 抽出された行は末尾maxBytesの範囲内にある
          // getTailBytesで取得した範囲内の行番号であることを確認
          const tailLog = getTailBytes(log, max);
          const tailLines = tailLog.split('\n');
          
          // 抽出されたすべての行がtailLog内に存在する
          for (const block of results) {
            const found = tailLines.some(line => line === block.matchedLine);
            if (!found) {
              return false;
            }
          }
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property 8.3: maxBytesが十分大きい場合、全体が処理される
     * 
     * maxBytesがログ全体より大きい場合、
     * getTailBytesは元のログと同じ内容を返す
     */
    it('maxBytesが十分大きい場合、全体が処理される', () => {
      const logString = fc.string({ minLength: 1, maxLength: 1000 });

      fc.assert(
        fc.property(logString, (log) => {
          const encoder = new TextEncoder();
          const logBytes = encoder.encode(log).length;
          
          // ログより大きいmaxBytesを指定
          const result = getTailBytes(log, logBytes + 1000);
          
          // 元のログと同じ
          return result === log;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 9: 重要行の抽出とコンテキスト付与', () => {
    /**
     * Property 9.1: パターンにマッチする行は必ず抽出される
     * 
     * 任意のログに重要パターンを含む行がある場合、
     * その行は抽出結果に含まれる
     */
    it('パターンにマッチする行は必ず抽出される', () => {
      // 重要パターンを含む行
      const importantLine = fc.constantFrom(
        'ERROR: test error',
        'FAIL: test failed',
        'FAILED: assertion',
        'FATAL: crash',
        'Exception: null pointer',
        'Traceback (most recent call last):',
        'panic: runtime error',
        'AssertionError: expected true'
      );
      
      // 通常の行
      const normalLine = fc.constantFrom(
        'Running tests...',
        'Test passed',
        'OK',
        'Starting server',
        'Connection established'
      );
      
      // ログ生成（重要行を含む）
      const logWithImportant = fc.tuple(
        fc.array(normalLine, { minLength: 0, maxLength: 10 }),
        importantLine,
        fc.array(normalLine, { minLength: 0, maxLength: 10 })
      ).map(([before, important, after]) => 
        [...before, important, ...after].join('\n')
      );

      fc.assert(
        fc.property(logWithImportant, importantLine, (log, expectedLine) => {
          // ログに重要行が含まれていることを確認
          if (!log.includes(expectedLine)) {
            return true; // この組み合わせはスキップ
          }
          
          const results = extractImportantLines(log);
          
          // 重要行が抽出されている
          const found = results.some(block => block.matchedLine === expectedLine);
          return found;
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property 9.2: 抽出された行には正しいコンテキストが付与される
     * 
     * 任意の抽出結果に対して、
     * コンテキスト行数は指定された範囲内である
     */
    it('抽出された行には正しいコンテキストが付与される', () => {
      // コンテキスト行数
      const contextLines = fc.integer({ min: 1, max: 10 });
      
      // ログ行
      const logLines = fc.array(
        fc.oneof(
          fc.constant('Normal line'),
          fc.constant('ERROR: test error'),
          fc.constant('Another normal line')
        ),
        { minLength: 5, maxLength: 50 }
      );

      fc.assert(
        fc.property(logLines, contextLines, (lines, ctx) => {
          const log = lines.join('\n');
          const results = extractImportantLines(log, { contextLines: ctx });
          
          for (const block of results) {
            // コンテキスト範囲の検証
            const expectedStart = Math.max(0, block.lineNumber - ctx);
            const expectedEnd = Math.min(lines.length - 1, block.lineNumber + ctx);
            
            // コンテキスト開始行が正しい
            if (block.contextStartLine !== expectedStart) {
              return false;
            }
            
            // コンテキスト終了行が正しい
            if (block.contextEndLine !== expectedEnd) {
              return false;
            }
            
            // コンテキスト行数が正しい
            const expectedContextLength = expectedEnd - expectedStart + 1;
            if (block.contextLines.length !== expectedContextLength) {
              return false;
            }
          }
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property 9.3: マッチした行はコンテキスト内に含まれる
     * 
     * 任意の抽出結果に対して、
     * マッチした行はコンテキスト行の中に含まれる
     */
    it('マッチした行はコンテキスト内に含まれる', () => {
      const logLines = fc.array(
        fc.oneof(
          fc.constant('Normal line'),
          fc.constant('ERROR: test error'),
          fc.constant('FAIL: test failed')
        ),
        { minLength: 3, maxLength: 30 }
      );

      fc.assert(
        fc.property(logLines, (lines) => {
          const log = lines.join('\n');
          const results = extractImportantLines(log);
          
          for (const block of results) {
            // マッチした行がコンテキスト内に存在する
            const found = block.contextLines.includes(block.matchedLine);
            if (!found) {
              return false;
            }
          }
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property 9.4: パターンにマッチしない行は抽出されない
     * 
     * 重要パターンを含まないログに対して、
     * 抽出結果は空である
     */
    it('パターンにマッチしない行は抽出されない', () => {
      // 重要パターンを含まない行のみ
      const safeLine = fc.constantFrom(
        'Running tests...',
        'Test passed',
        'OK',
        'Starting server',
        'Connection established',
        'All tests completed successfully'
      );
      
      const safeLog = fc.array(safeLine, { minLength: 1, maxLength: 20 })
        .map(lines => lines.join('\n'));

      fc.assert(
        fc.property(safeLog, (log) => {
          const results = extractImportantLines(log);
          
          // 抽出結果は空
          return results.length === 0;
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property 9.5: getTailLinesは指定行数以内を返す
     * 
     * 任意のログと行数に対して、
     * getTailLinesの結果は指定行数以内である
     */
    it('getTailLinesは指定行数以内を返す', () => {
      const logLines = fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 0, maxLength: 100 });
      const lineCount = fc.integer({ min: 1, max: 50 });

      fc.assert(
        fc.property(logLines, lineCount, (lines, count) => {
          const log = lines.join('\n');
          const result = getTailLines(log, count);
          
          // 結果の行数は指定行数以内
          return result.length <= count;
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property 9.6: LogExtractorクラスは関数と同じ結果を返す
     * 
     * LogExtractorクラスのメソッドは、対応する関数と同じ結果を返す
     */
    it('LogExtractorクラスは関数と同じ結果を返す', () => {
      const logLines = fc.array(
        fc.oneof(
          fc.constant('Normal line'),
          fc.constant('ERROR: test error')
        ),
        { minLength: 1, maxLength: 20 }
      );

      fc.assert(
        fc.property(logLines, (lines) => {
          const log = lines.join('\n');
          const extractor = new LogExtractor();
          
          // extractImportantLinesの結果が一致
          const funcResult = extractImportantLines(log);
          const classResult = extractor.extractImportantLines(log);
          
          if (funcResult.length !== classResult.length) {
            return false;
          }
          
          for (let i = 0; i < funcResult.length; i++) {
            if (funcResult[i].matchedLine !== classResult[i].matchedLine) {
              return false;
            }
          }
          
          // getTailLinesの結果が一致
          const funcTail = getTailLines(log, 5);
          const classTail = extractor.getTailLines(log, 5);
          
          if (funcTail.length !== classTail.length) {
            return false;
          }
          
          for (let i = 0; i < funcTail.length; i++) {
            if (funcTail[i] !== classTail[i]) {
              return false;
            }
          }
          
          return true;
        }),
        { numRuns: 100 }
      );
    });
  });
});
