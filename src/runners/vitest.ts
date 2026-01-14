/**
 * Vitest ランナー設定
 * 
 * Vite/TypeScript/JavaScript プロジェクト用のテストランナー
 */
import type { RunnerConfig } from './types.js';

export const vitestRunner: RunnerConfig = {
  name: 'vitest',
  description: 'Vite/TypeScript/JavaScriptプロジェクト用（npx vitest run）',
  scopes: {
    all: {
      command: 'npx',
      baseArgs: ['vitest', 'run'],
    },
    file: {
      command: 'npx',
      baseArgs: ['vitest', 'run'],
      targetArgFormat: 'positional',
    },
    pattern: {
      command: 'npx',
      baseArgs: ['vitest', 'run'],
      targetArgFormat: 'named',
      targetFlag: '-t',
    },
  },
};
