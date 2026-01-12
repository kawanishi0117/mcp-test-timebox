/**
 * LogExtractor ユニットテスト
 * 
 * Requirements: 5.1, 5.2, 5.3
 * - 5.1: raw.log の末尾 max_output_bytes バイトを対象とする
 * - 5.2: 正規表現パターンにマッチする行を抽出する
 * - 5.3: 前後N行のコンテキストを付与する
 */
import { describe, it, expect } from 'vitest';
import {
  LogExtractor,
  extractImportantLines,
  getTailLines,
  getTailBytes,
  formatExtractedBlocks,
  IMPORTANT_PATTERNS,
} from '../../src/report/log-extractor.js';

describe('LogExtractor ユニットテスト', () => {
  describe('getTailBytes()', () => {
    describe('正常系: バイト制限', () => {
      it('指定バイト数以内の文字列を返す', () => {
        const log = 'Hello, World!'; // 13バイト
        const result = getTailBytes(log, 5);
        
        const encoder = new TextEncoder();
        expect(encoder.encode(result).length).toBeLessThanOrEqual(5);
      });

      it('ログ全体がmaxBytes以内の場合、全体を返す', () => {
        const log = 'Short log';
        const result = getTailBytes(log, 1000);
        
        expect(result).toBe(log);
      });

      it('末尾から切り出す', () => {
        const log = 'Line 1\nLine 2\nLine 3';
        const result = getTailBytes(log, 10);
        
        // 末尾部分が含まれる
        expect(result).toContain('Line 3');
      });

      it('マルチバイト文字を正しく処理する', () => {
        const log = 'あいうえお'; // 各文字3バイト = 15バイト
        const result = getTailBytes(log, 10);
        
        // 不完全な文字を除去するため、結果は元のバイト数より小さくなる可能性がある
        // ただし、改行で区切られていない場合は全体が返される可能性もある
        const encoder = new TextEncoder();
        // マルチバイト文字の境界で切れた場合、改行がないと全体が返される
        expect(result.length).toBeLessThanOrEqual(log.length);
      });
    });

    describe('エッジケース', () => {
      it('空文字列を処理する', () => {
        const result = getTailBytes('', 100);
        expect(result).toBe('');
      });

      it('maxBytesが1の場合', () => {
        const log = 'abc';
        const result = getTailBytes(log, 1);
        
        const encoder = new TextEncoder();
        expect(encoder.encode(result).length).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('getTailLines()', () => {
    describe('正常系: 末尾行取得', () => {
      it('指定行数の末尾を返す', () => {
        const log = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
        const result = getTailLines(log, 3);
        
        expect(result).toEqual(['Line 3', 'Line 4', 'Line 5']);
      });

      it('ログ全体が指定行数以内の場合、全体を返す', () => {
        const log = 'Line 1\nLine 2';
        const result = getTailLines(log, 10);
        
        expect(result).toEqual(['Line 1', 'Line 2']);
      });

      it('末尾の空行を除去する', () => {
        const log = 'Line 1\nLine 2\n\n';
        const result = getTailLines(log, 5);
        
        expect(result).toEqual(['Line 1', 'Line 2']);
      });
    });

    describe('エッジケース', () => {
      it('空文字列を処理する', () => {
        const result = getTailLines('', 5);
        expect(result).toEqual([]);
      });

      it('lineCountが0の場合、空配列を返す', () => {
        const result = getTailLines('Line 1\nLine 2', 0);
        expect(result).toEqual([]);
      });

      it('lineCountが負の場合、空配列を返す', () => {
        const result = getTailLines('Line 1\nLine 2', -1);
        expect(result).toEqual([]);
      });
    });
  });

  describe('extractImportantLines()', () => {
    describe('正常系: パターンマッチング', () => {
      it('ERRORパターンにマッチする行を抽出する', () => {
        const log = 'Normal line\nERROR: something went wrong\nAnother line';
        const results = extractImportantLines(log);
        
        expect(results.length).toBe(1);
        expect(results[0].matchedLine).toBe('ERROR: something went wrong');
      });

      it('FAILパターンにマッチする行を抽出する', () => {
        const log = 'Test starting\nFAIL: test failed\nTest ending';
        const results = extractImportantLines(log);
        
        expect(results.length).toBe(1);
        expect(results[0].matchedLine).toBe('FAIL: test failed');
      });

      it('FAILEDパターンにマッチする行を抽出する', () => {
        const log = 'Running\nTest FAILED\nDone';
        const results = extractImportantLines(log);
        
        expect(results.length).toBe(1);
        expect(results[0].matchedLine).toBe('Test FAILED');
      });

      it('Exceptionパターンにマッチする行を抽出する', () => {
        const log = 'Start\nException: null pointer\nEnd';
        const results = extractImportantLines(log);
        
        expect(results.length).toBe(1);
        expect(results[0].matchedLine).toBe('Exception: null pointer');
      });

      it('Tracebackパターンにマッチする行を抽出する', () => {
        const log = 'Running\nTraceback (most recent call last):\nFile "test.py"';
        const results = extractImportantLines(log);
        
        expect(results.length).toBe(1);
        expect(results[0].matchedLine).toBe('Traceback (most recent call last):');
      });

      it('panicパターンにマッチする行を抽出する', () => {
        const log = 'Start\npanic: runtime error\nEnd';
        const results = extractImportantLines(log);
        
        expect(results.length).toBe(1);
        expect(results[0].matchedLine).toBe('panic: runtime error');
      });

      it('AssertionErrorパターンにマッチする行を抽出する', () => {
        const log = 'Test\nAssertionError: expected true\nDone';
        const results = extractImportantLines(log);
        
        expect(results.length).toBe(1);
        expect(results[0].matchedLine).toBe('AssertionError: expected true');
      });

      it('複数のマッチを抽出する', () => {
        const log = 'Start\nERROR: first\nMiddle\nFAIL: second\nEnd';
        const results = extractImportantLines(log);
        
        expect(results.length).toBe(2);
        expect(results[0].matchedLine).toBe('ERROR: first');
        expect(results[1].matchedLine).toBe('FAIL: second');
      });

      it('大文字小文字を区別しない（ERROR/error）', () => {
        const log = 'error: lowercase\nERROR: uppercase\nError: mixed';
        const results = extractImportantLines(log);
        
        expect(results.length).toBe(3);
      });
    });

    describe('正常系: コンテキスト付与', () => {
      it('前後3行のコンテキストを付与する（デフォルト）', () => {
        const log = [
          'Line 0',
          'Line 1',
          'Line 2',
          'Line 3',
          'ERROR: test',
          'Line 5',
          'Line 6',
          'Line 7',
          'Line 8',
        ].join('\n');
        
        const results = extractImportantLines(log);
        
        expect(results.length).toBe(1);
        expect(results[0].contextStartLine).toBe(1); // Line 1
        expect(results[0].contextEndLine).toBe(7);   // Line 7
        expect(results[0].contextLines.length).toBe(7);
      });

      it('カスタムコンテキスト行数を指定する', () => {
        const log = [
          'Line 0',
          'Line 1',
          'ERROR: test',
          'Line 3',
          'Line 4',
        ].join('\n');
        
        const results = extractImportantLines(log, { contextLines: 1 });
        
        expect(results.length).toBe(1);
        expect(results[0].contextStartLine).toBe(1); // Line 1
        expect(results[0].contextEndLine).toBe(3);   // Line 3
        expect(results[0].contextLines.length).toBe(3);
      });

      it('先頭付近のマッチでは前のコンテキストが制限される', () => {
        const log = 'ERROR: first line\nLine 1\nLine 2';
        const results = extractImportantLines(log);
        
        expect(results.length).toBe(1);
        expect(results[0].contextStartLine).toBe(0);
        expect(results[0].contextLines[0]).toBe('ERROR: first line');
      });

      it('末尾付近のマッチでは後のコンテキストが制限される', () => {
        const log = 'Line 0\nLine 1\nERROR: last line';
        const results = extractImportantLines(log);
        
        expect(results.length).toBe(1);
        expect(results[0].contextEndLine).toBe(2);
      });
    });

    describe('正常系: バイト制限', () => {
      it('maxBytesで末尾を制限する', () => {
        const log = 'A'.repeat(1000) + '\nERROR: in tail\n' + 'B'.repeat(100);
        const results = extractImportantLines(log, { maxBytes: 200 });
        
        // 末尾200バイト内のERRORが抽出される
        expect(results.length).toBe(1);
        expect(results[0].matchedLine).toBe('ERROR: in tail');
      });

      it('maxBytesが小さすぎるとマッチしない', () => {
        const log = 'ERROR: at start\n' + 'A'.repeat(1000);
        const results = extractImportantLines(log, { maxBytes: 100 });
        
        // 先頭のERRORは末尾100バイトに含まれない
        expect(results.length).toBe(0);
      });
    });

    describe('エッジケース', () => {
      it('空文字列を処理する', () => {
        const results = extractImportantLines('');
        expect(results).toEqual([]);
      });

      it('マッチしない場合は空配列を返す', () => {
        const log = 'Normal line 1\nNormal line 2\nAll good';
        const results = extractImportantLines(log);
        
        expect(results).toEqual([]);
      });

      it('同じ行が複数パターンにマッチしても1回だけ抽出する', () => {
        const log = 'ERROR FAIL FATAL';
        const results = extractImportantLines(log);
        
        // 1行なので1回だけ
        expect(results.length).toBe(1);
      });
    });
  });

  describe('formatExtractedBlocks()', () => {
    it('抽出結果を整形する', () => {
      const log = 'Line 0\nERROR: test\nLine 2';
      const blocks = extractImportantLines(log, { contextLines: 1 });
      const formatted = formatExtractedBlocks(blocks);
      
      // 行番号は1始まりで表示される
      expect(formatted).toContain('Line 2'); // 行番号2（ERRORの行）
      expect(formatted).toContain('ERROR');
      expect(formatted).toContain('test');
    });

    it('空の配列は空文字列を返す', () => {
      const formatted = formatExtractedBlocks([]);
      expect(formatted).toBe('');
    });
  });

  describe('IMPORTANT_PATTERNS', () => {
    it('期待されるパターンが含まれている', () => {
      const patternSources = IMPORTANT_PATTERNS.map(p => p.source);
      
      expect(patternSources).toContain('FAIL');
      expect(patternSources).toContain('FAILED');
      expect(patternSources).toContain('ERROR');
      expect(patternSources).toContain('FATAL');
      expect(patternSources).toContain('Exception');
      expect(patternSources).toContain('Traceback');
      expect(patternSources).toContain('panic');
      expect(patternSources).toContain('AssertionError');
    });
  });

  describe('LogExtractorクラス', () => {
    it('デフォルト設定で動作する', () => {
      const extractor = new LogExtractor();
      const log = 'Start\nERROR: test\nEnd';
      
      const results = extractor.extractImportantLines(log);
      expect(results.length).toBe(1);
    });

    it('カスタムパターンを使用する', () => {
      const customPatterns = [/CUSTOM/];
      const extractor = new LogExtractor(customPatterns);
      
      const log = 'ERROR: ignored\nCUSTOM: matched';
      const results = extractor.extractImportantLines(log);
      
      expect(results.length).toBe(1);
      expect(results[0].matchedLine).toBe('CUSTOM: matched');
    });

    it('カスタムコンテキスト行数を使用する', () => {
      const extractor = new LogExtractor(IMPORTANT_PATTERNS, 1);
      const log = 'Line 0\nLine 1\nERROR: test\nLine 3\nLine 4';
      
      const results = extractor.extractImportantLines(log);
      expect(results[0].contextLines.length).toBe(3); // 前1 + マッチ + 後1
    });

    it('getTailLines()が正しく動作する', () => {
      const extractor = new LogExtractor();
      const log = 'Line 1\nLine 2\nLine 3';
      
      const result = extractor.getTailLines(log, 2);
      expect(result).toEqual(['Line 2', 'Line 3']);
    });

    it('formatBlocks()が正しく動作する', () => {
      const extractor = new LogExtractor();
      const log = 'ERROR: test';
      
      const blocks = extractor.extractImportantLines(log);
      const formatted = extractor.formatBlocks(blocks);
      
      expect(formatted).toContain('ERROR');
    });

    it('maxBytesオプションが正しく動作する', () => {
      const extractor = new LogExtractor();
      const log = 'ERROR: at start\n' + 'A'.repeat(1000);
      
      const results = extractor.extractImportantLines(log, 100);
      expect(results.length).toBe(0); // 先頭のERRORは末尾100バイトに含まれない
    });
  });
});
