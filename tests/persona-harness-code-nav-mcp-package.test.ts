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
    expect(payload.mcpProtocolServer).toBe(false)
    expect(payload.registeredWithOpenCode).toBe(false)
    expect(payload.tokenSavingsClaimed).toBe(false)
    expect(astGrep?.status).toBe("unavailable")
    expect(stringArrayValue(astGrep?.limitations)).toContain(
      "sg/ast-grep binary not found; structural ast-grep checks must skip instead of faking pass.",
    )
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
    ]))
  })
})
