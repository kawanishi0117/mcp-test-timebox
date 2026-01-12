# Implementation Plan: mcp-test-timebox

## Overview

TypeScriptでMCPサーバを実装する。テスト駆動で開発を進め、各コンポーネントはユニットテストとプロパティベーステストで検証する。

## Tasks

- [x] 1. プロジェクトセットアップ
  - [x] 1.1 TypeScriptプロジェクトの初期化
    - package.json作成（name: mcp-test-timebox）
    - TypeScript設定（tsconfig.json）
    - ESM形式で出力
    - _Requirements: 1.1_
  - [x] 1.2 依存関係のインストール
    - @modelcontextprotocol/sdk（MCPサーバ）
    - tree-kill（プロセスツリー終了）
    - zod（入力バリデーション）
    - _Requirements: 1.1, 7.1-7.6_
  - [x] 1.3 テスト環境のセットアップ
    - vitest（ユニットテスト）
    - fast-check（プロパティベーステスト）
    - _Requirements: Testing Strategy_

- [x] 2. PathValidator実装
  - [x] 2.1 PathValidatorの実装
    - isUnderRepo(): パスがリポジトリ配下かを検証
    - normalizePath(): パスを正規化し脱出を防ぐ
    - _Requirements: 2.6, 4.6, 4.7_
  - [x] 2.2 PathValidatorのプロパティテスト
    - **Property 3: パス検証の安全性**
    - **Validates: Requirements 2.6, 4.6, 4.7**
  - [x] 2.3 PathValidatorのユニットテスト
    - 正常系: リポジトリ配下のパス
    - 異常系: ../による脱出、絶対パス
    - _Requirements: 2.6, 4.6, 4.7_

- [x] 3. 入力バリデーション実装
  - [x] 3.1 入力スキーマの定義（Zod）
    - RunTestInputスキーマ
    - runner, scope, target, timeout_ms, no_output_timeout_ms, max_output_bytes, report_dir
    - _Requirements: 7.1-7.6_
  - [x] 3.2 コマンドビルダーの実装
    - buildCommand(): 入力からコマンドと引数を生成
    - 固定テンプレートのみ許可
    - _Requirements: 2.1, 2.3, 2.4, 2.5_
  - [x] 3.3 入力バリデーションのプロパティテスト
    - **Property 2: 許可されていないランナーの拒否**
    - **Property 12: 必須パラメータのバリデーション**
    - **Property 13: 条件付き必須パラメータのバリデーション**
    - **Validates: Requirements 2.2, 7.1-7.6**
  - [x] 3.4 コマンドビルダーのプロパティテスト
    - **Property 1: コマンド構築の安全性**
    - **Validates: Requirements 2.1, 2.3, 2.4, 2.5**

- [x] 4. Checkpoint - 基盤コンポーネント確認
  - すべてのテストがパスすることを確認
  - 質問があればユーザーに確認

- [x] 5. TimeboxController実装
  - [x] 5.1 TimeboxControllerの実装
    - setHardTimeout(): ハードタイムアウト設定
    - setNoOutputTimeout(): 無出力タイムアウト設定
    - notifyOutput(): 出力通知（タイマーリセット）
    - clear(): タイマークリア
    - _Requirements: 3.2, 3.3_
  - [x] 5.2 TimeboxControllerのユニットテスト
    - ハードタイムアウト発火
    - 無出力タイムアウト発火
    - 出力によるタイマーリセット
    - _Requirements: 3.2, 3.3_

- [x] 6. ProcessExecutor実装
  - [x] 6.1 ProcessExecutorの実装
    - execute(): プロセス実行とタイムアウト監視
    - stdinを即座に閉じる
    - tree-killでプロセスツリー終了
    - stdout/stderrをLogEntryとして収集
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - [x] 6.2 ProcessExecutorのプロパティテスト
    - **Property 4: ハードタイムアウトの確実な終了**
    - **Property 5: 無出力タイムアウトの確実な終了**
    - **Property 6: exit codeとstatusの対応**
    - **Validates: Requirements 3.2, 3.3, 3.5**
  - [x] 6.3 ProcessExecutorのユニットテスト
    - 正常終了（exit code 0）
    - 異常終了（exit code != 0）
    - タイムアウト
    - 無出力タイムアウト
    - _Requirements: 3.1-3.5_

