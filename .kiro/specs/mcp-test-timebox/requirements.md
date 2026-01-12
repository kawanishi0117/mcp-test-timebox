# Requirements Document

## Introduction

mcp-test-timeboxは、テスト実行が「終わらない／戻ってこない」問題を防ぐタイムボックス付きテスト専用MCPサーバである。任意コマンド実行を禁止し、固定テンプレート（flutter test等）のみを許可することで安全性を確保する。実行結果は必ず成果物（ログ・要約）として保存され、失敗時の原因調査を支援する。

## Glossary

- **MCP_Server**: Model Context Protocol に準拠したサーバ。stdio経由で通信する
- **Run_Test_Tool**: MCPサーバが公開する唯一のツール。テスト実行を行う
- **Test_Runner**: テスト実行エンジン。MVPでは `flutter` のみサポート
- **Process_Executor**: 子プロセスを生成・監視・終了させるコンポーネント
- **Timebox_Controller**: タイムアウト監視を行うコンポーネント
- **Report_Generator**: 実行結果から成果物（raw.log, summary.md, summary.json）を生成するコンポーネント
- **Log_Extractor**: ログから重要行を抽出するコンポーネント
- **Path_Validator**: パスがリポジトリ配下かを検証するコンポーネント

## Requirements

### Requirement 1: MCPサーバ起動

**User Story:** 開発者として、MCPサーバをstdio経由で起動したい。これにより、IDEやCLIツールからテスト実行を呼び出せる。

#### Acceptance Criteria

1. WHEN MCP_Server が起動されたとき、THE MCP_Server SHALL stdio経由でMCPプロトコルに準拠した通信を開始する
2. WHEN MCP_Server が起動されたとき、THE MCP_Server SHALL `run_test` ツールのみを公開する
3. WHILE MCP_Server が動作中のとき、THE MCP_Server SHALL stdoutにログを出力せず、MCPプロトコル出力を破壊しない
4. WHILE MCP_Server が動作中のとき、THE MCP_Server SHALL stderrにはデバッグログを出力してよい

### Requirement 2: テスト実行コマンドの制限

**User Story:** 開発者として、安全にテストを実行したい。任意コマンド実行による危険を避けるため、固定テンプレートのみ許可する。

#### Acceptance Criteria

1. WHEN Run_Test_Tool が呼び出されたとき、THE Test_Runner SHALL 固定テンプレート（`flutter test`）のみを実行する
2. WHEN Run_Test_Tool に `runner` パラメータが渡されたとき、THE Test_Runner SHALL 許可されたランナー（`flutter`）以外を拒否する
3. WHEN Run_Test_Tool に `scope` が `all` で渡されたとき、THE Test_Runner SHALL `flutter test` を実行する
4. WHEN Run_Test_Tool に `scope` が `file` で渡されたとき、THE Test_Runner SHALL `flutter test <target>` を実行する
5. WHEN Run_Test_Tool に `scope` が `pattern` で渡されたとき、THE Test_Runner SHALL `flutter test --name <target>` を実行する
6. WHEN Run_Test_Tool に `target` パラメータが渡されたとき、THE Path_Validator SHALL パスがリポジトリ配下であることを検証する

### Requirement 3: タイムボックス制御

**User Story:** 開発者として、テストがハングしても必ず結果を受け取りたい。タイムアウトにより強制終了することで、MCP呼び出しが必ず返る。

#### Acceptance Criteria

1. WHEN Process_Executor がプロセスを起動したとき、THE Process_Executor SHALL stdinを即座に閉じる
2. WHEN `timeout_ms` で指定された時間が経過したとき、THE Timebox_Controller SHALL プロセスを強制終了し、status `timeout` を返す
3. WHEN `no_output_timeout_ms` で指定された時間、stdout/stderrに出力がなかったとき、THE Timebox_Controller SHALL プロセスを強制終了し、status `no_output` を返す
4. WHEN プロセスを強制終了するとき、THE Process_Executor SHALL 可能な限りプロセスツリーごと終了する
5. WHEN プロセスが正常終了したとき、THE Process_Executor SHALL exit code 0 で status `pass`、それ以外で status `fail` を返す

