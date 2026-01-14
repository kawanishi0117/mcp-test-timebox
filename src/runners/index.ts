/**
 * Runners モジュール
 * 
 * テストランナーの設定を一元管理する。
 * 新しいランナーを追加する場合は、このディレクトリに設定ファイルを追加するだけでOK。
 */

import type { RunnerConfig } from './types.js';
import { flutterRunner } from './flutter.js';
import { vitestRunner } from './vitest.js';
import { pytestRunner } from './pytest.js';
import { jestRunner } from './jest.js';

/**
 * 登録済みランナーのマップ
 * 
 * 新しいランナーを追加する場合:
 * 1. src/runners/<runner-name>.ts を作成
 * 2. RunnerConfig を実装
 * 3. ここにインポートして追加
 */
export const RUNNERS: Record<string, RunnerConfig> = {
  flutter: flutterRunner,
  vitest: vitestRunner,
  pytest: pytestRunner,
  jest: jestRunner,
};

/**
 * 許可されたランナー名の配列
 */
export const ALLOWED_RUNNERS = Object.keys(RUNNERS) as readonly string[];

/**
 * ランナー名の型
 */
export type Runner = keyof typeof RUNNERS;

/**
 * ランナーが存在するかチェック
 */
export function isAllowedRunner(runner: string): runner is Runner {
  return Object.prototype.hasOwnProperty.call(RUNNERS, runner);
}

/**
 * ランナー設定を取得
 */
export function getRunner(runner: string): RunnerConfig | undefined {
  return RUNNERS[runner];
}

export type { RunnerConfig, ScopeConfig } from './types.js';
