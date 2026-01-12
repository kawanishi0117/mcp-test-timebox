# Design Document: mcp-test-timebox

## Overview

mcp-test-timeboxは、TypeScriptで実装されるテスト専用MCPサーバである。MCP SDK（@modelcontextprotocol/sdk）を使用してstdio通信を行い、`run_test`ツールを公開する。

主要な設計目標：
- **確実な終了**: どんな状況でもMCP呼び出しが必ず返る
- **安全性**: 任意コマンド実行を禁止し、固定テンプレートのみ許可
- **トレーサビリティ**: 実行結果を成果物として保存

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      MCP Client (IDE等)                      │
└─────────────────────────────────────────────────────────────┘
                              │ stdio (JSON-RPC)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        MCP Server                            │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                   RunTestTool                        │    │
│  │  - 入力バリデーション                                │    │
│  │  - コマンド構築                                      │    │
│  │  - レスポンス生成                                    │    │
│  └─────────────────────────────────────────────────────┘    │
│                              │                               │
│         ┌────────────────────┼────────────────────┐         │
│         ▼                    ▼                    ▼         │
│  ┌─────────────┐    ┌─────────────────┐    ┌────────────┐  │
│  │PathValidator│    │ ProcessExecutor │    │ReportGen   │  │
│  │             │    │                 │    │            │  │
│  │- isUnderRepo│    │- spawn          │    │- writeRaw  │  │
│  │- normalize  │    │- kill tree      │    │- writeMd   │  │
│  └─────────────┘    │- stdin close    │    │- writeJson │  │
│                     └────────┬────────┘    └────────────┘  │
│                              │                               │
│                     ┌────────▼────────┐                     │
│                     │TimeboxController│                     │
│                     │                 │                     │
│                     │- hardTimeout    │                     │
│                     │- noOutputTimeout│                     │
│                     └─────────────────┘                     │
│                              │                               │
│                     ┌────────▼────────┐                     │
│                     │  LogExtractor   │                     │
│                     │                 │                     │
│                     │- extractImportant│                    │
│                     │- getTail        │                     │
│                     └─────────────────┘                     │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. MCPサーバ (src/server.ts)

```typescript
// MCPサーバのエントリポイント
// @modelcontextprotocol/sdk を使用
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// run_test ツールのみを登録
// stdoutはMCPプロトコル専用、ログはstderrへ
```

### 2. RunTestTool (src/tools/run-test.ts)

```typescript
interface RunTestInput {
  runner: "flutter";           // MVPでは flutter のみ
  scope: "all" | "file" | "pattern";
  target?: string;             // scope が file/pattern の場合必須
  timeout_ms: number;          // ハードタイムアウト
  no_output_timeout_ms: number; // 無出力タイムアウト
  max_output_bytes: number;    // 要約対象の末尾バイト数
  report_dir?: string;         // 相対パスのみ
}

interface RunTestOutput {
  status: "pass" | "fail" | "timeout" | "no_output" | "error";
  exit_code: number | null;
  duration_ms: number;
  report_dir: string;
  artifacts: {
    raw_log: string;
    summary_md: string;
    summary_json: string;
  };
  excerpt: string;
}
```

### 3. PathValidator (src/utils/path-validator.ts)

```typescript
interface PathValidator {
  // パスがリポジトリ配下かを検証
  isUnderRepo(path: string, repoRoot: string): boolean;
  
  // パスを正規化し、../ などの脱出を防ぐ
  normalizePath(path: string, repoRoot: string): string;
}
```

### 4. ProcessExecutor (src/executor/process-executor.ts)

```typescript
interface ProcessResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  noOutput: boolean;
  durationMs: number;
}

interface ProcessExecutor {
  // プロセスを実行し、タイムアウト監視を行う
  execute(
    command: string,
    args: string[],
    options: {
      cwd: string;
      timeoutMs: number;
      noOutputTimeoutMs: number;
      maxOutputBytes: number;
    }
  ): Promise<ProcessResult>;
}
```

### 5. TimeboxController (src/executor/timebox-controller.ts)

```typescript
interface TimeboxController {
  // ハードタイムアウトを設定
  setHardTimeout(ms: number, onTimeout: () => void): void;
  
  // 無出力タイムアウトを設定（出力があるたびにリセット）
  setNoOutputTimeout(ms: number, onTimeout: () => void): void;
  
  // 出力があったことを通知（無出力タイマーをリセット）
  notifyOutput(): void;
  
  // すべてのタイマーをクリア
  clear(): void;
}
```

