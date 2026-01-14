# mcp-test-timebox

[![npm version](https://badge.fury.io/js/mcp-test-timebox.svg)](https://www.npmjs.com/package/mcp-test-timebox)

[English](./docs/README.en.md) | 日本語

AIエージェントがテストを実行しても、必ず結果が返ってくるMCPサーバ。

## 解決する問題

AIにテスト実行を任せると：

- ハングして永遠に待ち続ける
- 入力待ちで止まる
- 出力が膨大で処理できない

このMCPサーバは **タイムアウト付きでテストを実行** し、必ず構造化された結果を返します。

## セットアップ

### Kiro

`.kiro/settings/mcp.json`:

```json
{
  "mcpServers": {
    "mcp-test-timebox": {
      "command": "npx",
      "args": ["-y", "mcp-test-timebox"],
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

### VS Code (GitHub Copilot)

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

## MCPツール

### run_test

タイムボックス付きでテストを実行します。

```json
{
  "runner": "vitest",
  "scope": "all",
  "timeout_ms": 60000,
  "no_output_timeout_ms": 30000,
  "max_output_bytes": 102400,
  "cwd": "/path/to/project"
}
```

#### パラメータ

| 名前 | 必須 | 説明 |
|------|:----:|------|
| `runner` | ✓ | `flutter` / `vitest` / `pytest` / `jest` |
| `scope` | ✓ | `all` / `file` / `pattern` |
| `target` | △ | scope が `file` or `pattern` の時に必要 |
| `timeout_ms` | ✓ | 最大実行時間（ミリ秒） |
| `no_output_timeout_ms` | ✓ | 出力がない場合のタイムアウト |
| `max_output_bytes` | ✓ | 要約対象のログサイズ |
| `cwd` | ✓ | プロジェクトのパス（絶対パス） |

#### レスポンス

```json
{
  "status": "pass",
  "exit_code": 0,
  "duration_ms": 3456,
  "excerpt": "...",
  "report_dir": ".cache/mcp-test-timebox/reports/...",
  "artifacts": {
    "raw_log": "...",
    "summary_md": "...",
    "summary_json": "..."
  }
}
```

| status | 意味 |
|--------|------|
| `pass` | テスト成功 |
| `fail` | テスト失敗 |
| `timeout` | タイムアウト |
| `no_output` | 無出力タイムアウト |
| `error` | 実行エラー |

## 対応ランナー

| ランナー | コマンド |
|---------|---------|
| `flutter` | `flutter test` |
| `vitest` | `npx vitest run` |
| `pytest` | `pytest` |
| `jest` | `npx jest` |

## 生成ファイル

テスト実行ごとにレポートを生成（最新5件を保持）：

```
.cache/mcp-test-timebox/reports/<timestamp>/
├── raw.log        # 完全なログ
├── summary.md     # 人間向け要約
└── summary.json   # 機械向けデータ
```

## カスタムランナーの追加

`src/runners/` にファイルを追加して `index.ts` に登録するだけで、新しいランナーに対応できます。

詳細は [src/runners/](./src/runners/) を参照。

## 開発

```bash
npm install
npm run build
npm test
```

## フィードバック

- 不具合報告: [Issues](https://github.com/kawanishi0117/mcp-test-timebox/issues)
- 機能提案・改善案も歓迎です

## ライセンス

MIT
