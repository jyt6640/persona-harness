# Persona Harness LSP MCP Wrapper

Preview wrapper for a real external LSP MCP server.

This package does not implement a language server and does not relabel the PH code-nav preview as LSP. It registers a stable MCP process that:

- proxies to `@theupsider/lsp-mcp` only when the upstream package and a Java LSP binary (`jdtls` or `java-language-server`) are available;
- otherwise stays protocol-alive and exposes an honest `lsp_status` unavailable facade;
- never auto-installs Java language servers;
- makes no token-saving, navigation-benefit, product-quality, Codex support, or broad reliability claim.

Commands:

```bash
ph-lsp-mcp --help
ph-lsp-mcp capabilities --json
ph-lsp-mcp mcp
```