### 6. ReportGenerator (src/report/report-generator.ts)

```typescript
interface ReportGenerator {
  // レポートディレクトリを作成
  createReportDir(basePath: string): Promise<string>;
  
  // raw.log を生成（stdout/stderr を区別して記録）
  writeRawLog(
    reportDir: string,
    entries: Array<{ stream: "stdout" | "stderr"; data: string; timestamp: number }>
  ): Promise<void>;
  
  // summary.md を生成
  writeSummaryMd(reportDir: string, summary: Summary): Promise<void>;
  
  // summary.json を生成
  writeSummaryJson(reportDir: string, summary: Summary): Promise<void>;
}

interface Summary {
  command: string;
  args: string[];
  status: string;
  exitCode: number | null;
  durationMs: number;
  excerpts: string[];
  tailLines: string[];
}
```

### 7. LogExtractor (src/report/log-extractor.ts)

```typescript
interface LogExtractor {
  // 重要行を抽出（正規表現マッチ + 前後コンテキスト）
  extractImportantLines(
    log: string,
    maxBytes: number,
    contextLines: number
  ): string[];
  
  // 末尾N行を取得
  getTailLines(log: string, lineCount: number): string[];
}

// 抽出パターン
const IMPORTANT_PATTERNS = [
  /FAIL/i,
  /FAILED/i,
  /ERROR/i,
  /FATAL/i,
  /Exception/,
  /Traceback/,
  /panic/,
  /AssertionError/,
];
```

## Data Models

### 入力スキーマ (JSON Schema)

```json
{
  "type": "object",
  "properties": {
    "runner": {
      "type": "string",
      "enum": ["flutter"]
    },
    "scope": {
      "type": "string",
      "enum": ["all", "file", "pattern"]
    },
    "target": {
      "type": "string"
    },
    "timeout_ms": {
      "type": "integer",
      "minimum": 1
    },
    "no_output_timeout_ms": {
      "type": "integer",
      "minimum": 1
    },
    "max_output_bytes": {
      "type": "integer",
      "minimum": 1
    },
    "report_dir": {
      "type": "string"
    }
  },
  "required": ["runner", "scope", "timeout_ms", "no_output_timeout_ms", "max_output_bytes"]
}
```

### ログエントリ

```typescript
interface LogEntry {
  timestamp: number;      // Unix timestamp (ms)
  stream: "stdout" | "stderr";
  data: string;
}
```

### raw.log フォーマット

```
[2026-01-12T12:34:56.789Z] [stdout] Running "flutter test"...
[2026-01-12T12:34:57.123Z] [stderr] Warning: some warning
[2026-01-12T12:34:58.456Z] [stdout] ✓ Test passed
```



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: コマンド構築の安全性

*For any* 有効な入力パラメータ（runner, scope, target）に対して、生成されるコマンドは固定テンプレート（`flutter test` または `flutter test <target>` または `flutter test --name <target>`）のいずれかに一致する。

**Validates: Requirements 2.1, 2.3, 2.4, 2.5**

### Property 2: 許可されていないランナーの拒否

*For any* `flutter` 以外の文字列が `runner` として渡されたとき、Run_Test_Tool はエラーを返す。

**Validates: Requirements 2.2, 7.1**

### Property 3: パス検証の安全性

*For any* パス文字列に対して、PathValidator.isUnderRepo() は以下を満たす：
- リポジトリ配下の正規化されたパスに対して true を返す
- `../` や絶対パスなどでリポジトリ外を指すパスに対して false を返す

**Validates: Requirements 2.6, 4.6, 4.7**

### Property 4: ハードタイムアウトの確実な終了

*For any* 正の整数 `timeout_ms` に対して、プロセスが `timeout_ms` ミリ秒以内に終了しない場合、TimeboxController は必ずプロセスを強制終了し、status `timeout` を返す。

**Validates: Requirements 3.2**

### Property 5: 無出力タイムアウトの確実な終了

*For any* 正の整数 `no_output_timeout_ms` に対して、プロセスが `no_output_timeout_ms` ミリ秒間 stdout/stderr に出力しない場合、TimeboxController は必ずプロセスを強制終了し、status `no_output` を返す。

**Validates: Requirements 3.3**

### Property 6: exit codeとstatusの対応

*For any* プロセス実行結果に対して：
- exit code が 0 の場合、status は `pass`
- exit code が 0 以外の場合、status は `fail`
- タイムアウトの場合、status は `timeout`
- 無出力タイムアウトの場合、status は `no_output`

