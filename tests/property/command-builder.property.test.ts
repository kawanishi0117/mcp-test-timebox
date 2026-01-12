/**
 * コマンドビルダー プロパティベーステスト
 * 
 * Feature: mcp-test-timebox
 * 
 * Property 1: コマンド構築の安全性
 * 
 * *For any* 有効な入力パラメータ（runner, scope, target）に対して、
 * 生成されるコマンドは固定テンプレート（`flutter test` または 
 * `flutter test <target>` または `flutter test --name <target>`）のいずれかに一致する。
 * 
 * Validates: Requirements 2.1, 2.3, 2.4, 2.5
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  buildCommand,
  formatCommand,
  isAllowedCommandPattern,
  type CommandResult,
} from '../../src/validation/command-builder.js';
import {
  ALLOWED_RUNNERS,
  ALLOWED_SCOPES,
  type Runner,
  type Scope,
} from '../../src/validation/input-schema.js';

/**
 * 安全なtarget文字列を生成するArbitrary
 * シェルメタ文字を含まない文字列
 */
const safeTarget = fc.stringMatching(/^[a-zA-Z0-9_\-./]+$/)
  .filter((s) => s.length > 0 && !s.startsWith('-'));

/**
 * 許可されたコマンドパターン
 */
const ALLOWED_PATTERNS = [
  'flutter test',
  /^flutter test [a-zA-Z0-9_\-./]+$/,
  /^flutter test --name [a-zA-Z0-9_\-./]+$/,
];

/**
 * コマンドが許可されたパターンに一致するかチェック
 */
function matchesAllowedPattern(commandStr: string): boolean {
  return ALLOWED_PATTERNS.some((pattern) => {
    if (typeof pattern === 'string') {
      return commandStr === pattern;
    }
    return pattern.test(commandStr);
  });
}

