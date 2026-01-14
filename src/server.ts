#!/usr/bin/env node
/**
 * mcp-test-timebox MCPサーバ エントリポイント
 * 
 * タイムボックス付きテスト専用MCPサーバ
 * - stdio経由でMCPプロトコルに準拠した通信を行う
 * - run_testツールのみを公開
 * - stdoutはMCPプロトコル専用、ログはstderrへ
 * 
 * Requirements:
 * - 1.1: stdio経由でMCPプロトコルに準拠した通信を開始する
 * - 1.2: run_testツールのみを公開する
 * - 1.3: stdoutにログを出力せず、MCPプロトコル出力を破壊しない
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { createRunTestTool, type RunTestOutput } from './tools/run-test.js';
import { ALLOWED_RUNNERS, isAllowedRunner } from './runners/index.js';
import { ALLOWED_SCOPES } from './validation/input-schema.js';

/**
 * サーバ情報
 */
const SERVER_INFO = {
  name: 'mcp-test-timebox',
  version: '1.0.0',
  description: 'タイムボックス付きテスト専用MCPサーバ - テスト実行が終わらない問題を防ぐ',
};

/**
 * run_testツールの入力スキーマ（Zod shape）
 * MCPプロトコルで公開するスキーマ定義
 * 
 * 注意: MCP SDKはZodObjectではなく、オブジェクトの形状（shape）を期待する
 */
const runTestInputShape = {
  /** テストランナー */
  runner: z.string().refine(
    (val) => isAllowedRunner(val),
    { message: `runnerは ${ALLOWED_RUNNERS.join(', ')} のいずれかである必要があります` }
  ).describe(
    `テストランナー。プロジェクトに応じて選択:
- flutter: Flutter/Dartプロジェクト
- vitest: Vite/TypeScript/JavaScriptプロジェクト
- pytest: Pythonプロジェクト
- jest: Node.js/TypeScript/JavaScriptプロジェクト`
  ),
  /** テスト実行スコープ */
  scope: z.enum(ALLOWED_SCOPES).describe(
    `テスト実行スコープ:
- all: 全テスト実行（推奨: 初回や全体確認時）
- file: 特定ファイルのテスト（例: test/widget_test.dart）
- pattern: テスト名でフィルタ（例: "login"を含むテスト）`
  ),
  /** テスト対象（scope が file/pattern の場合必須） */
  target: z.string().optional().describe(
    `テスト対象。scopeがfileの場合はファイルパス、patternの場合はテスト名パターン。
例: "test/unit/auth.test.ts" または "should login"`
  ),
  /** ハードタイムアウト（ミリ秒） */
  timeout_ms: z.number().int().positive().describe(
    `ハードタイムアウト（ミリ秒）。推奨値:
- 単体テスト: 60000（1分）
- 統合テスト: 300000（5分）
- E2Eテスト: 600000（10分）`
  ),
  /** 無出力タイムアウト（ミリ秒） */
  no_output_timeout_ms: z.number().int().positive().describe(
    `無出力タイムアウト（ミリ秒）。この時間出力がないとハング判定。推奨: 30000〜60000`
  ),
  /** 要約対象の末尾バイト数 */
  max_output_bytes: z.number().int().positive().describe(
    `要約対象の末尾バイト数。ログが大きい場合に末尾からこのバイト数を抽出。推奨: 102400（100KB）`
  ),
  /** レポート出力ディレクトリ（相対パス、オプション） */
  report_dir: z.string().optional().describe(
    'レポート出力ディレクトリ（相対パス）。省略時は .cache/mcp-test-timebox/reports/<timestamp> に自動生成'
  ),
  /** 作業ディレクトリ（絶対パス、必須） */
  cwd: z.string().describe(
    'テスト実行の作業ディレクトリ（絶対パス）。ワークスペースのルートパスを指定してください。'
  ),
};

/**
 * デバッグログをstderrに出力する
 * stdoutはMCPプロトコル専用のため、ログはstderrへ
 * 
 * @param message - ログメッセージ
 */
function debugLog(message: string): void {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [mcp-test-timebox] ${message}`);
}

/**
 * MCPサーバを作成する
 * 
 * @returns 設定済みのMcpServerインスタンス
 */
export function createMcpServer(): McpServer {
  // MCPサーバインスタンスを作成
  const server = new McpServer(SERVER_INFO);

  // RunTestToolインスタンスを作成
  const runTestTool = createRunTestTool();

  // run_testツールを登録（registerToolを使用）
  server.registerTool(
    'run_test',
    {
      description: `タイムボックス付きでテストを実行し、必ず結果を返す。

【用途】
- テストがハングしても必ずタイムアウトで結果を返す
- テスト結果をraw.log/summary.md/summary.jsonとして保存
- AIがテスト結果を解析しやすい形式で出力

【対応ランナー】
- flutter: Flutter/Dartプロジェクト（flutter test）
- vitest: Vite/TS/JSプロジェクト（npx vitest run）
- pytest: Pythonプロジェクト（pytest）
- jest: Node.js/TS/JSプロジェクト（npx jest）

【推奨パラメータ】
- timeout_ms: 60000〜300000（1〜5分）
- no_output_timeout_ms: 30000〜60000（30秒〜1分）
- max_output_bytes: 102400（100KB）
- cwd: ワークスペースのルートパス（絶対パス）※必須

【レスポンス】
status: pass/fail/timeout/no_output/error
excerpt: テスト結果の要約（失敗時はエラー箇所を抽出）`,
      inputSchema: runTestInputShape,
    },
    async (params): Promise<{ content: Array<{ type: 'text'; text: string }> }> => {
      debugLog(`run_test called with params: ${JSON.stringify(params)}`);

      try {
        // ツールを実行
        const result: RunTestOutput = await runTestTool.execute(params);

        debugLog(`run_test completed with status: ${result.status}`);

        // MCPレスポンス形式で返す
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        // 予期しないエラーの場合
        const errorMessage = error instanceof Error ? error.message : String(error);
        debugLog(`run_test error: ${errorMessage}`);

        const errorResult: RunTestOutput = {
          status: 'error',
          exit_code: null,
          duration_ms: 0,
          report_dir: '',
          artifacts: {
            raw_log: '',
            summary_md: '',
            summary_json: '',
          },
          excerpt: '',
          error_message: `予期しないエラー: ${errorMessage}`,
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(errorResult, null, 2),
            },
          ],
        };
      }
    }
  );

  return server;
}

/**
 * MCPサーバを起動する
 * stdio transportを使用してクライアントと通信する
 */
export async function startServer(): Promise<void> {
  debugLog('Starting MCP server...');

  try {
    // MCPサーバを作成
    const server = createMcpServer();

    // stdio transportを作成
    const transport = new StdioServerTransport();

    // サーバをtransportに接続
    await server.connect(transport);

    debugLog('MCP server started successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    debugLog(`Failed to start MCP server: ${errorMessage}`);
    process.exit(1);
  }
}

// メインエントリポイント
// このファイルが直接実行された場合にサーバを起動
// 常にサーバを起動する（CLIツールとして使用されるため）
startServer().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
