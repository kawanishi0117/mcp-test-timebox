/**
 * Jest ランナー設定
 * 
 * Node.js/TypeScript/JavaScript プロジェクト用のテストランナー
 */
import type { RunnerConfig } from './types.js';

export const jestRunner: RunnerConfig = {
  name: 'jest',
  description: 'Node.js/TypeScript/JavaScriptプロジェクト用（npx jest）',
  scopes: {
    all: {
      command: 'npx',
      baseArgs: ['jest'],
    },
    file: {
      command: 'npx',
      baseArgs: ['jest'],
      targetArgFormat: 'positional',
    },
    pattern: {
      command: 'npx',
      baseArgs: ['jest'],
      targetArgFormat: 'named',
      targetFlag: '-t',
    },
  },
};
