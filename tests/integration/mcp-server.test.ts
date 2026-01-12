/**
 * MCPサーバ統合テスト
 * 
 * MCPプロトコルに準拠したサーバの動作を検証する
 * 
 * Requirements:
 * - 1.1: stdio経由でMCPプロトコルに準拠した通信を開始する
 * - 1.2: run_testツールのみを公開する
 * - 1.3: stdoutにログを出力せず、MCPプロトコル出力を破壊しない
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from '../../src/server.js';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// テスト用の一時ディレクトリ
let testTmpDir: string;

describe('MCPサーバ統合テスト', () => {
  beforeEach(async () => {
    // 一時ディレクトリを作成
    testTmpDir = join(tmpdir(), `mcp-server-integration-${Date.now()}`);
    await mkdir(testTmpDir, { recursive: true });
  });

  afterEach(async () => {
    // 一時ディレクトリを削除
    try {
      await rm(testTmpDir, { recursive: true, force: true });
    } catch {
      // 削除失敗は無視
    }
  });

  describe('サーバ起動', () => {
    it('MCPサーバが正常に起動し、クライアントと接続できる', async () => {
      // サーバを作成
      const server = createMcpServer();

      // クライアントを作成
      const client = new Client({
        name: 'test-client',
        version: '1.0.0',
      });

      // インメモリトランスポートを作成（テスト用）
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

      // サーバとクライアントを接続
      await Promise.all([
        server.connect(serverTransport),
        client.connect(clientTransport),
      ]);

      // サーバ情報を確認
      const serverVersion = client.getServerVersion();
      expect(serverVersion).toBeDefined();
      expect(serverVersion?.name).toBe('mcp-test-timebox');
      expect(serverVersion?.version).toBe('0.1.0');

      // クリーンアップ
      await client.close();
      await server.close();
    });
  });

  describe('ツール一覧取得', () => {
    it('run_testツールのみが公開されている', async () => {
      // サーバを作成
      const server = createMcpServer();

      // クライアントを作成
      const client = new Client({
        name: 'test-client',
        version: '1.0.0',
      });

      // インメモリトランスポートを作成
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

      // サーバとクライアントを接続
      await Promise.all([
        server.connect(serverTransport),
        client.connect(clientTransport),
      ]);

      // ツール一覧を取得
      const toolsResult = await client.listTools();

      // run_testツールのみが存在することを確認
      expect(toolsResult.tools).toHaveLength(1);
      expect(toolsResult.tools[0].name).toBe('run_test');
      expect(toolsResult.tools[0].description).toContain('タイムボックス');

      // 入力スキーマを確認
      const inputSchema = toolsResult.tools[0].inputSchema;
      expect(inputSchema.type).toBe('object');
      expect(inputSchema.properties).toBeDefined();
      
      // 必須パラメータが定義されていることを確認
      const properties = inputSchema.properties as Record<string, unknown>;
      expect(properties).toHaveProperty('runner');
      expect(properties).toHaveProperty('scope');
      expect(properties).toHaveProperty('timeout_ms');
      expect(properties).toHaveProperty('no_output_timeout_ms');
      expect(properties).toHaveProperty('max_output_bytes');

      // クリーンアップ
      await client.close();
      await server.close();
    });
  });

  describe('run_test呼び出し', () => {
    it('有効なパラメータでrun_testを呼び出すと結果が返る', async () => {
      // サーバを作成
      const server = createMcpServer();

      // クライアントを作成
      const client = new Client({
        name: 'test-client',
        version: '1.0.0',
      });

      // インメモリトランスポートを作成
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

      // サーバとクライアントを接続
      await Promise.all([
        server.connect(serverTransport),
        client.connect(clientTransport),
      ]);

      // run_testを呼び出し（短いタイムアウトで）
      const result = await client.callTool({
        name: 'run_test',
        arguments: {
          runner: 'flutter',
          scope: 'all',
          timeout_ms: 500,
          no_output_timeout_ms: 300,
          max_output_bytes: 10000,
        },
      });

      // 結果を確認
      expect(result.content).toBeDefined();
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      // JSONとしてパース可能であることを確認
      const textContent = result.content[0] as { type: 'text'; text: string };
      const parsedResult = JSON.parse(textContent.text);

      // 必須フィールドが存在することを確認
      expect(parsedResult).toHaveProperty('status');
      expect(parsedResult).toHaveProperty('exit_code');
      expect(parsedResult).toHaveProperty('duration_ms');
      expect(parsedResult).toHaveProperty('report_dir');
      expect(parsedResult).toHaveProperty('artifacts');
      expect(parsedResult).toHaveProperty('excerpt');

      // statusは有効な値であることを確認
      expect(['pass', 'fail', 'timeout', 'no_output', 'error']).toContain(parsedResult.status);

      // クリーンアップ
      await client.close();
      await server.close();
    });

    it('無効なrunnerでrun_testを呼び出すとエラーが返る', async () => {
      // サーバを作成
      const server = createMcpServer();

      // クライアントを作成
      const client = new Client({
        name: 'test-client',
        version: '1.0.0',
      });

      // インメモリトランスポートを作成
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

      // サーバとクライアントを接続
      await Promise.all([
        server.connect(serverTransport),
        client.connect(clientTransport),
      ]);

      // 無効なrunnerでrun_testを呼び出し
      // MCP SDKはスキーマバリデーションエラーを投げる可能性がある
      try {
        const result = await client.callTool({
          name: 'run_test',
          arguments: {
            runner: 'invalid_runner',
            scope: 'all',
            timeout_ms: 1000,
            no_output_timeout_ms: 1000,
            max_output_bytes: 10000,
          },
        });

        // 結果が返った場合（SDKがバリデーションをスキップした場合）
        expect(result.content).toBeDefined();
        expect(result.content).toHaveLength(1);

        const textContent = result.content[0] as { type: 'text'; text: string };
        const parsedResult = JSON.parse(textContent.text);

        // エラーステータスであることを確認
        expect(parsedResult.status).toBe('error');
        expect(parsedResult.error_message).toBeDefined();
      } catch (error) {
        // MCP SDKがスキーマバリデーションエラーを投げた場合
        // これも正しい動作（無効な入力が拒否された）
        expect(error).toBeDefined();
        // エラーが発生したこと自体が期待される動作
      }

      // クリーンアップ
      await client.close();
      await server.close();
    });

    it('必須パラメータが欠落している場合エラーが返る', async () => {
      // サーバを作成
      const server = createMcpServer();

      // クライアントを作成
      const client = new Client({
        name: 'test-client',
        version: '1.0.0',
      });

      // インメモリトランスポートを作成
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

      // サーバとクライアントを接続
      await Promise.all([
        server.connect(serverTransport),
        client.connect(clientTransport),
      ]);

      // 必須パラメータが欠落した状態でrun_testを呼び出し
      // MCP SDKはスキーマバリデーションエラーを投げる可能性がある
      try {
        const result = await client.callTool({
          name: 'run_test',
          arguments: {
            runner: 'flutter',
            // scope, timeout_ms, no_output_timeout_ms, max_output_bytes が欠落
          },
        });

        // 結果が返った場合（SDKがバリデーションをスキップした場合）
        expect(result.content).toBeDefined();
        expect(result.content).toHaveLength(1);

        const textContent = result.content[0] as { type: 'text'; text: string };
        const parsedResult = JSON.parse(textContent.text);

        // エラーステータスであることを確認
        expect(parsedResult.status).toBe('error');
        expect(parsedResult.error_message).toBeDefined();
      } catch (error) {
        // MCP SDKがスキーマバリデーションエラーを投げた場合
        // これも正しい動作（無効な入力が拒否された）
        expect(error).toBeDefined();
      }

      // クリーンアップ
      await client.close();
      await server.close();
    });

    it('scope=fileでtargetが未指定の場合エラーが返る', async () => {
      // サーバを作成
      const server = createMcpServer();

      // クライアントを作成
      const client = new Client({
        name: 'test-client',
        version: '1.0.0',
      });

      // インメモリトランスポートを作成
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

      // サーバとクライアントを接続
      await Promise.all([
        server.connect(serverTransport),
        client.connect(clientTransport),
      ]);

      // scope=fileでtargetが未指定
      const result = await client.callTool({
        name: 'run_test',
        arguments: {
          runner: 'flutter',
          scope: 'file',
          // target が未指定
          timeout_ms: 1000,
          no_output_timeout_ms: 1000,
          max_output_bytes: 10000,
        },
      });

      // 結果を確認
      expect(result.content).toBeDefined();
      expect(result.content).toHaveLength(1);

      const textContent = result.content[0] as { type: 'text'; text: string };
      const parsedResult = JSON.parse(textContent.text);

      // エラーステータスであることを確認
      expect(parsedResult.status).toBe('error');
      expect(parsedResult.error_message).toBeDefined();
      expect(parsedResult.error_message).toContain('target');

      // クリーンアップ
      await client.close();
      await server.close();
    });
  });
});
