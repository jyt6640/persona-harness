import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { delimiter, join, relative, resolve } from "node:path"

export const VERSION = 1
export const SERVER_NAME = "persona-harness-code-nav"

const MAX_FILE_BYTES = 512 * 1024
const MAX_RESULTS = 50
const IGNORED_DIRS = new Set([
  ".git",
  ".opencode",
  ".persona/evidence",
  "build",
  "coverage",
  "dist",
  "node_modules",
])

export async function main(argv, runtime) {
  if (argv.length === 0 || argv.includes("--help") || argv[0] === "help") {
    runtime.stdout.write(`${usage()}\n`)
    return 0
  }
  if (argv[0] === "capabilities") {
    jsonLine(runtime.stdout, capabilities(runtime.env))
    return 0
  }
  if (argv[0] === "search") {
    const args = argv.filter((arg) => arg !== "--json")
    const query = args[1]
    if (query === undefined || query.trim() === "") {
      runtime.stderr.write("Missing search query.\n")
      runtime.stderr.write(`${usage()}\n`)
      return 1
    }
    jsonLine(runtime.stdout, textSearch(query, args[2], runtime.cwd))
    return 0
  }
  if (argv[0] === "mcp") {
    const { runMcpServer } = await import("./code-nav-mcp.mjs")
    await runMcpServer(runtime)
    return 0
  }
  runtime.stderr.write(`Unknown command: ${argv[0]}\n`)
  runtime.stderr.write(`${usage()}\n`)
  return 1
}

function usage() {
  return [
    "Persona Harness code-nav MCP preview",
    "",
    "Usage:",
    "  ph-code-nav-mcp --help",
    "  ph-code-nav-mcp capabilities --json",
    "  ph-code-nav-mcp search --json <query> [root]",
    "  ph-code-nav-mcp mcp",
    "",
    "Scope:",
    "- opt-in package surface only; no OpenCode registration by default",
    "- minimal stdio MCP protocol server; no codegraph/indexer and no token-saving claim",
    "- reports unavailable tools honestly instead of faking pass",
  ].join("\n")
}

function jsonLine(output, value) {
  output.write(`${JSON.stringify(value, null, 2)}\n`)
}

function lookupExecutable(candidate, env) {
  for (const dir of (env.PATH ?? "").split(delimiter)) {
    if (dir.trim() === "") continue
    const executable = join(dir, candidate)
    if (existsSync(executable)) return executable
    if (process.platform === "win32") {
      for (const extension of [".cmd", ".exe", ".ps1"]) {
        const windowsExecutable = join(dir, `${candidate}${extension}`)
        if (existsSync(windowsExecutable)) return windowsExecutable
      }
    }
  }
  return undefined
}

export function astGrepCapability(env) {
  const executable = lookupExecutable("sg", env) ?? lookupExecutable("ast-grep", env)
  if (executable === undefined) {
    return {
      id: "ast-grep.availability",
      status: "unavailable",
      source: "PATH",
      limitations: ["sg/ast-grep binary not found; structural ast-grep checks must skip instead of faking pass."],
    }
  }
  return {
    id: "ast-grep.availability",
    status: "available",
    command: executable,
    source: "PATH",
    limitations: ["Availability only; rule execution belongs to PH ast-grep convention runner."],
  }
}

export function capabilities(env) {
  return {
    schemaVersion: VERSION,
    name: "persona-harness-code-nav-mcp-preview",
    mode: "preview",
    mcpProtocolServer: true,
    registeredWithOpenCode: false,
    tokenSavingsClaimed: false,
    capabilities: [
      astGrepCapability(env),
      {
        id: "filesystem.text-search",
        status: "available",
        source: "filesystem",
        limitations: [
          "Bounded text search only; no symbol graph, no indexer, no OMO codegraph parity.",
          `Skips files larger than ${MAX_FILE_BYTES} bytes and returns at most ${MAX_RESULTS} matches.`,
        ],
      },
    ],
  }
}

function shouldSkipPath(rootDir, filePath) {
  const normalized = relative(rootDir, filePath).replace(/\\/g, "/")
  if (normalized === "") return false
  const parts = normalized.split("/")
  for (let index = 0; index < parts.length; index += 1) {
    const segment = parts.slice(0, index + 1).join("/")
    if (IGNORED_DIRS.has(segment) || IGNORED_DIRS.has(parts[index])) return true
  }
  return false
}

function collectFiles(rootDir) {
  const files = []
  function visit(current) {
    if (shouldSkipPath(rootDir, current)) return
    const stat = statSync(current)
    if (stat.isDirectory()) {
      for (const entry of readdirSync(current).sort()) visit(join(current, entry))
      return
    }
    if (!stat.isFile() || stat.size > MAX_FILE_BYTES) return
    files.push(current)
  }
  visit(rootDir)
  return files
}

export function textSearch(query, rootArg, cwd) {
  const rootDir = resolve(cwd, rootArg ?? ".")
  if (!existsSync(rootDir)) {
    return {
      schemaVersion: VERSION,
      query,
      root: rootArg ?? ".",
      status: "unavailable",
      matches: [],
      limitations: [`search root does not exist: ${rootArg ?? "."}`],
    }
  }
  const matches = []
  const loweredQuery = query.toLowerCase()
  for (const filePath of collectFiles(rootDir)) {
    if (matches.length >= MAX_RESULTS) break
    const source = readFileSync(filePath, "utf8")
    const lines = source.split(/\r?\n/u)
    for (const [lineIndex, line] of lines.entries()) {
      if (!line.toLowerCase().includes(loweredQuery)) continue
      matches.push({
        path: relative(cwd, filePath).replace(/\\/g, "/"),
        line: lineIndex + 1,
        preview: line.trim().slice(0, 160),
      })
      if (matches.length >= MAX_RESULTS) break
    }
  }
  return {
    schemaVersion: VERSION,
    query,
    root: rootArg ?? ".",
    status: "checked",
    matches,
    limitations: [
      "Filesystem text search only; not a semantic symbol graph.",
      `Maximum ${MAX_RESULTS} matches.`,
    ],
  }
}

export function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
