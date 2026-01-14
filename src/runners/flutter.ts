/**
 * Flutter ランナー設定
 * 
 * Flutter/Dart プロジェクト用のテストランナー
 */
import type { RunnerConfig } from './types.js';

export const flutterRunner: RunnerConfig = {
  name: 'flutter',
  description: 'Flutter/Dartプロジェクト用（flutter test）',
  scopes: {
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