**Validates: Requirements 3.5**

### Property 7: 成果物の生成

*For any* テスト実行完了後、report_dir に以下の3ファイルが必ず生成される：
- `raw.log`（stdout/stderrを区別して記録）
- `summary.md`
- `summary.json`

**Validates: Requirements 4.1, 4.2, 4.3, 4.4**

### Property 8: ログ抽出のバイト制限

*For any* ログ文字列と正の整数 `max_output_bytes` に対して、LogExtractor が処理する対象は末尾 `max_output_bytes` バイト以内である。

**Validates: Requirements 5.1**

### Property 9: 重要行の抽出とコンテキスト付与

*For any* ログ文字列に対して、LogExtractor は：
- 正規表現パターン（FAIL|FAILED|ERROR|FATAL|Exception|Traceback|panic|AssertionError）にマッチする行を抽出する
- 抽出された各行に前後N行のコンテキストを付与する

**Validates: Requirements 5.2, 5.3**

### Property 10: summary.jsonの必須フィールド

*For any* 生成された summary.json に対して、以下のフィールドが必ず含まれる：
- command（実行コマンド）
- exit_code
- status
- duration_ms（実行時間）
- excerpts（抜粋ブロック）
- tail_lines（末尾N行）

**Validates: Requirements 5.4**

### Property 11: MCPレスポンスの必須フィールド

*For any* Run_Test_Tool の実行結果に対して、レスポンスには以下のフィールドが必ず含まれる：
- status（pass/fail/timeout/no_output/error）
- exit_code
- duration_ms
- report_dir
- artifacts（raw_log, summary_md, summary_json のパス）
- excerpt

**Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**

### Property 12: 必須パラメータのバリデーション

*For any* 入力に対して、以下のいずれかが欠落または不正な場合、Run_Test_Tool はエラーを返す：
- runner が未指定または許可されていない値
- scope が未指定または許可されていない値（all/file/pattern以外）
- timeout_ms が未指定または正の整数でない
- no_output_timeout_ms が未指定または正の整数でない
- max_output_bytes が未指定または正の整数でない

**Validates: Requirements 7.1, 7.2, 7.4, 7.5, 7.6**

### Property 13: 条件付き必須パラメータのバリデーション

*For any* scope が `file` または `pattern` の入力に対して、target が未指定の場合、Run_Test_Tool はエラーを返す。

**Validates: Requirements 7.3**

## Error Handling

### エラーの種類

| エラー種別 | 発生条件 | レスポンス |
|-----------|----------|-----------|
| ValidationError | 入力パラメータが不正 | status: "error", エラーメッセージ |
| PathEscapeError | パスがリポジトリ外を指す | status: "error", エラーメッセージ |
| ProcessError | プロセス起動失敗 | status: "error", エラーメッセージ |
| TimeoutError | ハードタイムアウト超過 | status: "timeout" |
| NoOutputError | 無出力タイムアウト超過 | status: "no_output" |

### エラー時の成果物

エラー発生時も可能な限り成果物を生成する：
- プロセス起動前のエラー: 成果物なし
- プロセス実行中のエラー: それまでのログを raw.log に保存

## Testing Strategy

### テストフレームワーク

- **ユニットテスト**: Vitest
- **プロパティベーステスト**: fast-check

### テスト構成

```
tests/
├── unit/
│   ├── path-validator.test.ts
│   ├── log-extractor.test.ts
│   ├── timebox-controller.test.ts
│   └── report-generator.test.ts
├── property/
│   ├── path-validator.property.test.ts
│   ├── log-extractor.property.test.ts
│   ├── input-validation.property.test.ts
│   └── command-builder.property.test.ts
└── integration/
    ├── run-test.test.ts
    └── mcp-server.test.ts
```

### ユニットテスト

- 各コンポーネントの基本動作を確認
- エッジケース（空文字列、境界値など）をカバー
- モックを使用してコンポーネントを分離

### プロパティベーステスト

- fast-check を使用して100回以上のランダム入力でテスト
- 各プロパティは設計ドキュメントのプロパティ番号を参照
- タグ形式: `Feature: mcp-test-timebox, Property N: <property_text>`

### 統合テスト

- 実際のプロセス実行を伴うテスト
- MCPプロトコルの準拠を確認
- タイムアウト動作の実際の検証（短いタイムアウト値を使用）
