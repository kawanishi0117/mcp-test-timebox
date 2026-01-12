# mcp-test-timebox

テスト実行の「終わらない／戻ってこない」問題を防ぐ、タイムボックス付きテスト専用MCPサーバ。

## 概要

- **必ず結果を返す**: ハードタイムアウト・無出力タイムアウトにより、ハングしても必ずレスポンスを返却
- **安全な実行**: 任意コマンド実行を禁止し、固定テンプレート（`flutter test`等）のみ許可
- **成果物の保存**: 実行ごとに `raw.log` / `summary.md` / `summary.json` を生成

## インストール

### 前提条件

- Node.js 18.0.0 以上
- npm または yarn

### インストール手順

```bash
# リポジトリをクローン
git clone <repository-url>
cd mcp-test-timebox

# 依存関係をインストール
npm install

# ビルド
npm run build
```

## 使用方法

### MCPサーバとして起動

```bash
# stdio経由でMCPサーバを起動
npm run start

# または直接実行
node dist/server.js
```

### run_test ツールのパラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `runner` | string | ✓ | テストランナー（現在は `flutter` のみ） |
| `scope` | string | ✓ | 実行スコープ: `all`, `file`, `pattern` |
| `target` | string | △ | `scope` が `file` または `pattern` の場合に必須 |
| `timeout_ms` | number | ✓ | ハードタイムアウト（ミリ秒） |
| `no_output_timeout_ms` | number | ✓ | 無出力タイムアウト（ミリ秒） |
| `max_output_bytes` | number | ✓ | 要約対象の末尾バイト数 |
| `report_dir` | string | - | レポート出力先（省略時は自動生成） |

### 実行例

```json
{
  "runner": "flutter",
  "scope": "all",
  "timeout_ms": 300000,
  "no_output_timeout_ms": 60000,
  "max_output_bytes": 102400
}
```

```json
{
  "runner": "flutter",
  "scope": "file",
  "target": "test/widget_test.dart",
  "timeout_ms": 300000,
  "no_output_timeout_ms": 60000,
  "max_output_bytes": 102400
}
```

### レスポンス

```json
{
  "status": "pass",
  "exit_code": 0,
  "duration_ms": 12345,
  "report_dir": ".cache/mcp-test-timebox/reports/20260113-123456",
  "artifacts": {
    "raw_log": ".cache/mcp-test-timebox/reports/20260113-123456/raw.log",
    "summary_md": ".cache/mcp-test-timebox/reports/20260113-123456/summary.md",
    "summary_json": ".cache/mcp-test-timebox/reports/20260113-123456/summary.json"
  },
  "excerpt": "..."
}
```

### ステータス一覧

| ステータス | 説明 |
|-----------|------|
| `pass` | テスト成功（exit code 0） |
| `fail` | テスト失敗（exit code ≠ 0） |
| `timeout` | ハードタイムアウト超過 |
| `no_output` | 無出力タイムアウト超過 |
| `error` | バリデーションエラー等 |

## MCP設定例

### Kiro での設定

`.kiro/settings/mcp.json`:

```json
{
  "mcpServers": {
    "mcp-test-timebox": {
      "command": "node",
      "args": ["/path/to/mcp-test-timebox/dist/server.js"],
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

### Claude Desktop での設定

`claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mcp-test-timebox": {
      "command": "node",
      "args": ["/path/to/mcp-test-timebox/dist/server.js"]
    }
  }
}
```

## 開発

### ビルド

```bash
npm run build
```

### テスト実行

```bash
# 全テスト実行
npm run test

# ウォッチモード
npm run test:watch

# カバレッジ付き
npm run test:coverage
```

### 開発モード（ウォッチビルド）

```bash
npm run dev
```

## 成果物

テスト実行ごとに以下のファイルが生成されます：

```
.cache/mcp-test-timebox/reports/<timestamp>/
├── raw.log        # stdout/stderrの完全ログ（出力元を区別）
├── summary.md     # 人間が読みやすい要約
└── summary.json   # 機械処理用の構造化データ
```

### raw.log フォーマット

```
[2026-01-13T12:34:56.789Z] [stdout] Running "flutter test"...
[2026-01-13T12:34:57.123Z] [stderr] Warning: some warning
[2026-01-13T12:34:58.456Z] [stdout] ✓ Test passed
```

## ドキュメント

- [MVP要件](docs/MVP.md) - プロジェクトのMVP仕様

## ライセンス

MIT License - 詳細は [LICENSE](LICENSE) を参照