- [x] 7. Checkpoint - プロセス実行確認
  - すべてのテストがパスすることを確認
  - 質問があればユーザーに確認

- [x] 8. LogExtractor実装
  - [x] 8.1 LogExtractorの実装
    - extractImportantLines(): 重要行抽出
    - getTailLines(): 末尾N行取得
    - 正規表現パターンによるマッチング
    - 前後コンテキスト付与
    - _Requirements: 5.1, 5.2, 5.3_
  - [x] 8.2 LogExtractorのプロパティテスト
    - **Property 8: ログ抽出のバイト制限**
    - **Property 9: 重要行の抽出とコンテキスト付与**
    - **Validates: Requirements 5.1, 5.2, 5.3**
  - [x] 8.3 LogExtractorのユニットテスト
    - パターンマッチング
    - コンテキスト付与
    - バイト制限
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 9. ReportGenerator実装
  - [x] 9.1 ReportGeneratorの実装
    - createReportDir(): レポートディレクトリ作成
    - writeRawLog(): raw.log生成（stdout/stderr区別）
    - writeSummaryMd(): summary.md生成
    - writeSummaryJson(): summary.json生成
    - _Requirements: 4.1-4.5, 5.4, 5.5_
  - [x] 9.2 ReportGeneratorのプロパティテスト
    - **Property 7: 成果物の生成**
    - **Property 10: summary.jsonの必須フィールド**
    - **Validates: Requirements 4.1-4.4, 5.4**
  - [x] 9.3 ReportGeneratorのユニットテスト
    - raw.logフォーマット
    - summary.mdフォーマット
    - summary.jsonフィールド
    - デフォルトパス生成
    - _Requirements: 4.1-4.5, 5.4, 5.5_

- [x] 10. Checkpoint - レポート生成確認
  - すべてのテストがパスすることを確認
  - 質問があればユーザーに確認

- [x] 11. RunTestTool実装
  - [x] 11.1 RunTestToolの実装
    - 入力バリデーション
    - コマンド構築
    - ProcessExecutor呼び出し
    - ReportGenerator呼び出し
    - レスポンス生成
    - _Requirements: 2.1-2.6, 6.1-6.5_
  - [x] 11.2 RunTestToolのプロパティテスト
    - **Property 11: MCPレスポンスの必須フィールド**
    - **Validates: Requirements 6.1-6.5**
  - [x] 11.3 RunTestToolの統合テスト
    - 正常系: テスト成功
    - 正常系: テスト失敗
    - 異常系: タイムアウト
    - 異常系: 無出力タイムアウト
    - 異常系: バリデーションエラー
    - _Requirements: 2.1-2.6, 3.1-3.5, 6.1-6.5_

- [x] 12. MCPサーバ実装
  - [x] 12.1 MCPサーバのエントリポイント実装
    - @modelcontextprotocol/sdk使用
    - stdio transport
    - run_testツール登録
    - stdoutはMCPプロトコル専用
    - _Requirements: 1.1, 1.2, 1.3_
  - [x] 12.2 MCPサーバの統合テスト
    - サーバ起動
    - ツール一覧取得
    - run_test呼び出し
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 13. Checkpoint - 全体統合確認
  - すべてのテストがパスすることを確認
  - 質問があればユーザーに確認

- [x] 14. ドキュメントとビルド設定
  - [x] 14.1 README更新
    - インストール手順
    - 使用方法
    - MCP設定例
    - _Requirements: N/A_
  - [x] 14.2 ビルドスクリプト設定
    - npm run build
    - npm run test
    - npm run start
    - _Requirements: N/A_

## Notes

- すべてのテストタスクは必須（テスト駆動開発）
- 各Checkpointでテストがパスすることを確認してから次に進む
- プロパティテストは fast-check で100回以上実行
- 統合テストでは短いタイムアウト値（100ms程度）を使用してテスト時間を短縮
