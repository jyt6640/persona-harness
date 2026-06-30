import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import process from "node:process"
import { spawnSync } from "node:child_process"

import { afterEach, describe, expect, it } from "vitest"

const codeNavCli = resolve("packages/lsp-tools-mcp/bin/code-nav-mcp.mjs")
const tempProjects: string[] = []

type JsonRecord = Readonly<Record<string, unknown>>

afterEach(() => {
  for (const projectDir of tempProjects.splice(0)) {
    rmSync(projectDir, { recursive: true, force: true })
  }
})

function createTempProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-code-nav-mcp-test-"))
  tempProjects.push(projectDir)
  return projectDir
}

function runCodeNav(args: readonly string[], options: { readonly cwd?: string; readonly pathEnv?: string } = {}) {
  return spawnSync(process.execPath, [codeNavCli, ...args], {
    cwd: options.cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      ...(options.pathEnv === undefined ? {} : { PATH: options.pathEnv }),
    },
    maxBuffer: 1024 * 1024,
  })
}

function runCodeNavMcp(input: string, options: { readonly cwd?: string; readonly pathEnv?: string } = {}) {
  return spawnSync(process.execPath, [codeNavCli, "mcp"], {
    cwd: options.cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      ...(options.pathEnv === undefined ? {} : { PATH: options.pathEnv }),
    },
    input,
    maxBuffer: 1024 * 1024,
  })
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseJsonRecord(stdout: string): JsonRecord {
  const parsed: unknown = JSON.parse(stdout)
  if (!isRecord(parsed)) {
    throw new Error("Expected JSON object")
  }
  return parsed
}

function arrayValue(value: unknown): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new Error("Expected JSON array")
  }
  return value
}

function stringArrayValue(value: unknown): readonly string[] {
  const values = arrayValue(value)
  if (!values.every((entry) => typeof entry === "string")) {
    throw new Error("Expected string array")
  }
  return values
}

function frameMcpRequest(request: JsonRecord): string {
  const body = JSON.stringify({ jsonrpc: "2.0", ...request })
  return `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`
}

function parseMcpBodies(transcript: string): readonly JsonRecord[] {
  const bodies: JsonRecord[] = []
  let cursor = 0
  while (cursor < transcript.length) {
    const headerEnd = transcript.indexOf("\r\n\r\n", cursor)
    if (headerEnd === -1) break
    const header = transcript.slice(cursor, headerEnd)
    const match = /^Content-Length: (?<length>\d+)$/m.exec(header)
    if (match?.groups?.length === undefined) {
      throw new Error(`Missing MCP Content-Length header: ${header}`)
    }
    const length = Number.parseInt(match.groups.length, 10)
    const bodyStart = headerEnd + 4
    const parsed: unknown = JSON.parse(transcript.slice(bodyStart, bodyStart + length))
    if (!isRecord(parsed)) {
      throw new Error("Expected MCP JSON-RPC object")
    }
    bodies.push(parsed)
    cursor = bodyStart + length
  }
  return bodies
}

function lineMcpRequest(request: JsonRecord): string {
  return `${JSON.stringify({ jsonrpc: "2.0", ...request })}\n`
}

function parseJsonLineBodies(transcript: string): readonly JsonRecord[] {
  return transcript.split(/\r?\n/u).filter(Boolean).map((line) => parseJsonRecord(line))
}

function resultRecord(response: JsonRecord): JsonRecord {
  if (!isRecord(response.result)) {
    throw new Error("Expected MCP result object")
  }
  return response.result
}

function mcpTextResult(response: JsonRecord): JsonRecord {
  const result = resultRecord(response)
  const content = arrayValue(result.content)
  const first = content[0]
  if (!isRecord(first) || typeof first.text !== "string") {
    throw new Error("Expected MCP text content")
  }
  return parseJsonRecord(first.text)
}

