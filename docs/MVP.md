# mcp-test-timebox MVP要件

## 目的

1. **テスト実行が「終わらない／戻ってこない」問題を防ぎ、必ず結果を返す**
2. **失敗時に、原因調査に必要な最小限の情報（抜粋）と成果物（ログ）を残す**
3. **任意コマンド実行を避け、テストコマンドのみに限定する**

---

## スコープ（MVPでやること）

### 1. テスト専用MCPサーバ

- MCPサーバとして起動できる（stdio）
- 公開ツールは **1つだけ**：`run_test`

### 2. 実行対象の制限

- 実行可能なコマンドは **固定テンプレートのみ**
  - 例：`flutter test` / `dart test` のどちらか、または Flutter のみに絞る
- ユーザ入力は **構造化パラメータ** として受け取り、コマンド文字列を直接受け取らない
- `cwd` は **リポジトリ配下に固定**

### 3. 必ず終了させる（Timebox）

| パラメータ | 説明 |
|-----------|------|
| `timeout_ms` | ハードタイムアウト（必須）。超過したら強制終了 |
| `no_output_timeout_ms` | 無出力タイムアウト（必須）。一定時間 stdout/stderr が無ければ強制終了 |

- `stdin` は **常に閉じる**（対話入力待ちを許可しない）
- `kill` は可能な限り **プロセスツリーごと終了**
  - OS差は許容。MVPでは「子が残る可能性」を既知制約として明記可

### 4. 出力の保存（成果物）

実行ごとに `report_dir` を作成し、以下を **必ず生成**：

| ファイル | 内容 |
|----------|------|
| `raw.log` | stdout/stderr を保存。どちら由来か区別して記録 |
| `summary.md` | 人間向け要約 |
| `summary.json` | 機械向け要約・メタデータ |

- `report_dir` のデフォルトは repo 配下
  - 例：`.cache/mcp-test-timebox/reports/<timestamp>/`
- パスは **repo 配下のみ許可**（`../` などで脱出不可）

### 5. 機械的要約（LLM不使用）

- `raw.log` 全量は保存するが、要約は **末尾Nバイト/末尾N行** を対象に生成（トークン・メモリ抑制）
- 抽出ルール（正規表現）で重要行を抜粋し、前後N行のコンテキストを付与：
  - `FAIL|FAILED|ERROR|FATAL|Exception|Traceback|panic|AssertionError` 等

#### 要約に最低限含める情報

- 実行コマンド（テンプレ＋解決後の引数）
- exit code / status（`pass` / `fail` / `timeout` / `no_output` / `error`）
- 実行時間
- 抜粋ブロック（最大Kブロック）
- 末尾N行

### 6. MCPレスポンス

`run_test` のレスポンスとして最低限返す：

```json
{
  "status": "pass|fail|timeout|no_output|error",
  "exit_code": 0,
  "duration_ms": 1234,
  "report_dir": ".cache/mcp-test-timebox/reports/20260112_123456/",
  "artifacts": {
    "raw_log": "raw.log",
    "summary_md": "summary.md",
    "summary_json": "summary.json"
  },
  "excerpt": "..."
}
```

---

## 入力仕様（MVP）

`run_test` の入力パラメータ：

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `runner` | string | ✓ | `flutter`（MVPはこれだけでも良い） |
| `scope` | string | ✓ | `all` / `file` / `pattern` |
| `target` | string | △ | scope に応じて（ファイルパス or テスト名パターン） |
| `timeout_ms` | number | ✓ | ハードタイムアウト（ミリ秒） |
| `no_output_timeout_ms` | number | ✓ | 無出力タイムアウト（ミリ秒） |
| `max_output_bytes` | number | ✓ | 要約に使う末尾バッファ上限 |
| `report_dir` | string | - | 相対パスのみ |

---

## 非スコープ（MVPではやらない）

- 任意コマンド実行、複数コマンドの連鎖実行
- PTY/expect 等の対話自動化
- テスト結果の高度な解析（JUnit生成、`--machine` 解析など）
- ネットワーク遮断やコンテナ隔離（将来拡張）

---

## 受け入れ基準（Definition of Done）

- [ ] `flutter test`（または対象の固定テスト）を実行できる
- [ ] ハングするケースでも `timeout_ms` または `no_output_timeout_ms` により **必ずMCP呼び出しが返る**
- [ ] 実行のたびに `raw.log` / `summary.md` / `summary.json` が生成される
- [ ] `report_dir` がリポジトリ外に書き出せない
- [ ] stdout にログを出さず、MCPプロトコル出力を破壊しない（stderr は可）
