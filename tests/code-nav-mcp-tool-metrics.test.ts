import { spawnSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import process from "node:process"

import { afterEach, describe, expect, it } from "vitest"

const metricsScript = resolve("scripts/code-nav-mcp-tool-metrics.mjs")
const tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "persona-code-nav-metrics-test-"))
  tempDirs.push(dir)
  return dir
}

function runMetrics(inputPath: string) {
  return spawnSync(process.execPath, [metricsScript, inputPath], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  })
}

describe("code-nav MCP tool metrics parser", () => {
  it("counts OpenCode namespaced MCP tool names and raw MCP tool names", () => {
    const dir = createTempDir()
    const logPath = join(dir, "opencode.jsonl")
    writeFileSync(
      logPath,
      [
        JSON.stringify({ type: "tool", name: "persona-harness-code-nav_search_text", id: "call-1" }),
        JSON.stringify({ part: { type: "tool", tool: "persona-harness-code-nav_status" } }),
        JSON.stringify({ event: { toolName: "search_text" } }),
        JSON.stringify({ event: { tool_name: "ast_grep_availability" } }),
        JSON.stringify({ message: "status should not count when it is prose" }),
        "human log: persona-harness-code-nav_search_text completed",
      ].join("\n"),
    )

    const result = runMetrics(logPath)
    const metrics = JSON.parse(result.stdout) as {
      canonicalToolCallCounts: Record<string, number>
      codeNavToolCallCount: number
      codeNavToolCallCounts: Record<string, number>
      exactToolNames: string[]
      recognizedToolNames: { namespaced: string[]; raw: string[] }
    }

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
    expect(metrics.codeNavToolCallCount).toBe(5)
    expect(metrics.codeNavToolCallCounts["persona-harness-code-nav_search_text"]).toBe(2)
    expect(metrics.codeNavToolCallCounts["persona-harness-code-nav_status"]).toBe(1)
    expect(metrics.codeNavToolCallCounts.search_text).toBe(1)
    expect(metrics.codeNavToolCallCounts.ast_grep_availability).toBe(1)
    expect(metrics.canonicalToolCallCounts).toEqual({
      ast_grep_availability: 1,
      search_text: 3,
      status: 1,
    })
    expect(metrics.exactToolNames).toEqual([
      "ast_grep_availability",
      "persona-harness-code-nav_search_text",
      "persona-harness-code-nav_status",
      "search_text",
    ])
    expect(metrics.recognizedToolNames.namespaced).toContain("persona-harness-code-nav_ast_grep_availability")
    expect(metrics.recognizedToolNames.raw).toContain("search_text")
  })
})
