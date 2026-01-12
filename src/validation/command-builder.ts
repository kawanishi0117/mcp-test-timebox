/**
 * コマンドビルダー
 * 
 * 入力パラメータから安全なコマンドと引数を生成する。
 * 固定テンプレートのみを許可し、任意コマンド実行を防ぐ。
 * 
 * Requirements:
 * - 2.1: 固定テンプレート（flutter test）のみを実行
 * - 2.3: scope が all の場合、flutter test を実行
 * - 2.4: scope が file の場合、flutter test <target> を実行
 * - 2.5: scope が pattern の場合、flutter test --name <target> を実行
 */
import type { Runner, Scope } from './input-schema.js';

/**
 * コマンド構築結果
 */
export interface CommandResult {
  /** 実行するコマンド */
  command: string;
  /** コマンド引数 */
  args: string[];
}

/**
 * コマンドテンプレート定義
 * 
 * 各ランナーとスコープの組み合わせに対応するコマンドテンプレート
 */
interface CommandTemplate {
  /** 実行するコマンド */
  command: string;
  /** 基本引数 */
  baseArgs: string[];
  /** target引数の形式（targetが必要な場合） */
  targetArgFormat?: 'positional' | 'named';
  /** named形式の場合のフラグ名 */
  targetFlag?: string;
}

/**
 * 許可されたコマンドテンプレート
 * 
 * runner -> scope -> template のマッピング
 */
const COMMAND_TEMPLATES: Record<Runner, Record<Scope, CommandTemplate>> = {
  flutter: {
    all: {
      command: 'flutter',
      baseArgs: ['test'],
    },
    file: {
      command: 'flutter',
      baseArgs: ['test'],
      targetArgFormat: 'positional',
    },
    pattern: {
      command: 'flutter',
      baseArgs: ['test'],
      targetArgFormat: 'named',
      targetFlag: '--name',
    },
  },
};

/**
 * 入力パラメータからコマンドと引数を構築する
 * 
 * 固定テンプレートのみを使用し、任意コマンド実行を防ぐ。
 * 
 * @param runner - テストランナー
 * @param scope - テスト実行スコープ
 * @param target - テスト対象（scope が file/pattern の場合）
 * @returns コマンド構築結果
 * @throws Error - 不正なパラメータの場合
 */
export function buildCommand(
  runner: Runner,
  scope: Scope,
  target?: string
): CommandResult {
  // テンプレートを取得
  const runnerTemplates = COMMAND_TEMPLATES[runner];
  if (!runnerTemplates) {
    throw new Error(`許可されていないランナー: ${runner}`);
  }

  const template = runnerTemplates[scope];
  if (!template) {
    throw new Error(`許可されていないスコープ: ${scope}`);
  }

  // 引数を構築
  const args = [...template.baseArgs];

  // targetが必要な場合
  if (template.targetArgFormat) {
    if (!target) {
      throw new Error(`scope '${scope}' の場合、target は必須です`);
    }

    // targetの安全性チェック（シェルインジェクション防止）
    validateTarget(target);

    if (template.targetArgFormat === 'positional') {
      // 位置引数として追加
      args.push(target);
    } else if (template.targetArgFormat === 'named' && template.targetFlag) {
      // 名前付き引数として追加
      args.push(template.targetFlag, target);
    }
  }

  return {
    command: template.command,
    args,
  };
}

/**
 * targetの安全性を検証する
 * 
 * シェルインジェクションを防ぐため、危険な文字をチェック
 * 
 * @param target - 検証対象のtarget
 * @throws Error - 危険な文字が含まれる場合
 */
function validateTarget(target: string): void {
  // 空文字列チェック
  if (!target || target.trim() === '') {
    throw new Error('target は空にできません');
  }

  // 危険な文字のパターン
  // シェルメタ文字やコマンド区切り文字を禁止
  const dangerousPatterns = [
    /[;&|`$(){}[\]<>]/,  // シェルメタ文字
    /\n|\r/,              // 改行文字
    /^\s*-/,              // 先頭のハイフン（オプション注入防止）
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(target)) {
      throw new Error(`target に不正な文字が含まれています: ${target}`);
    }
  }
}

/**
 * コマンド文字列を生成する（表示用）
 * 
 * @param result - コマンド構築結果
 * @returns コマンド文字列
 */
export function formatCommand(result: CommandResult): string {
  return `${result.command} ${result.args.join(' ')}`.trim();
}

/**
 * 許可されたコマンドパターンかどうかを検証する
 * 
 * 生成されたコマンドが固定テンプレートに一致するかチェック
 * 
 * @param command - コマンド
 * @param args - 引数
 * @returns 許可されたパターンの場合 true
 */
export function isAllowedCommandPattern(command: string, args: string[]): boolean {
  // flutter test パターンのみ許可
  if (command !== 'flutter') {
    return false;
  }

  if (args.length === 0 || args[0] !== 'test') {
    return false;
  }

  // 許可されたパターン:
  // 1. flutter test
  // 2. flutter test <target>
  // 3. flutter test --name <target>
  
  if (args.length === 1) {
    // flutter test
    return true;
  }

  if (args.length === 2) {
    // flutter test <target>
    // targetが--で始まらないこと
    const arg1 = args[1];
    return arg1 !== undefined && !arg1.startsWith('--');
  }

  if (args.length === 3) {
    // flutter test --name <target>
    const arg1 = args[1];
    const arg2 = args[2];
    return arg1 === '--name' && arg2 !== undefined && !arg2.startsWith('--');
  }

  return false;
}
