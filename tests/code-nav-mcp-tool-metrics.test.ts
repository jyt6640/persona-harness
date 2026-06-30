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
  it("separates actual OpenCode tool-use calls from prose mentions", () => {
    const dir = createTempDir()
    const logPath = join(dir, "opencode.jsonl")
    writeFileSync(
      logPath,
      [
        JSON.stringify({
          type: "tool_use",
          part: { type: "tool", tool: "persona-harness-code-nav_search_text", callID: "call-1" },
        }),
        JSON.stringify({ part: { type: "tool", tool: "persona-harness-code-nav_status" } }),
        JSON.stringify({
          type: "text",
          part: { type: "text", text: "I used persona-harness-code-nav_status and persona-harness-code-nav_search_text." },
        }),
      ].join("\n"),
    )

    const result = runMetrics(logPath)
    const metrics = JSON.parse(result.stdout) as {
      canonicalToolMentionCounts: Record<string, number>
      canonicalToolCallCounts: Record<string, number>
      codeNavToolCallCount: number
      codeNavToolCallCounts: Record<string, number>
      codeNavToolMentionCount: number
      codeNavToolMentionCounts: Record<string, number>
      exactMentionNames: string[]
      exactToolNames: string[]
      recognizedToolNames: { namespaced: string[]; raw: string[] }
    }

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
    expect(metrics.codeNavToolCallCount).toBe(2)
    expect(metrics.codeNavToolCallCounts["persona-harness-code-nav_search_text"]).toBe(1)
    expect(metrics.codeNavToolCallCounts["persona-harness-code-nav_status"]).toBe(1)
    expect(metrics.canonicalToolCallCounts).toEqual({
      ast_grep_availability: 0,
      search_text: 1,
      status: 1,
    })
    expect(metrics.codeNavToolMentionCount).toBe(2)
    expect(metrics.codeNavToolMentionCounts["persona-harness-code-nav_search_text"]).toBe(1)
    expect(metrics.codeNavToolMentionCounts["persona-harness-code-nav_status"]).toBe(1)
    expect(metrics.canonicalToolMentionCounts).toEqual({
      ast_grep_availability: 0,
      search_text: 1,
      status: 1,
    })
    expect(metrics.exactToolNames).toEqual([
      "persona-harness-code-nav_search_text",
      "persona-harness-code-nav_status",
    ])
    expect(metrics.exactMentionNames).toEqual([
      "persona-harness-code-nav_search_text",
      "persona-harness-code-nav_status",
    ])
    expect(metrics.recognizedToolNames.namespaced).toContain("persona-harness-code-nav_ast_grep_availability")
    expect(metrics.recognizedToolNames.raw).toContain("search_text")
  })

  it("counts raw MCP tool names only when they appear in tool-name fields", () => {
    const dir = createTempDir()
    const logPath = join(dir, "opencode-raw.jsonl")
    writeFileSync(
      logPath,
      [
        JSON.stringify({ event: { toolName: "search_text" } }),
        JSON.stringify({ event: { tool_name: "ast_grep_availability" } }),
        JSON.stringify({ message: "status should not count when it is prose" }),
      ].join("\n"),
    )

    const result = runMetrics(logPath)
    const metrics = JSON.parse(result.stdout) as {
      canonicalToolCallCounts: Record<string, number>
      codeNavToolCallCount: number
      codeNavToolMentionCount: number
    }

    expect(result.status).toBe(0)
    expect(metrics.codeNavToolCallCount).toBe(2)
    expect(metrics.codeNavToolMentionCount).toBe(0)
    expect(metrics.canonicalToolCallCounts).toEqual({
      ast_grep_availability: 1,
      search_text: 1,
      status: 0,
    })
  })
})