describe('コマンドビルダー プロパティテスト', () => {
  /**
   * Property 1: コマンド構築の安全性
   * 
   * *For any* 有効な入力パラメータ（runner, scope, target）に対して、
   * 生成されるコマンドは固定テンプレートのいずれかに一致する。
   * 
   * Validates: Requirements 2.1, 2.3, 2.4, 2.5
   */
  describe('Property 1: コマンド構築の安全性', () => {
    /**
     * Property 1.1: scope=allの場合、flutter testを生成
     * 
     * Requirements 2.3: scope が all の場合、flutter test を実行
     */
    it('scope=allの場合、flutter testを生成する', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...ALLOWED_RUNNERS),
          (runner) => {
            const result = buildCommand(runner, 'all');
            const commandStr = formatCommand(result);
            
            // flutter test のみ
            return commandStr === 'flutter test';
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 1.2: scope=fileの場合、flutter test <target>を生成
     * 
     * Requirements 2.4: scope が file の場合、flutter test <target> を実行
     */
    it('scope=fileの場合、flutter test <target>を生成する', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...ALLOWED_RUNNERS),
          safeTarget,
          (runner, target) => {
            const result = buildCommand(runner, 'file', target);
            const commandStr = formatCommand(result);
            
            // flutter test <target> の形式
            return commandStr === `flutter test ${target}`;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 1.3: scope=patternの場合、flutter test --name <target>を生成
     * 
     * Requirements 2.5: scope が pattern の場合、flutter test --name <target> を実行
     */
    it('scope=patternの場合、flutter test --name <target>を生成する', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...ALLOWED_RUNNERS),
          safeTarget,
          (runner, target) => {
            const result = buildCommand(runner, 'pattern', target);
            const commandStr = formatCommand(result);
            
            // flutter test --name <target> の形式
            return commandStr === `flutter test --name ${target}`;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 1.4: 生成されるコマンドは常に許可されたパターンに一致
     * 
     * Requirements 2.1: 固定テンプレートのみを実行
     */
    it('生成されるコマンドは常に許可されたパターンに一致する', () => {
      // scope=all, file, patternの各ケースをテスト
      const scopeWithTarget = fc.oneof(
        fc.record({
          scope: fc.constant('all' as const),
          target: fc.constant(undefined),
        }),
        fc.record({
          scope: fc.constant('file' as const),
          target: safeTarget,
        }),
        fc.record({
          scope: fc.constant('pattern' as const),
          target: safeTarget,
        })
      );

      fc.assert(
        fc.property(
          fc.constantFrom(...ALLOWED_RUNNERS),
          scopeWithTarget,
          (runner, { scope, target }) => {
            const result = buildCommand(runner, scope, target);
            const commandStr = formatCommand(result);
            
            // 許可されたパターンに一致
            return matchesAllowedPattern(commandStr);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 1.5: isAllowedCommandPattern()は生成されたコマンドに対してtrueを返す
     */
    it('isAllowedCommandPattern()は生成されたコマンドに対してtrueを返す', () => {
      const scopeWithTarget = fc.oneof(
        fc.record({
          scope: fc.constant('all' as const),
          target: fc.constant(undefined),
        }),
        fc.record({
          scope: fc.constant('file' as const),
          target: safeTarget,
        }),
        fc.record({
          scope: fc.constant('pattern' as const),
          target: safeTarget,
        })
      );

      fc.assert(
        fc.property(
          fc.constantFrom(...ALLOWED_RUNNERS),
          scopeWithTarget,
          (runner, { scope, target }) => {
            const result = buildCommand(runner, scope, target);
            
            // isAllowedCommandPattern()がtrueを返す
            return isAllowedCommandPattern(result.command, result.args);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 1.6: コマンドは常に'flutter'
     */
    it('コマンドは常にflutter', () => {
      const scopeWithTarget = fc.oneof(
        fc.record({
          scope: fc.constant('all' as const),
          target: fc.constant(undefined),
        }),
        fc.record({
          scope: fc.constant('file' as const),
          target: safeTarget,
        }),
        fc.record({
          scope: fc.constant('pattern' as const),
          target: safeTarget,
        })
      );

      fc.assert(
        fc.property(
          fc.constantFrom(...ALLOWED_RUNNERS),
          scopeWithTarget,
          (runner, { scope, target }) => {
            const result = buildCommand(runner, scope, target);
            
            // コマンドは常にflutter
            return result.command === 'flutter';
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 1.7: 引数の最初は常に'test'
     */
    it('引数の最初は常にtest', () => {
      const scopeWithTarget = fc.oneof(
        fc.record({
          scope: fc.constant('all' as const),
          target: fc.constant(undefined),
        }),
        fc.record({
          scope: fc.constant('file' as const),
          target: safeTarget,
        }),
        fc.record({
          scope: fc.constant('pattern' as const),
          target: safeTarget,
        })
      );

      fc.assert(
        fc.property(
          fc.constantFrom(...ALLOWED_RUNNERS),
          scopeWithTarget,
          (runner, { scope, target }) => {
            const result = buildCommand(runner, scope, target);
            
            // 引数の最初は常にtest
            return result.args.length > 0 && result.args[0] === 'test';
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * 危険な入力の拒否テスト
   */
  describe('危険な入力の拒否', () => {
    /**
     * シェルメタ文字を含むtargetは拒否される
     */
    it('シェルメタ文字を含むtargetは拒否される', () => {
      const dangerousChars = [';', '&', '|', '`', '$', '(', ')', '{', '}', '[', ']', '<', '>'];
      
      fc.assert(
        fc.property(
          fc.constantFrom(...dangerousChars),
          fc.string({ minLength: 1, maxLength: 10 }),
          (dangerousChar, suffix) => {
            const dangerousTarget = `test${dangerousChar}${suffix}`;
            
            try {
              buildCommand('flutter', 'file', dangerousTarget);
              return false; // エラーが発生しなかった場合は失敗
            } catch (e) {
              return true; // エラーが発生した場合は成功
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * ハイフンで始まるtargetは拒否される（オプション注入防止）
     */
    it('ハイフンで始まるtargetは拒否される', () => {
      const dashStartTarget = fc.string({ minLength: 1 })
        .map((s) => `-${s}`);

      fc.assert(
        fc.property(dashStartTarget, (target) => {
          try {
            buildCommand('flutter', 'file', target);
            return false; // エラーが発生しなかった場合は失敗
          } catch (e) {
            return true; // エラーが発生した場合は成功
          }
        }),
        { numRuns: 100 }
      );
    });

    /**
     * 空のtargetは拒否される
     */
    it('空のtargetは拒否される', () => {
      const emptyTargets = ['', '   ', '\t', '\n'];
      
      for (const target of emptyTargets) {
        expect(() => buildCommand('flutter', 'file', target)).toThrow();
      }
    });

    /**
     * scope=file/patternでtarget未指定は拒否される
     */
    it('scope=file/patternでtarget未指定は拒否される', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('file', 'pattern') as fc.Arbitrary<'file' | 'pattern'>,
          (scope) => {
            try {
              buildCommand('flutter', scope, undefined);
              return false; // エラーが発生しなかった場合は失敗
            } catch (e) {
              return true; // エラーが発生した場合は成功
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * isAllowedCommandPattern()のテスト
   */
  describe('isAllowedCommandPattern()の検証', () => {
    it('許可されていないコマンドはfalseを返す', () => {
      const invalidCommands = [
        { command: 'rm', args: ['-rf', '/'] },
        { command: 'bash', args: ['-c', 'echo hello'] },
        { command: 'flutter', args: ['run'] },
        { command: 'flutter', args: ['build'] },
        { command: 'flutter', args: [] },
        { command: 'flutter', args: ['test', '--name', 'foo', '--extra'] },
      ];

      for (const { command, args } of invalidCommands) {
        expect(isAllowedCommandPattern(command, args)).toBe(false);
      }
    });

    it('許可されたコマンドはtrueを返す', () => {
      const validCommands = [
        { command: 'flutter', args: ['test'] },
        { command: 'flutter', args: ['test', 'test/widget_test.dart'] },
        { command: 'flutter', args: ['test', '--name', 'my_test'] },
      ];

      for (const { command, args } of validCommands) {
        expect(isAllowedCommandPattern(command, args)).toBe(true);
      }
    });
  });
});
