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
import { ALLOWED_RUNNERS, ALLOWED_SCOPES } from './validation/input-schema.js';

/**
 * サーバ情報
 */
const SERVER_INFO = {
  name: 'mcp-test-timebox',
  version: '0.1.0',
  description: 'タイムボックス付きテスト専用MCPサーバ - テスト実行が終わらない問題を防ぐ',
};

/**
 * run_testツールの入力スキーマ（Zod shape）
 * MCPプロトコルで公開するスキーマ定義
 * 
 * 注意: MCP SDKはZodObjectではなく、オブジェクトの形状（shape）を期待する
 */
const runTestInputShape = {
  /** テストランナー（MVPでは flutter のみ） */
  runner: z.enum(ALLOWED_RUNNERS).describe(
    `テストランナー。許可値: ${ALLOWED_RUNNERS.join(', ')}`
  ),
  /** テスト実行スコープ */
  scope: z.enum(ALLOWED_SCOPES).describe(
    `テスト実行スコープ。all: 全テスト, file: 特定ファイル, pattern: パターンマッチ`
  ),
  /** テスト対象（scope が file/pattern の場合必須） */
  target: z.string().optional().describe(
    'テスト対象。scope が file または pattern の場合必須'
  ),
  /** ハードタイムアウト（ミリ秒） */
  timeout_ms: z.number().int().positive().describe(
    'ハードタイムアウト（ミリ秒）。この時間を超えるとプロセスを強制終了'
  ),
  /** 無出力タイムアウト（ミリ秒） */
  no_output_timeout_ms: z.number().int().positive().describe(
    '無出力タイムアウト（ミリ秒）。この時間出力がないとプロセスを強制終了'
  ),
  /** 要約対象の末尾バイト数 */
  max_output_bytes: z.number().int().positive().describe(
    '要約対象の末尾バイト数。ログ抽出時にこのバイト数を対象とする'
  ),
  /** レポート出力ディレクトリ（相対パス、オプション） */
  report_dir: z.string().optional().describe(
    'レポート出力ディレクトリ（相対パス）。省略時はデフォルトパスを使用'
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
      description: 'タイムボックス付きでテストを実行する。固定テンプレート（flutter test等）のみ許可し、実行結果をレポートとして保存する。',
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
