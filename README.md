# mcp-test-timebox

[![npm version](https://badge.fury.io/js/mcp-test-timebox.svg)](https://www.npmjs.com/package/mcp-test-timebox)

テスト実行の「終わらない／戻ってこない」問題を防ぐ、タイムボックス付きテスト専用MCPサーバ。

## 特徴

- **必ず結果を返す**: ハードタイムアウト・無出力タイムアウトにより、ハングしても必ずレスポンスを返却
- **安全な実行**: 任意コマンド実行を禁止し、固定テンプレートのみ許可
- **成果物の保存**: 実行ごとに `raw.log` / `summary.md` / `summary.json` を生成
- **複数ランナー対応**: Flutter, Vitest, Pytest, Jest をサポート

## 対応テストランナー

| ランナー | 言語/フレームワーク | コマンド |
|---------|-------------------|---------|
| `flutter` | Flutter/Dart | `flutter test` |
| `vitest` | Vite/TypeScript/JavaScript | `npx vitest run` |
| `pytest` | Python | `pytest` |
| `jest` | Node.js/TypeScript/JavaScript | `npx jest` |

## インストール

### npx で直接使用（推奨）

インストール不要で、MCP設定に追加するだけで使えます。

### グローバルインストール

```bash
npm install -g mcp-test-timebox
```

## MCP設定

### Kiro

`.kiro/settings/mcp.json` または `~/.kiro/settings/mcp.json`:

```json
{
  "mcpServers": {
    "mcp-test-timebox": {
      "command": "npx",
      "args": ["-y", "mcp-test-timebox"],
      "disabled": false,
      "autoApprove": ["run_test"]
    }
  }
}
```

### Claude Desktop

`claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mcp-test-timebox": {
      "command": "npx",
      "args": ["-y", "mcp-test-timebox"]
    }
  }
}
```

### VS Code (Copilot)

`.vscode/mcp.json`:

```json
{
  "servers": {
    "mcp-test-timebox": {
      "command": "npx",
      "args": ["-y", "mcp-test-timebox"]
    }
  }
}
```

## 使用方法

### run_test ツール

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `runner` | string | ✓ | テストランナー: `flutter`, `vitest`, `pytest`, `jest` |
| `scope` | string | ✓ | 実行スコープ: `all`, `file`, `pattern` |
| `target` | string | △ | `scope` が `file` または `pattern` の場合に必須 |
| `timeout_ms` | number | ✓ | ハードタイムアウト（ミリ秒） |
| `no_output_timeout_ms` | number | ✓ | 無出力タイムアウト（ミリ秒） |
| `max_output_bytes` | number | ✓ | 要約対象の末尾バイト数 |
| `report_dir` | string | - | レポート出力先（省略時は自動生成） |

### 推奨パラメータ値

| パラメータ | 推奨値 | 説明 |
|-----------|--------|------|
| `timeout_ms` | 60000〜300000 | 1〜5分（テスト規模に応じて調整） |
| `no_output_timeout_ms` | 30000〜60000 | 30秒〜1分 |
| `max_output_bytes` | 102400 | 100KB |

### 実行例

#### Flutter - 全テスト
```json
{
  "runner": "flutter",
  "scope": "all",
  "timeout_ms": 300000,
  "no_output_timeout_ms": 60000,
  "max_output_bytes": 102400
}
```

#### Vitest - 特定ファイル
```json
{
  "runner": "vitest",
  "scope": "file",
  "target": "tests/unit/auth.test.ts",
  "timeout_ms": 60000,
  "no_output_timeout_ms": 30000,
  "max_output_bytes": 102400
}
```

#### Pytest - パターンマッチ
```json
{
  "runner": "pytest",
  "scope": "pattern",
  "target": "test_login",
  "timeout_ms": 120000,
  "no_output_timeout_ms": 30000,
  "max_output_bytes": 102400
}
```

#### Jest - 全テスト
```json
{
  "runner": "jest",
  "scope": "all",
  "timeout_ms": 180000,
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

## 成果物

テスト実行ごとに以下のファイルが生成されます：

```
.cache/mcp-test-timebox/reports/<timestamp>/
├── raw.log        # stdout/stderrの完全ログ
├── summary.md     # 人間が読みやすい要約
└── summary.json   # 機械処理用の構造化データ
```

## 開発

```bash
# クローン
git clone https://github.com/kawanishi0117/mcp-test-timebox.git
cd mcp-test-timebox

# 依存関係インストール
npm install

# ビルド
npm run build

# テスト
npm test
```

## ライセンス

MIT