describe("PH code-nav MCP package preview", () => {
  it("prints honest help for the opt-in package surface", () => {
    const result = runCodeNav(["--help"])

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
    expect(result.stdout).toContain("Persona Harness code-nav MCP preview")
    expect(result.stdout).toContain("ph-code-nav-mcp capabilities --json")
    expect(result.stdout).toContain("no codegraph/indexer and no token-saving claim")
    expect(result.stdout).toContain("no OpenCode registration by default")
  })

  it("reports ast-grep unavailable honestly when no binary is on PATH", () => {
    const projectDir = createTempProject()
    const emptyBinDir = join(projectDir, "empty-bin")
    mkdirSync(emptyBinDir)

    const result = runCodeNav(["capabilities", "--json"], { pathEnv: emptyBinDir })
    const payload = parseJsonRecord(result.stdout)
    const capabilities = arrayValue(payload.capabilities).map((entry) => {
      if (!isRecord(entry)) {
        throw new Error("Expected capability object")
      }
      return entry
    })
    const astGrep = capabilities.find((entry) => entry.id === "ast-grep.availability")

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
    expect(payload.mcpProtocolServer).toBe(true)
    expect(payload.registeredWithOpenCode).toBe(false)
    expect(payload.tokenSavingsClaimed).toBe(false)
    expect(astGrep?.status).toBe("unavailable")
    expect(stringArrayValue(astGrep?.limitations)).toContain(
      "sg/ast-grep binary not found; structural ast-grep checks must skip instead of faking pass.",
    )
  })

  it("serves initialize and tools/list over framed MCP stdio", () => {
    const result = runCodeNavMcp([
      frameMcpRequest({
        id: 1,
        method: "initialize",
        params: {
          capabilities: {},
          clientInfo: { name: "persona-harness-test", version: "0.0.0" },
          protocolVersion: "2025-06-18",
        },
      }),
      frameMcpRequest({ id: 2, method: "tools/list", params: {} }),
    ].join(""))
    const responses = parseMcpBodies(result.stdout)
    const initializeResult = resultRecord(responses[0] ?? {})
    const listResult = resultRecord(responses[1] ?? {})
    const tools = arrayValue(listResult.tools).map((entry) => {
      if (!isRecord(entry)) {
        throw new Error("Expected MCP tool object")
      }
      return entry.name
    })

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
    expect(initializeResult.serverInfo).toEqual({ name: "persona-harness-code-nav", version: "1" })
    expect(tools).toEqual(["status", "search_text", "ast_grep_availability"])
  })

  it("serves initialize and tools/list over newline JSON-RPC stdio for OpenCode local MCP", () => {
    const result = runCodeNavMcp([
      lineMcpRequest({
        id: 1,
        method: "initialize",
        params: {
          capabilities: { roots: {} },
          clientInfo: { name: "opencode", version: "1.17.7" },
          protocolVersion: "2025-11-25",
        },
      }),
      lineMcpRequest({ id: 2, method: "tools/list", params: {} }),
    ].join(""))
    const responses = parseJsonLineBodies(result.stdout)
    const initializeResult = resultRecord(responses[0] ?? {})
    const listResult = resultRecord(responses[1] ?? {})
    const tools = arrayValue(listResult.tools).map((entry) => {
      if (!isRecord(entry)) {
        throw new Error("Expected MCP tool object")
      }
      return entry.name
    })

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
    expect(initializeResult.protocolVersion).toBe("2025-11-25")
    expect(initializeResult.serverInfo).toEqual({ name: "persona-harness-code-nav", version: "1" })
    expect(tools).toEqual(["status", "search_text", "ast_grep_availability"])
  })

  it("serves status, search_text, and ast_grep_availability tool calls over MCP stdio", () => {
    const projectDir = createTempProject()
    const sourceDir = join(projectDir, "src", "main", "java", "com", "example")
    mkdirSync(sourceDir, { recursive: true })
    writeFileSync(join(sourceDir, "TodoController.java"), "class TodoController {}\n")
    const emptyBinDir = join(projectDir, "empty-bin")
    mkdirSync(emptyBinDir)

    const result = runCodeNavMcp([
      frameMcpRequest({ id: 1, method: "tools/call", params: { name: "status", arguments: {} } }),
      frameMcpRequest({
        id: 2,
        method: "tools/call",
        params: { name: "search_text", arguments: { query: "Controller", root: "src/main/java" } },
      }),
      frameMcpRequest({ id: 3, method: "tools/call", params: { name: "ast_grep_availability", arguments: {} } }),
    ].join(""), { cwd: projectDir, pathEnv: emptyBinDir })
    const responses = parseMcpBodies(result.stdout)
    const status = mcpTextResult(responses[0] ?? {})
    const search = mcpTextResult(responses[1] ?? {})
    const availability = mcpTextResult(responses[2] ?? {})
    const matches = arrayValue(search.matches).map((entry) => {
      if (!isRecord(entry)) {
        throw new Error("Expected search match object")
      }
      return entry
    })

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
    expect(status.mcpProtocolServer).toBe(true)
    expect(status.registeredWithOpenCode).toBe(false)
    expect(status.tokenSavingsClaimed).toBe(false)
    expect(matches).toEqual([
      expect.objectContaining({
        path: "src/main/java/com/example/TodoController.java",
        line: 1,
        preview: "class TodoController {}",
      }),
    ])
    expect(availability.status).toBe("unavailable")
  })

  it("runs a bounded filesystem search without claiming semantic codegraph behavior", () => {
    const projectDir = createTempProject()
    const sourceDir = join(projectDir, "src", "main", "java", "com", "example")
    mkdirSync(sourceDir, { recursive: true })
    writeFileSync(join(sourceDir, "TodoController.java"), "class TodoController {}\n")

    const result = runCodeNav(["search", "--json", "Controller", "src/main/java"], { cwd: projectDir })
    const payload = parseJsonRecord(result.stdout)
    const matches = arrayValue(payload.matches).map((entry) => {
      if (!isRecord(entry)) {
        throw new Error("Expected match object")
      }
      return entry
    })

    expect(result.status).toBe(0)
    expect(payload.status).toBe("checked")
    expect(matches).toEqual([
      expect.objectContaining({
        path: "src/main/java/com/example/TodoController.java",
        line: 1,
        preview: "class TodoController {}",
      }),
    ])
    expect(stringArrayValue(payload.limitations)).toContain("Filesystem text search only; not a semantic symbol graph.")
  })

  it("includes exactly the preview package surface in the root package files list", () => {
    const packageJson = parseJsonRecord(readFileSync(resolve("package.json"), "utf8"))
    const files = stringArrayValue(packageJson.files)

    expect(files).toEqual(expect.arrayContaining([
      "packages/lsp-tools-mcp/package.json",
      "packages/lsp-tools-mcp/README.md",
      "packages/lsp-tools-mcp/bin",
      "packages/lsp-tools-mcp/lib",
    ]))
  })
})
