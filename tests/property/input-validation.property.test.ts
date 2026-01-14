/**
 * 入力バリデーション プロパティベーステスト
 * 
 * Feature: mcp-test-timebox
 * 
 * Property 2: 許可されていないランナーの拒否
 * Property 12: 必須パラメータのバリデーション
 * Property 13: 条件付き必須パラメータのバリデーション
 * 
 * Validates: Requirements 2.2, 7.1-7.6
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  validateRunTestInput,
  isAllowedRunner,
  isAllowedScope,
  ALLOWED_RUNNERS,
  ALLOWED_SCOPES,
  type RunTestInput,
} from '../../src/validation/input-schema.js';

/**
 * 有効な入力を生成するArbitrary
 */
const validRunTestInput = (): fc.Arbitrary<RunTestInput> => {
  return fc.record({
    runner: fc.constantFrom(...ALLOWED_RUNNERS),
    scope: fc.constantFrom(...ALLOWED_SCOPES),
    target: fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
    timeout_ms: fc.integer({ min: 1, max: 3600000 }),
    no_output_timeout_ms: fc.integer({ min: 1, max: 3600000 }),
    max_output_bytes: fc.integer({ min: 1, max: 10000000 }),
    report_dir: fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
    cwd: fc.string({ minLength: 1 }), // 必須パラメータ
  }).filter((input) => {
    // scope が file/pattern の場合は target が必須
    if ((input.scope === 'file' || input.scope === 'pattern') && !input.target) {
      return false;
    }
    return true;
  }) as fc.Arbitrary<RunTestInput>;
};

/**
 * 正の整数を生成するArbitrary
 */
const positiveInt = fc.integer({ min: 1, max: 10000000 });

/**
 * 非正の整数を生成するArbitrary（0以下）
 */
const nonPositiveInt = fc.integer({ min: -10000000, max: 0 });

