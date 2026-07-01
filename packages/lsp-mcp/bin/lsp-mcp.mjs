#!/usr/bin/env node
import { main } from "../lib/lsp-mcp-core.mjs"

process.exitCode = await main(process.argv.slice(2), {
  cwd: process.cwd(),
  env: process.env,
  stderr: process.stderr,
  stdin: process.stdin,
  stdout: process.stdout,
})
