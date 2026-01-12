/**
 * PathValidator ユニットテスト
 * 
 * Requirements: 2.6, 4.6, 4.7
 * - 2.6: targetパラメータがリポジトリ配下であることを検証
 * - 4.6: report_dirがリポジトリ配下であることを検証
 * - 4.7: リポジトリ外を指すパスはエラーを返す
 */
import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { isUnderRepo, normalizePath, PathValidator } from '../../src/utils/path-validator.js';

// テスト用のリポジトリルート
const TEST_REPO_ROOT = process.platform === 'win32' 
  ? 'C:\\repo' 
  : '/repo';

describe('PathValidator ユニットテスト', () => {
  describe('isUnderRepo()', () => {
    describe('正常系: リポジトリ配下のパス', () => {
      it('単純な相対パスはtrueを返す', () => {
        expect(isUnderRepo('test', TEST_REPO_ROOT)).toBe(true);
      });

      it('ネストした相対パスはtrueを返す', () => {
        expect(isUnderRepo('src/utils/test.ts', TEST_REPO_ROOT)).toBe(true);
      });

      it('カレントディレクトリ（.）はtrueを返す', () => {
        expect(isUnderRepo('.', TEST_REPO_ROOT)).toBe(true);
      });

      it('./で始まる相対パスはtrueを返す', () => {
        expect(isUnderRepo('./src/test.ts', TEST_REPO_ROOT)).toBe(true);
      });

      it('リポジトリルート自体はtrueを返す', () => {
        expect(isUnderRepo(TEST_REPO_ROOT, TEST_REPO_ROOT)).toBe(true);
      });

      it('リポジトリ配下の絶対パスはtrueを返す', () => {
        const absolutePath = path.join(TEST_REPO_ROOT, 'src', 'test.ts');
        expect(isUnderRepo(absolutePath, TEST_REPO_ROOT)).toBe(true);
      });
    });

    describe('異常系: ../による脱出', () => {
      it('../はfalseを返す', () => {
        expect(isUnderRepo('..', TEST_REPO_ROOT)).toBe(false);
      });

      it('../..はfalseを返す', () => {
        expect(isUnderRepo('../..', TEST_REPO_ROOT)).toBe(false);
      });

      it('../other/pathはfalseを返す', () => {
        expect(isUnderRepo('../other/path', TEST_REPO_ROOT)).toBe(false);
      });

      it('src/../../otherはfalseを返す', () => {
        expect(isUnderRepo('src/../../other', TEST_REPO_ROOT)).toBe(false);
      });

      it('深いネストからの脱出はfalseを返す', () => {
        expect(isUnderRepo('a/b/c/../../../../outside', TEST_REPO_ROOT)).toBe(false);
      });
    });

    describe('異常系: 絶対パス', () => {
      it('リポジトリ外の絶対パスはfalseを返す', () => {
        const outsidePath = process.platform === 'win32' 
          ? 'D:\\other\\path' 
          : '/other/path';
        expect(isUnderRepo(outsidePath, TEST_REPO_ROOT)).toBe(false);
      });

      it('ルートパスはfalseを返す', () => {
        const rootPath = process.platform === 'win32' ? 'C:\\' : '/';
        expect(isUnderRepo(rootPath, TEST_REPO_ROOT)).toBe(false);
      });
    });

    describe('エッジケース', () => {
      it('空文字列はfalseを返す', () => {
        expect(isUnderRepo('', TEST_REPO_ROOT)).toBe(false);
      });

      it('repoRootが空の場合はfalseを返す', () => {
        expect(isUnderRepo('test', '')).toBe(false);
      });
    });
  });

  describe('normalizePath()', () => {
    describe('正常系: リポジトリ配下のパス', () => {
      it('単純な相対パスを正規化する', () => {
        const result = normalizePath('test', TEST_REPO_ROOT);
        expect(result.valid).toBe(true);
        expect(result.normalizedPath).toBe('test');
      });

      it('ネストした相対パスを正規化する', () => {
        const result = normalizePath('src/utils/test.ts', TEST_REPO_ROOT);
        expect(result.valid).toBe(true);
        expect(result.normalizedPath).toBe(path.join('src', 'utils', 'test.ts'));
      });

      it('./を含むパスを正規化する', () => {
        const result = normalizePath('./src/test.ts', TEST_REPO_ROOT);
        expect(result.valid).toBe(true);
        expect(result.normalizedPath).toBe(path.join('src', 'test.ts'));
      });

      it('冗長な./を除去する', () => {
        const result = normalizePath('./././test', TEST_REPO_ROOT);
        expect(result.valid).toBe(true);
        expect(result.normalizedPath).toBe('test');
      });

      it('リポジトリ内での../を解決する', () => {
        const result = normalizePath('src/../test', TEST_REPO_ROOT);
        expect(result.valid).toBe(true);
        expect(result.normalizedPath).toBe('test');
      });
    });

    describe('異常系: ../による脱出', () => {
      it('../はエラーを返す', () => {
        const result = normalizePath('..', TEST_REPO_ROOT);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });

      it('../..はエラーを返す', () => {
        const result = normalizePath('../..', TEST_REPO_ROOT);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      });

      it('深いネストからの脱出はエラーを返す', () => {
        const result = normalizePath('a/b/c/../../../../outside', TEST_REPO_ROOT);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('リポジトリ外');
      });
    });

    describe('異常系: 絶対パス', () => {
      it('絶対パスはエラーを返す', () => {
        const absolutePath = process.platform === 'win32' 
          ? 'C:\\test' 
          : '/test';
        const result = normalizePath(absolutePath, TEST_REPO_ROOT);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('絶対パス');
      });
    });

    describe('エッジケース', () => {
      it('空文字列はエラーを返す', () => {
        const result = normalizePath('', TEST_REPO_ROOT);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('空');
      });

      it('repoRootが空の場合はエラーを返す', () => {
        const result = normalizePath('test', '');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('リポジトリルート');
      });
    });
  });

  describe('PathValidatorクラス', () => {
    it('コンストラクタでリポジトリルートを設定する', () => {
      const validator = new PathValidator(TEST_REPO_ROOT);
      expect(validator.getRepoRoot()).toBe(path.resolve(TEST_REPO_ROOT));
    });

    it('isUnderRepo()が正しく動作する', () => {
      const validator = new PathValidator(TEST_REPO_ROOT);
      expect(validator.isUnderRepo('test')).toBe(true);
      expect(validator.isUnderRepo('..')).toBe(false);
    });

    it('normalizePath()が正しく動作する', () => {
      const validator = new PathValidator(TEST_REPO_ROOT);
      
      const validResult = validator.normalizePath('src/test.ts');
      expect(validResult.valid).toBe(true);
      
      const invalidResult = validator.normalizePath('..');
      expect(invalidResult.valid).toBe(false);
    });
  });
});
