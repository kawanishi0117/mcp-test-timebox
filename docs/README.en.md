# mcp-test-timebox

[![npm version](https://badge.fury.io/js/mcp-test-timebox.svg)](https://www.npmjs.com/package/mcp-test-timebox)

English | [日本語](../README.md)

An MCP server that ensures AI agents always get test results back, even when tests hang.

## The Problem

When AI agents run tests:

- Tests hang and the agent waits forever
- Interactive prompts block execution
- Output is too large to process

This MCP server **runs tests with timeouts** and always returns structured results.

## Setup

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

## MCP Tool

### run_test

Runs tests with a timebox.

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

#### Parameters

| Name | Required | Description |
|------|:--------:|-------------|
| `runner` | ✓ | `flutter` / `vitest` / `pytest` / `jest` |
| `scope` | ✓ | `all` / `file` / `pattern` |
| `target` | △ | Required when scope is `file` or `pattern` |
| `timeout_ms` | ✓ | Hard timeout in milliseconds |
| `no_output_timeout_ms` | ✓ | Timeout when no output is produced |
| `max_output_bytes` | ✓ | Log size for summary extraction |
| `cwd` | ✓ | Project path (absolute) |

#### Response

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

| status | Meaning |
|--------|---------|
| `pass` | Tests passed |
| `fail` | Tests failed |
| `timeout` | Hard timeout exceeded |
| `no_output` | No output timeout exceeded |
| `error` | Execution error |

## Supported Runners

| Runner | Command |
|--------|---------|
| `flutter` | `flutter test` |
| `vitest` | `npx vitest run` |
| `pytest` | `pytest` |
| `jest` | `npx jest` |

## Generated Files

Reports are generated for each test run (keeps latest 5):

```
.cache/mcp-test-timebox/reports/<timestamp>/
├── raw.log        # Complete log
├── summary.md     # Human-readable summary
└── summary.json   # Machine-readable data
```

## Adding Custom Runners

Add a file to `src/runners/` and register it in `index.ts`.

See [src/runners/](../src/runners/) for details.

## Development

```bash
npm install
npm run build
npm test
```

## Feedback

- Bug reports: [Issues](https://github.com/kawanishi0117/mcp-test-timebox/issues)
- Feature requests and improvements are welcome

## License

MIT