describe('入力バリデーション プロパティテスト', () => {
  /**
   * Property 2: 許可されていないランナーの拒否
   * 
   * *For any* 許可されていない文字列が `runner` として渡されたとき、
   * Run_Test_Tool はエラーを返す。
   * 
   * Validates: Requirements 2.2, 7.1
   */
  describe('Property 2: 許可されていないランナーの拒否', () => {
    it('許可されていないランナーはエラーを返す', () => {
      // 許可されていない文字列を生成
      const invalidRunner = fc.string({ minLength: 1 })
        .filter((s) => !ALLOWED_RUNNERS.includes(s as typeof ALLOWED_RUNNERS[number]));

      fc.assert(
        fc.property(
          invalidRunner,
          positiveInt,
          positiveInt,
          positiveInt,
          fc.string({ minLength: 1 }),
          (runner, timeout_ms, no_output_timeout_ms, max_output_bytes, cwd) => {
            const input = {
              runner,
              scope: 'all',
              timeout_ms,
              no_output_timeout_ms,
              max_output_bytes,
              cwd,
            };

            const result = validateRunTestInput(input);
            return result.success === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('isAllowedRunner()は許可されていないランナーでfalseを返す', () => {
      const invalidRunner = fc.string({ minLength: 1 })
        .filter((s) => !ALLOWED_RUNNERS.includes(s as typeof ALLOWED_RUNNERS[number]));

      fc.assert(
        fc.property(invalidRunner, (runner) => {
          return isAllowedRunner(runner) === false;
        }),
        { numRuns: 100 }
      );
    });

    it('isAllowedRunner()は許可されたランナーでtrueを返す', () => {
      fc.assert(
        fc.property(fc.constantFrom(...ALLOWED_RUNNERS), (runner) => {
          return isAllowedRunner(runner) === true;
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 12: 必須パラメータのバリデーション
   * 
   * *For any* 入力に対して、以下のいずれかが欠落または不正な場合、
   * Run_Test_Tool はエラーを返す：
   * - runner が未指定または許可されていない値
   * - scope が未指定または許可されていない値（all/file/pattern以外）
   * - timeout_ms が未指定または正の整数でない
   * - no_output_timeout_ms が未指定または正の整数でない
   * - max_output_bytes が未指定または正の整数でない
   * 
   * Validates: Requirements 7.1, 7.2, 7.4, 7.5, 7.6
   */
  describe('Property 12: 必須パラメータのバリデーション', () => {
    it('runnerが未指定の場合エラーを返す', () => {
      fc.assert(
        fc.property(
          positiveInt,
          positiveInt,
          positiveInt,
          fc.string({ minLength: 1 }),
          (timeout_ms, no_output_timeout_ms, max_output_bytes, cwd) => {
            const input = {
              // runner未指定
              scope: 'all',
              timeout_ms,
              no_output_timeout_ms,
              max_output_bytes,
              cwd,
            };

            const result = validateRunTestInput(input);
            return result.success === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('scopeが未指定の場合エラーを返す', () => {
      fc.assert(
        fc.property(
          positiveInt,
          positiveInt,
          positiveInt,
          fc.string({ minLength: 1 }),
          (timeout_ms, no_output_timeout_ms, max_output_bytes, cwd) => {
            const input = {
              runner: 'flutter',
              // scope未指定
              timeout_ms,
              no_output_timeout_ms,
              max_output_bytes,
              cwd,
            };

            const result = validateRunTestInput(input);
            return result.success === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('scopeが許可されていない値の場合エラーを返す', () => {
      const invalidScope = fc.string({ minLength: 1 })
        .filter((s) => !ALLOWED_SCOPES.includes(s as typeof ALLOWED_SCOPES[number]));

      fc.assert(
        fc.property(
          invalidScope,
          positiveInt,
          positiveInt,
          positiveInt,
          fc.string({ minLength: 1 }),
          (scope, timeout_ms, no_output_timeout_ms, max_output_bytes, cwd) => {
            const input = {
              runner: 'flutter',
              scope,
              timeout_ms,
              no_output_timeout_ms,
              max_output_bytes,
              cwd,
            };

            const result = validateRunTestInput(input);
            return result.success === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('timeout_msが未指定の場合エラーを返す', () => {
      fc.assert(
        fc.property(
          positiveInt,
          positiveInt,
          fc.string({ minLength: 1 }),
          (no_output_timeout_ms, max_output_bytes, cwd) => {
            const input = {
              runner: 'flutter',
              scope: 'all',
              // timeout_ms未指定
              no_output_timeout_ms,
              max_output_bytes,
              cwd,
            };

            const result = validateRunTestInput(input);
            return result.success === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('timeout_msが正の整数でない場合エラーを返す', () => {
      fc.assert(
        fc.property(
          nonPositiveInt,
          positiveInt,
          positiveInt,
          fc.string({ minLength: 1 }),
          (timeout_ms, no_output_timeout_ms, max_output_bytes, cwd) => {
            const input = {
              runner: 'flutter',
              scope: 'all',
              timeout_ms,
              no_output_timeout_ms,
              max_output_bytes,
              cwd,
            };

            const result = validateRunTestInput(input);
            return result.success === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('no_output_timeout_msが未指定の場合エラーを返す', () => {
      fc.assert(
        fc.property(
          positiveInt,
          positiveInt,
          fc.string({ minLength: 1 }),
          (timeout_ms, max_output_bytes, cwd) => {
            const input = {
              runner: 'flutter',
              scope: 'all',
              timeout_ms,
              // no_output_timeout_ms未指定
              max_output_bytes,
              cwd,
            };

            const result = validateRunTestInput(input);
            return result.success === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('no_output_timeout_msが正の整数でない場合エラーを返す', () => {
      fc.assert(
        fc.property(
          positiveInt,
          nonPositiveInt,
          positiveInt,
          fc.string({ minLength: 1 }),
          (timeout_ms, no_output_timeout_ms, max_output_bytes, cwd) => {
            const input = {
              runner: 'flutter',
              scope: 'all',
              timeout_ms,
              no_output_timeout_ms,
              max_output_bytes,
              cwd,
            };

            const result = validateRunTestInput(input);
            return result.success === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('max_output_bytesが未指定の場合エラーを返す', () => {
      fc.assert(
        fc.property(
          positiveInt,
          positiveInt,
          fc.string({ minLength: 1 }),
          (timeout_ms, no_output_timeout_ms, cwd) => {
            const input = {
              runner: 'flutter',
              scope: 'all',
              timeout_ms,
              no_output_timeout_ms,
              // max_output_bytes未指定
              cwd,
            };

            const result = validateRunTestInput(input);
            return result.success === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('max_output_bytesが正の整数でない場合エラーを返す', () => {
      fc.assert(
        fc.property(
          positiveInt,
          positiveInt,
          nonPositiveInt,
          fc.string({ minLength: 1 }),
          (timeout_ms, no_output_timeout_ms, max_output_bytes, cwd) => {
            const input = {
              runner: 'flutter',
              scope: 'all',
              timeout_ms,
              no_output_timeout_ms,
              max_output_bytes,
              cwd,
            };

            const result = validateRunTestInput(input);
            return result.success === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('有効な入力はバリデーションを通過する', () => {
      fc.assert(
        fc.property(validRunTestInput(), (input) => {
          const result = validateRunTestInput(input);
          return result.success === true;
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 13: 条件付き必須パラメータのバリデーション
   * 
   * *For any* scope が `file` または `pattern` の入力に対して、
   * target が未指定の場合、Run_Test_Tool はエラーを返す。
   * 
   * Validates: Requirements 7.3
   */
  describe('Property 13: 条件付き必須パラメータのバリデーション', () => {
    it('scope=fileでtarget未指定の場合エラーを返す', () => {
      fc.assert(
        fc.property(
          positiveInt,
          positiveInt,
          positiveInt,
          fc.string({ minLength: 1 }),
          (timeout_ms, no_output_timeout_ms, max_output_bytes, cwd) => {
            const input = {
              runner: 'flutter',
              scope: 'file',
              // target未指定
              timeout_ms,
              no_output_timeout_ms,
              max_output_bytes,
              cwd,
            };

            const result = validateRunTestInput(input);
            return result.success === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('scope=patternでtarget未指定の場合エラーを返す', () => {
      fc.assert(
        fc.property(
          positiveInt,
          positiveInt,
          positiveInt,
          fc.string({ minLength: 1 }),
          (timeout_ms, no_output_timeout_ms, max_output_bytes, cwd) => {
            const input = {
              runner: 'flutter',
              scope: 'pattern',
              // target未指定
              timeout_ms,
              no_output_timeout_ms,
              max_output_bytes,
              cwd,
            };

            const result = validateRunTestInput(input);
            return result.success === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('scope=allでtarget未指定でもバリデーションを通過する', () => {
      fc.assert(
        fc.property(
          positiveInt,
          positiveInt,
          positiveInt,
          fc.string({ minLength: 1 }),
          (timeout_ms, no_output_timeout_ms, max_output_bytes, cwd) => {
            const input = {
              runner: 'flutter',
              scope: 'all',
              // target未指定でもOK
              timeout_ms,
              no_output_timeout_ms,
              max_output_bytes,
              cwd,
            };

            const result = validateRunTestInput(input);
            return result.success === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('scope=file/patternでtarget指定ありならバリデーションを通過する', () => {
      const scopeWithTarget = fc.constantFrom('file', 'pattern') as fc.Arbitrary<'file' | 'pattern'>;
      const nonEmptyString = fc.string({ minLength: 1 });

      fc.assert(
        fc.property(
          scopeWithTarget,
          nonEmptyString,
          positiveInt,
          positiveInt,
          positiveInt,
          nonEmptyString,
          (scope, target, timeout_ms, no_output_timeout_ms, max_output_bytes, cwd) => {
            const input = {
              runner: 'flutter',
              scope,
              target,
              timeout_ms,
              no_output_timeout_ms,
              max_output_bytes,
              cwd,
            };

            const result = validateRunTestInput(input);
            return result.success === true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
