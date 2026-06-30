# Persona Harness Code-Nav MCP Preview

This is a minimal, opt-in package surface for PH-owned code navigation probes.
It is not a codegraph replacement, does not build an index, and does not claim
token savings.

Current command:

```bash
node packages/lsp-tools-mcp/bin/code-nav-mcp.mjs --help
node packages/lsp-tools-mcp/bin/code-nav-mcp.mjs capabilities --json
node packages/lsp-tools-mcp/bin/code-nav-mcp.mjs search --json Controller src/main/java
node packages/lsp-tools-mcp/bin/code-nav-mcp.mjs mcp
```

The preview reports `sg`/`ast-grep` availability honestly and falls back to a
bounded filesystem text search capability. The `mcp` mode serves a minimal
stdio JSON-RPC MCP surface for `status`, `search_text`, and
`ast_grep_availability`.

It is not registered into `.opencode/opencode.json` by default. It is not a
codegraph replacement and does not claim token savings.
