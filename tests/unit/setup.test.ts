/**
 * テスト環境セットアップ確認用テスト
 * 
 * このテストはテスト環境が正しく動作することを確認するためのものです。
 * 実際の機能テストは各コンポーネントのテストファイルで行います。
 */
import { describe, it, expect } from 'vitest';

describe('テスト環境セットアップ', () => {
  it('vitestが正しく動作すること', () => {
    expect(1 + 1).toBe(2);
  });

  it('TypeScriptの型チェックが動作すること', () => {
    const value: string = 'test';
    expect(typeof value).toBe('string');
  });
});
