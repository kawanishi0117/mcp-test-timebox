/**
 * プロパティベーステスト環境セットアップ確認用テスト
 * 
 * fast-checkが正しく動作することを確認するためのテストです。
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

describe('プロパティベーステスト環境セットアップ', () => {
  it('fast-checkが正しく動作すること', () => {
    // 任意の整数に対して、2倍して2で割ると元の値に戻る
    fc.assert(
      fc.property(fc.integer(), (n) => {
        return (n * 2) / 2 === n;
      }),
      { numRuns: 100 } // 100回実行
    );
  });

  it('文字列のプロパティテストが動作すること', () => {
    // 任意の文字列に対して、長さは0以上
    fc.assert(
      fc.property(fc.string(), (s) => {
        return s.length >= 0;
      }),
      { numRuns: 100 }
    );
  });
});
