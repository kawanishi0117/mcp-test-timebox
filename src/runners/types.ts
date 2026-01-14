/**
 * ランナー設定の型定義
 * 
 * 新しいランナーを追加する際は、この型に従って設定を定義する。
 */

/**
 * スコープごとのコマンド設定
 */
export interface ScopeConfig {
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
 * ランナー設定
 */
export interface RunnerConfig {
  /** ランナー名（表示用） */
  name: string;
  /** 説明 */
  description: string;
  /** スコープごとの設定 */
  scopes: {
    all: ScopeConfig;
    file: ScopeConfig;
    pattern: ScopeConfig;
  };
}
