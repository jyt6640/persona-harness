import { spawnSync } from "node:child_process"
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"
import { isRecord } from "../src/config/jsonc.js"

const tempProjects: string[] = []
const lspCli = resolve("packages/lsp-mcp/bin/lsp-mcp.mjs")

function createTempProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-lsp-mcp-test-"))
  tempProjects.push(projectDir)
  return projectDir
}

function readJsonObject(path: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"))
  expect(isRecord(parsed)).toBe(true)
  return isRecord(parsed) ? parsed : {}
}

function runMcp(input: readonly Record<string, unknown>[], env: Readonly<Record<string, string | undefined>> = {}): string {
  const result = spawnSync(
    process.execPath,
    [lspCli, "mcp"],
    {
      env: { ...process.env, ...env },
      input: `${input.map((request) => JSON.stringify(request)).join("\n")}\n`,
      encoding: "utf8",
    },
  )
  expect(result.status).toBe(0)
  expect(result.stderr).toBe("")
  return result.stdout
}

function parseJsonLines(stdout: string): readonly Record<string, unknown>[] {
  return stdout
    .split(/\r?\n/u)
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const parsed: unknown = JSON.parse(line)
      expect(isRecord(parsed)).toBe(true)
      return isRecord(parsed) ? parsed : {}
    })
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("PH LSP MCP preview wrapper", () => {
  it("keeps the default backend bootstrap free of LSP registration", () => {
    const projectDir = createTempProject()

    const result = runPersonaCli(["bootstrap", "backend"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
      packageRoot: process.cwd(),
    })

    expect(result.status).toBe(0)
    const opencodeConfig = readJsonObject(join(projectDir, ".opencode", "opencode.json"))
    const mcp = isRecord(opencodeConfig.mcp) ? opencodeConfig.mcp : {}
    expect(mcp["persona-harness-lsp"]).toBeUndefined()
  })

  it("registers the LSP wrapper only when explicitly requested", () => {
    const projectDir = createTempProject()

    const result = runPersonaCli(["bootstrap", "backend", "--lsp-preview"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
      packageRoot: process.cwd(),
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("enabled LSP MCP preview")
    expect(result.stdout).toContain("opt-in only via --lsp-preview")
    expect(result.stdout).toContain("lsp_status unavailable facade")
    const opencodeConfig = readJsonObject(join(projectDir, ".opencode", "opencode.json"))
    const mcp = isRecord(opencodeConfig.mcp) ? opencodeConfig.mcp : {}
    expect(mcp["persona-harness-lsp"]).toMatchObject({
      type: "local",
      enabled: true,
      command: ["node", join(process.cwd(), "packages", "lsp-mcp", "bin", "lsp-mcp.mjs"), "mcp"],
    })
  })

  it("preserves existing OpenCode plugin, agent, and MCP entries when enabling LSP preview", () => {
    const projectDir = createTempProject()
    mkdirSync(join(projectDir, ".opencode"), { recursive: true })
    writeFileSync(
      join(projectDir, ".opencode", "opencode.json"),
      `${JSON.stringify(
        {
          agent: { reviewer: { mode: "subagent" } },
          custom: { unchanged: true },
          mcp: {
            existing: {
              type: "local",
              command: ["node", "existing.mjs"],
            },
          },
          plugin: ["./plugin.mjs"],
        },
        null,
        2,
      )}\n`,
    )

    const result = runPersonaCli(["bootstrap", "backend", "--lsp-preview"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
      packageRoot: process.cwd(),
    })

    expect(result.status).toBe(0)
    const opencodeConfig = readJsonObject(join(projectDir, ".opencode", "opencode.json"))
    expect(opencodeConfig.plugin).toEqual(["./plugin.mjs", join(process.cwd(), "dist", "index.js")])
    expect(opencodeConfig.agent).toEqual({ reviewer: { mode: "subagent" } })
    expect(opencodeConfig.custom).toEqual({ unchanged: true })
    const mcp = isRecord(opencodeConfig.mcp) ? opencodeConfig.mcp : {}
    expect(mcp.existing).toMatchObject({ type: "local", command: ["node", "existing.mjs"] })
    expect(mcp["persona-harness-lsp"]).toMatchObject({
      type: "local",
      enabled: true,
    })
  })

  it("keeps MCP alive with an unavailable facade when Java LSP is missing", () => {
    const output = runMcp(
      [
        {
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "0" } },
        },
        { jsonrpc: "2.0", method: "notifications/initialized", params: {} },
        { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
        { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "lsp_status", arguments: {} } },
      ],
      { PATH: "" },
    )

    const responses = parseJsonLines(output)
    expect(responses[0]).toMatchObject({ id: 1, result: { serverInfo: { name: "persona-harness-lsp", version: "1" } } })
    const toolsResponse = responses.find((response) => response.id === 2)
    const tools = isRecord(toolsResponse?.result) && Array.isArray(toolsResponse.result.tools) ? toolsResponse.result.tools : []
    expect(tools).toHaveLength(1)
    expect(tools[0]).toMatchObject({ name: "lsp_status" })
    const statusResponse = responses.find((response) => response.id === 3)
    const content = isRecord(statusResponse?.result) && Array.isArray(statusResponse.result.content) ? statusResponse.result.content[0] : undefined
    const text = isRecord(content) && typeof content.text === "string" ? content.text : "{}"
    const statusPayload: unknown = JSON.parse(text)
    expect(statusPayload).toMatchObject({
      lspBridge: {
        status: "unavailable",
      },
      tokenSavingsClaimed: false,
    })
  })

  it("can proxy to a real upstream only when an upstream and Java LSP command are explicitly available", () => {
    const projectDir = createTempProject()
    const fakeBin = join(projectDir, "bin")
    mkdirSync(fakeBin, { recursive: true })
    const fakeUpstream = join(fakeBin, "fake-lsp-mcp.mjs")
    const fakeJdtls = join(fakeBin, "jdtls")
    writeFileSync(
      fakeUpstream,
      [
        "#!/usr/bin/env node",
        "process.stdin.resume()",
        "process.stdin.on('end', () => {",
        "  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: 1, result: { serverInfo: { name: 'fake-upstream' } } })}\\n`)",
        "})",
      ].join("\n"),
    )
    writeFileSync(fakeJdtls, "#!/bin/sh\nexit 0\n")
    chmodSync(fakeUpstream, 0o755)
    chmodSync(fakeJdtls, 0o755)

    const result = spawnSync(
      process.execPath,
      [lspCli, "mcp"],
      {
        env: {
          ...process.env,
          PH_LSP_MCP_BIN: fakeUpstream,
          PH_LSP_JAVA_SERVER: fakeJdtls,
        },
        input: `${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} })}\n`,
        encoding: "utf8",
      },
    )

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
    expect(result.stdout).toContain("fake-upstream")
  })
})
