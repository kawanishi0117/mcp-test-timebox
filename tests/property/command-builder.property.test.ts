/**
 * コマンドビルダー プロパティベーステスト
 * 
 * Feature: mcp-test-timebox
 * 
 * Property 1: コマンド構築の安全性
 * 
 * *For any* 有効な入力パラメータ（runner, scope, target）に対して、
 * 生成されるコマンドは各ランナーの固定テンプレートに一致する。
 * 
 * 対応ランナー:
 * - flutter: flutter test
 * - vitest: npx vitest run
 * - pytest: pytest
 * - jest: npx jest
 * 
 * Validates: Requirements 2.1, 2.3, 2.4, 2.5
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  buildCommand,
  formatCommand,
  isAllowedCommandPattern,
} from '../../src/validation/command-builder.js';
import {
  ALLOWED_RUNNERS,
  type Runner,
} from '../../src/validation/input-schema.js';

/**
 * 安全なtarget文字列を生成するArbitrary
 * シェルメタ文字を含まない文字列
 */
const safeTarget = fc.stringMatching(/^[a-zA-Z0-9_\-./]+$/)
  .filter((s) => s.length > 0 && !s.startsWith('-'));

/**
 * 各ランナーの期待されるコマンドパターン
 */
const EXPECTED_COMMANDS: Record<Runner, {
  all: string;
  file: (target: string) => string;
  pattern: (target: string) => string;
}> = {
  flutter: {
    all: 'flutter test',
    file: (t) => `flutter test ${t}`,
    pattern: (t) => `flutter test --name ${t}`,
  },
  vitest: {
    all: 'npx vitest run',
    file: (t) => `npx vitest run ${t}`,
    pattern: (t) => `npx vitest run -t ${t}`,
  },
  pytest: {
    all: 'pytest',
    file: (t) => `pytest ${t}`,
    pattern: (t) => `pytest -k ${t}`,
  },
  jest: {
    all: 'npx jest',
    file: (t) => `npx jest ${t}`,
    pattern: (t) => `npx jest -t ${t}`,
  },
};

describe('コマンドビルダー プロパティテスト', () => {
  /**
   * Property 1: コマンド構築の安全性
   */
  describe('Property 1: コマンド構築の安全性', () => {
    /**
     * Property 1.1: scope=allの場合、各ランナーの基本コマンドを生成
     */
    it('scope=allの場合、各ランナーの基本コマンドを生成する', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...ALLOWED_RUNNERS),
          (runner) => {
            const result = buildCommand(runner, 'all');
            const commandStr = formatCommand(result);
            return commandStr === EXPECTED_COMMANDS[runner].all;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 1.2: scope=fileの場合、各ランナーのファイル指定コマンドを生成
     */
    it('scope=fileの場合、各ランナーのファイル指定コマンドを生成する', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...ALLOWED_RUNNERS),
          safeTarget,
          (runner, target) => {
            const result = buildCommand(runner, 'file', target);
            const commandStr = formatCommand(result);
            return commandStr === EXPECTED_COMMANDS[runner].file(target);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 1.3: scope=patternの場合、各ランナーのパターン指定コマンドを生成
     */
    it('scope=patternの場合、各ランナーのパターン指定コマンドを生成する', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...ALLOWED_RUNNERS),
          safeTarget,
          (runner, target) => {
            const result = buildCommand(runner, 'pattern', target);
            const commandStr = formatCommand(result);
            return commandStr === EXPECTED_COMMANDS[runner].pattern(target);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 1.4: isAllowedCommandPattern()は生成されたコマンドに対してtrueを返す
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
            return isAllowedCommandPattern(result.command, result.args);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 1.5: コマンドは許可されたコマンドのいずれか
     */
    it('コマンドは許可されたコマンドのいずれか', () => {
      const allowedCommands = ['flutter', 'npx', 'pytest'];
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
            return allowedCommands.includes(result.command);
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
          fc.constantFrom(...ALLOWED_RUNNERS),
          fc.constantFrom(...dangerousChars),
          fc.string({ minLength: 1, maxLength: 10 }),
          (runner, dangerousChar, suffix) => {
            const dangerousTarget = `test${dangerousChar}${suffix}`;
            
            try {
              buildCommand(runner, 'file', dangerousTarget);
              return false;
            } catch {
              return true;
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
        fc.property(
          fc.constantFrom(...ALLOWED_RUNNERS),
          dashStartTarget,
          (runner, target) => {
            try {
              buildCommand(runner, 'file', target);
              return false;
            } catch {
              return true;
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * 空のtargetは拒否される
     */
    it('空のtargetは拒否される', () => {
      const emptyTargets = ['', '   ', '\t', '\n'];
      
      for (const runner of ALLOWED_RUNNERS) {
        for (const target of emptyTargets) {
          expect(() => buildCommand(runner, 'file', target)).toThrow();
        }
      }
    });

    /**
     * scope=file/patternでtarget未指定は拒否される
     */
    it('scope=file/patternでtarget未指定は拒否される', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...ALLOWED_RUNNERS),
          fc.constantFrom('file', 'pattern') as fc.Arbitrary<'file' | 'pattern'>,
          (runner, scope) => {
            try {
              buildCommand(runner, scope, undefined);
              return false;
            } catch {
              return true;
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
        { command: 'node', args: ['malicious.js'] },
      ];

      for (const { command, args } of invalidCommands) {
        expect(isAllowedCommandPattern(command, args)).toBe(false);
      }
    });

    it('許可されたコマンドはtrueを返す', () => {
      const validCommands = [
        // flutter
        { command: 'flutter', args: ['test'] },
        { command: 'flutter', args: ['test', 'test/widget_test.dart'] },
        { command: 'flutter', args: ['test', '--name', 'my_test'] },
        // vitest
        { command: 'npx', args: ['vitest', 'run'] },
        { command: 'npx', args: ['vitest', 'run', 'test/unit.test.ts'] },
        // pytest
        { command: 'pytest', args: [] },
        { command: 'pytest', args: ['test_file.py'] },
        // jest
        { command: 'npx', args: ['jest'] },
        { command: 'npx', args: ['jest', 'test/unit.test.js'] },
      ];

      for (const { command, args } of validCommands) {
        expect(isAllowedCommandPattern(command, args)).toBe(true);
      }
    });
  });
});
