/**
 * Pytest ランナー設定
 * 
 * Python プロジェクト用のテストランナー
 */
import type { RunnerConfig } from './types.js';

export const pytestRunner: RunnerConfig = {
  name: 'pytest',
  description: 'Pythonプロジェクト用（pytest）',
  scopes: {
    all: {
      command: 'pytest',
      baseArgs: [],
    },
    file: {
      command: 'pytest',
      baseArgs: [],
      targetArgFormat: 'positional',
    },
    pattern: {
      command: 'pytest',
      baseArgs: [],
      targetArgFormat: 'named',
      targetFlag: '-k',
    },
  },
};
