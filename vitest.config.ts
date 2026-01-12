import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // テストファイルのパターン
    include: ['tests/**/*.test.ts', 'tests/**/*.property.test.ts'],
    
    // グローバル設定
    globals: true,
    
    // 環境設定
    environment: 'node',
    
    // タイムアウト設定（プロパティテストは時間がかかる可能性があるため長めに）
    testTimeout: 30000,
    
    // カバレッジ設定
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/server.ts'], // エントリポイントは除外
    },
  },
});
