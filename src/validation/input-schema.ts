/**
 * 入力バリデーションスキーマ（Zod）
 * 
 * run_testツールの入力パラメータを検証する。
 * 
 * Requirements:
 * - 7.1: runnerが未指定または許可されていない値の場合エラー
 * - 7.2: scopeが未指定または許可されていない値の場合エラー
 * - 7.3: scope が file/pattern で target が未指定の場合エラー
 * - 7.4: timeout_ms が未指定または正の整数でない場合エラー
 * - 7.5: no_output_timeout_ms が未指定または正の整数でない場合エラー
 * - 7.6: max_output_bytes が未指定または正の整数でない場合エラー
 */
import { z } from 'zod';

/**
 * 許可されたテストランナー
 * MVPでは flutter のみサポート
 */
export const ALLOWED_RUNNERS = ['flutter'] as const;
export type Runner = typeof ALLOWED_RUNNERS[number];

/**
 * テスト実行スコープ
 * - all: 全テスト実行
 * - file: 特定ファイルのテスト実行
 * - pattern: パターンマッチでテスト実行
 */
export const ALLOWED_SCOPES = ['all', 'file', 'pattern'] as const;
export type Scope = typeof ALLOWED_SCOPES[number];

/**
 * 正の整数スキーマ（共通）
 */
const positiveIntSchema = z.number().int().positive({
  message: '正の整数である必要があります',
});

/**
 * run_test入力スキーマ（基本）
 */
const baseRunTestInputSchema = z.object({
  /** テストランナー（MVPでは flutter のみ） */
  runner: z.enum(ALLOWED_RUNNERS, {
    error: `runnerは ${ALLOWED_RUNNERS.join(', ')} のいずれかである必要があります`,
  }),

  /** テスト実行スコープ */
  scope: z.enum(ALLOWED_SCOPES, {
    error: `scopeは ${ALLOWED_SCOPES.join(', ')} のいずれかである必要があります`,
  }),

  /** テスト対象（scope が file/pattern の場合必須） */
  target: z.string().optional(),

  /** ハードタイムアウト（ミリ秒） */
  timeout_ms: positiveIntSchema,

  /** 無出力タイムアウト（ミリ秒） */
  no_output_timeout_ms: positiveIntSchema,

  /** 要約対象の末尾バイト数 */
  max_output_bytes: positiveIntSchema,

  /** レポート出力ディレクトリ（相対パス、オプション） */
  report_dir: z.string().optional(),
});

/**
 * run_test入力スキーマ（条件付きバリデーション付き）
 * 
 * scope が 'file' または 'pattern' の場合、target は必須
 */
export const runTestInputSchema = baseRunTestInputSchema.superRefine((data, ctx) => {
  // scope が file または pattern の場合、target は必須
  if ((data.scope === 'file' || data.scope === 'pattern') && !data.target) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `scope が '${data.scope}' の場合、target は必須です`,
      path: ['target'],
    });
  }
});

/**
 * run_test入力の型定義
 */
export type RunTestInput = z.infer<typeof runTestInputSchema>;

/**
 * バリデーション結果
 */
export interface ValidationResult<T> {
  /** バリデーション成功かどうか */
  success: boolean;
  /** パース済みデータ（成功時のみ） */
  data?: T;
  /** エラーメッセージ（失敗時のみ） */
  errors?: string[];
}

/**
 * run_test入力をバリデートする
 * 
 * @param input - 検証対象の入力
 * @returns バリデーション結果
 */
export function validateRunTestInput(input: unknown): ValidationResult<RunTestInput> {
  const result = runTestInputSchema.safeParse(input);

  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }

  // エラーメッセージを抽出
  const errors = result.error.issues.map((issue) => {
    const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
    return `${path}${issue.message}`;
  });

  return {
    success: false,
    errors,
  };
}

/**
 * ランナーが許可されているかチェック
 * 
 * @param runner - チェック対象のランナー
 * @returns 許可されている場合 true
 */
export function isAllowedRunner(runner: string): runner is Runner {
  return ALLOWED_RUNNERS.includes(runner as Runner);
}

/**
 * スコープが許可されているかチェック
 * 
 * @param scope - チェック対象のスコープ
 * @returns 許可されている場合 true
 */
export function isAllowedScope(scope: string): scope is Scope {
  return ALLOWED_SCOPES.includes(scope as Scope);
}