### Requirement 4: 成果物の生成

**User Story:** 開発者として、テスト実行の詳細ログと要約を保存したい。失敗時の原因調査に必要な情報を残す。

#### Acceptance Criteria

1. WHEN テスト実行が完了したとき、THE Report_Generator SHALL `report_dir` に `raw.log` を生成する
2. WHEN テスト実行が完了したとき、THE Report_Generator SHALL `report_dir` に `summary.md` を生成する
3. WHEN テスト実行が完了したとき、THE Report_Generator SHALL `report_dir` に `summary.json` を生成する
4. WHEN `raw.log` を生成するとき、THE Report_Generator SHALL stdout/stderrの出力元を区別して記録する
5. IF `report_dir` が指定されなかったとき、THEN THE Report_Generator SHALL デフォルトパス `.cache/mcp-test-timebox/reports/<timestamp>/` を使用する
6. WHEN `report_dir` が指定されたとき、THE Path_Validator SHALL パスがリポジトリ配下であることを検証する
7. IF `report_dir` がリポジトリ外を指していたとき、THEN THE Path_Validator SHALL エラーを返し実行を中止する

### Requirement 5: ログ抽出と要約

**User Story:** 開発者として、大量のログから重要な情報だけを抽出した要約がほしい。LLMを使わず機械的に生成する。

#### Acceptance Criteria

1. WHEN 要約を生成するとき、THE Log_Extractor SHALL `raw.log` の末尾 `max_output_bytes` バイトを対象とする
2. WHEN 要約を生成するとき、THE Log_Extractor SHALL 正規表現パターン（FAIL|FAILED|ERROR|FATAL|Exception|Traceback|panic|AssertionError等）にマッチする行を抽出する
3. WHEN 重要行を抽出したとき、THE Log_Extractor SHALL 前後N行のコンテキストを付与する
4. WHEN `summary.json` を生成するとき、THE Report_Generator SHALL 実行コマンド、exit_code、status、実行時間、抜粋ブロック、末尾N行を含める
5. WHEN `summary.md` を生成するとき、THE Report_Generator SHALL 人間が読みやすい形式で同等の情報を含める

### Requirement 6: MCPレスポンス

**User Story:** 開発者として、テスト実行結果をMCPレスポンスとして受け取りたい。成果物へのパスと要約情報を含める。

#### Acceptance Criteria

1. WHEN Run_Test_Tool が完了したとき、THE Run_Test_Tool SHALL `status` を返す（pass/fail/timeout/no_output/error）
2. WHEN Run_Test_Tool が完了したとき、THE Run_Test_Tool SHALL `exit_code` を返す
3. WHEN Run_Test_Tool が完了したとき、THE Run_Test_Tool SHALL `duration_ms` を返す
4. WHEN Run_Test_Tool が完了したとき、THE Run_Test_Tool SHALL `report_dir` と成果物パスを返す
5. WHEN Run_Test_Tool が完了したとき、THE Run_Test_Tool SHALL 抜粋ブロック（excerpt）を返す

### Requirement 7: 入力バリデーション

**User Story:** 開発者として、不正な入力を早期に検出したい。必須パラメータの欠落や不正な値を拒否する。

#### Acceptance Criteria

1. IF `runner` が未指定または許可されていない値のとき、THEN THE Run_Test_Tool SHALL エラーを返す
2. IF `scope` が未指定または許可されていない値（all/file/pattern以外）のとき、THEN THE Run_Test_Tool SHALL エラーを返す
3. IF `scope` が `file` または `pattern` で `target` が未指定のとき、THEN THE Run_Test_Tool SHALL エラーを返す
4. IF `timeout_ms` が未指定または正の整数でないとき、THEN THE Run_Test_Tool SHALL エラーを返す
5. IF `no_output_timeout_ms` が未指定または正の整数でないとき、THEN THE Run_Test_Tool SHALL エラーを返す
6. IF `max_output_bytes` が未指定または正の整数でないとき、THEN THE Run_Test_Tool SHALL エラーを返す
