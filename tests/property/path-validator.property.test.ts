/**
 * PathValidator プロパティベーステスト
 * 
 * Feature: mcp-test-timebox, Property 3: パス検証の安全性
 * Validates: Requirements 2.6, 4.6, 4.7
 * 
 * Property 3: パス検証の安全性
 * *For any* パス文字列に対して、PathValidator.isUnderRepo() は以下を満たす：
 * - リポジトリ配下の正規化されたパスに対して true を返す
 * - `../` や絶対パスなどでリポジトリ外を指すパスに対して false を返す
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import * as path from 'node:path';
import { isUnderRepo, normalizePath, PathValidator } from '../../src/utils/path-validator.js';

// テスト用のリポジトリルート（プラットフォーム非依存）
const TEST_REPO_ROOT = process.platform === 'win32' 
  ? 'C:\\repo' 
  : '/repo';

describe('PathValidator プロパティテスト', () => {
  describe('Property 3: パス検証の安全性', () => {
    /**
     * Property 3.1: リポジトリ配下の相対パスは常にtrueを返す
     * 
     * 任意の安全な相対パス（..を含まない）に対して、
     * isUnderRepo()はtrueを返す
     */
    it('リポジトリ配下の相対パスは常にtrueを返す', () => {
      // 安全なパスセグメント（..を含まない、空でない）
      const safeSegment = fc.stringMatching(/^[a-zA-Z0-9_-]+$/);
      
      // 安全な相対パス生成器
      const safeRelativePath = fc.array(safeSegment, { minLength: 1, maxLength: 5 })
        .map(segments => segments.join(path.sep));

      fc.assert(
        fc.property(safeRelativePath, (relativePath) => {
          const result = isUnderRepo(relativePath, TEST_REPO_ROOT);
          return result === true;
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property 3.2: ../を含むパスでリポジトリ外を指す場合はfalseを返す
     * 
     * 任意の「..」で始まるパスに対して、
     * isUnderRepo()はfalseを返す
     */
    it('../で始まるパスはfalseを返す', () => {
      // 「..」で始まるパス生成器
      const escapingPath = fc.array(fc.constantFrom('..', 'subdir'), { minLength: 1, maxLength: 5 })
        .filter(segments => segments[0] === '..')
        .map(segments => segments.join(path.sep));

      fc.assert(
        fc.property(escapingPath, (escapePath) => {
          const result = isUnderRepo(escapePath, TEST_REPO_ROOT);
          return result === false;
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property 3.3: 絶対パスでリポジトリ外を指す場合はfalseを返す
     * 
     * リポジトリ外の絶対パスに対して、isUnderRepo()はfalseを返す
     */
    it('リポジトリ外の絶対パスはfalseを返す', () => {
      // リポジトリ外の絶対パス生成器
      const outsideAbsolutePath = process.platform === 'win32'
        ? fc.constantFrom('D:\\other', 'C:\\other\\path', 'D:\\')
        : fc.constantFrom('/other', '/tmp/test', '/var/log');

      fc.assert(
        fc.property(outsideAbsolutePath, (absolutePath) => {
          const result = isUnderRepo(absolutePath, TEST_REPO_ROOT);
          return result === false;
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property 3.4: normalizePath()は絶対パスを拒否する
     * 
     * 任意の絶対パスに対して、normalizePath()はvalid: falseを返す
     */
    it('normalizePath()は絶対パスを拒否する', () => {
      // 絶対パス生成器
      const absolutePath = process.platform === 'win32'
        ? fc.constantFrom('C:\\test', 'D:\\path\\to\\file', 'C:\\')
        : fc.constantFrom('/test', '/path/to/file', '/');

      fc.assert(
        fc.property(absolutePath, (absPath) => {
          const result = normalizePath(absPath, TEST_REPO_ROOT);
          return result.valid === false && result.error !== undefined;
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property 3.5: normalizePath()は../による脱出を拒否する
     * 
     * リポジトリ外を指す相対パスに対して、normalizePath()はvalid: falseを返す
     */
    it('normalizePath()は../による脱出を拒否する', () => {
      // 脱出パス生成器（十分な数の..を含む）
      const escapingRelativePath = fc.integer({ min: 2, max: 10 })
        .map(count => Array(count).fill('..').join(path.sep));

      fc.assert(
        fc.property(escapingRelativePath, (escapePath) => {
          const result = normalizePath(escapePath, TEST_REPO_ROOT);
          return result.valid === false && result.error !== undefined;
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property 3.6: 正規化されたパスは常にリポジトリ配下
     * 
     * normalizePath()がvalid: trueを返す場合、
     * そのnormalizedPathはisUnderRepo()でもtrueを返す
     */
    it('正規化成功したパスは常にリポジトリ配下', () => {
      // 安全なパスセグメント
      const safeSegment = fc.stringMatching(/^[a-zA-Z0-9_-]+$/);
      
      // 安全な相対パス
      const safeRelativePath = fc.array(safeSegment, { minLength: 1, maxLength: 5 })
        .map(segments => segments.join(path.sep));

      fc.assert(
        fc.property(safeRelativePath, (relativePath) => {
          const result = normalizePath(relativePath, TEST_REPO_ROOT);
          if (result.valid && result.normalizedPath) {
            // 正規化成功した場合、そのパスはリポジトリ配下
            return isUnderRepo(result.normalizedPath, TEST_REPO_ROOT);
          }
          return true; // 正規化失敗は別のプロパティでテスト
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property 3.7: PathValidatorクラスは関数と同じ結果を返す
     * 
     * PathValidatorクラスのメソッドは、対応する関数と同じ結果を返す
     */
    it('PathValidatorクラスは関数と同じ結果を返す', () => {
      const safeSegment = fc.stringMatching(/^[a-zA-Z0-9_-]+$/);
      const testPath = fc.array(safeSegment, { minLength: 1, maxLength: 3 })
        .map(segments => segments.join(path.sep));

      fc.assert(
        fc.property(testPath, (targetPath) => {
          const validator = new PathValidator(TEST_REPO_ROOT);
          
          // isUnderRepoの結果が一致
          const funcResult = isUnderRepo(targetPath, TEST_REPO_ROOT);
          const classResult = validator.isUnderRepo(targetPath);
          
          if (funcResult !== classResult) {
            return false;
          }

          // normalizePathの結果が一致
          const funcNormalize = normalizePath(targetPath, TEST_REPO_ROOT);
          const classNormalize = validator.normalizePath(targetPath);
          
          return funcNormalize.valid === classNormalize.valid &&
                 funcNormalize.normalizedPath === classNormalize.normalizedPath;
        }),
        { numRuns: 100 }
      );
    });
  });
});
