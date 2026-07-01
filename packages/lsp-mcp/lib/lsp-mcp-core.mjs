import { spawn } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { delimiter, dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { runUnavailableMcpServer } from "./lsp-mcp-stdio.mjs"

export const VERSION = 1
export const SERVER_NAME = "persona-harness-lsp"

const requireFromHere = createRequire(import.meta.url)

export async function main(argv, runtime) {
  if (argv.length === 0 || argv.includes("--help") || argv[0] === "help") {
    runtime.stdout.write(`${usage()}\n`)
    return 0
  }
  if (argv[0] === "capabilities") {
    writeJsonLine(runtime.stdout, capabilities(runtime.env))
    return 0
  }
  if (argv[0] === "mcp") {
    const resolution = resolveLspBridge(runtime.env)
    if (resolution.kind === "available") {
      return await proxyToUpstream(resolution, runtime)
    }
    await runUnavailableMcpServer(runtime, resolution, {
      serverName: SERVER_NAME,
      statusPayload: capabilities,
      version: VERSION,
    })
    return 0
  }
  runtime.stderr.write(`Unknown command: ${argv[0]}\n`)
  runtime.stderr.write(`${usage()}\n`)
  return 1
}

function usage() {
  return [
    "Persona Harness LSP MCP wrapper preview",
    "",
    "Usage:",
    "  ph-lsp-mcp --help",
    "  ph-lsp-mcp capabilities --json",
    "  ph-lsp-mcp mcp",
    "",
    "Scope:",
    "- opt-in only via ph bootstrap backend --lsp-preview",
    "- proxies to a real external LSP MCP only when upstream and Java LSP binaries are available",
    "- otherwise keeps MCP alive with an honest lsp_status unavailable facade",
    "- no auto-install, no code-nav relabeling, no token-saving or product-quality claim",
  ].join("\n")
}

export function capabilities(env) {
  const resolution = resolveLspBridge(env)
  return {
    schemaVersion: VERSION,
    name: "persona-harness-lsp-mcp-wrapper",
    mode: "external-lsp-wrapper",
    mcpProtocolServer: true,
    registeredWithOpenCode: false,
    tokenSavingsClaimed: false,
    lspBridge: bridgeStatus(resolution),
    limitations: [
      "Preview wrapper only; not PH-owned LSP implementation.",
      "Java/Spring requires an explicit Java LSP binary such as jdtls or java-language-server.",
      "PH does not auto-install language servers or claim navigation/token benefit.",
    ],
  }
}

function bridgeStatus(resolution) {
  if (resolution.kind === "available") {
    return {
      status: "available",
      upstream: resolution.upstream.source,
      upstreamCommand: resolution.upstream.command,
      javaLsp: resolution.javaLsp.source,
      javaLspCommand: resolution.javaLsp.command,
    }
  }
  return {
    status: "unavailable",
    reason: resolution.reason,
    upstream: resolution.upstream === undefined ? undefined : bridgeDependencyStatus(resolution.upstream),
    javaLsp: resolution.javaLsp === undefined ? undefined : bridgeDependencyStatus(resolution.javaLsp),
  }
}

function bridgeDependencyStatus(dependency) {
  if (dependency.kind === "available") {
    return { status: "available", source: dependency.source, command: dependency.command }
  }
  return { status: "unavailable", reason: dependency.reason }
}

export function resolveLspBridge(env) {
  const upstream = resolveUpstream(env)
  const javaLsp = resolveJavaLsp(env)
  if (upstream.kind !== "available") {
    return { kind: "unavailable", reason: upstream.reason, upstream, javaLsp }
  }
  if (javaLsp.kind !== "available") {
    return { kind: "unavailable", reason: javaLsp.reason, upstream, javaLsp }
  }
  return { kind: "available", upstream, javaLsp }
}

function resolveUpstream(env) {
  const envCommand = env.PH_LSP_MCP_BIN
  if (envCommand !== undefined && envCommand.trim() !== "") {
    const resolved = resolveCommand(envCommand, env)
    return resolved.kind === "available"
      ? { kind: "available", source: "PH_LSP_MCP_BIN", command: [resolved.command] }
      : { kind: "unavailable", reason: `PH_LSP_MCP_BIN not found: ${envCommand}` }
  }
  const packaged = resolvePackagedUpstream()
  if (packaged !== undefined) return packaged
  const pathCommand = lookupExecutable("lsp-mcp", env)
  if (pathCommand !== undefined) {
    return { kind: "available", source: "PATH", command: [pathCommand] }
  }
  return { kind: "unavailable", reason: "@theupsider/lsp-mcp not found. Install optional dependencies or set PH_LSP_MCP_BIN." }
}

function resolvePackagedUpstream() {
  try {
    const packageJsonPath = requireFromHere.resolve("@theupsider/lsp-mcp/package.json")
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"))
    const bin = packageJson?.bin?.["lsp-mcp"]
    if (typeof bin !== "string") return undefined
    return {
      kind: "available",
      source: "@theupsider/lsp-mcp optionalDependency",
      command: [process.execPath, resolve(dirname(packageJsonPath), bin)],
    }
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "MODULE_NOT_FOUND") {
      return undefined
    }
    throw error
  }
}

function resolveJavaLsp(env) {
  const envCommand = env.PH_LSP_JAVA_SERVER
  if (envCommand !== undefined && envCommand.trim() !== "") {
    const resolved = resolveCommand(envCommand, env)
    return resolved.kind === "available"
      ? { kind: "available", source: "PH_LSP_JAVA_SERVER", command: resolved.command }
      : { kind: "unavailable", reason: `PH_LSP_JAVA_SERVER not found: ${envCommand}` }
  }
  for (const candidate of javaLspCandidateNames()) {
    const command = lookupExecutable(candidate, env)
    if (command !== undefined) {
      return { kind: "available", source: "PATH", command }
    }
  }
  return { kind: "unavailable", reason: "Java LSP binary not found. Install jdtls or set PH_LSP_JAVA_SERVER." }
}

function javaLspCandidateNames() {
  return process.platform === "win32" ? ["jdtls.cmd", "jdtls.exe", "jdtls", "java-language-server.cmd", "java-language-server.exe", "java-language-server"] : ["jdtls", "java-language-server"]
}

function resolveCommand(command, env) {
  if (command.includes("/") || command.includes("\\")) {
    const absolute = resolve(command)
    return existsSync(absolute) ? { kind: "available", command: absolute } : { kind: "unavailable" }
  }
  const pathCommand = lookupExecutable(command, env)
  return pathCommand === undefined ? { kind: "unavailable" } : { kind: "available", command: pathCommand }
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

async function proxyToUpstream(resolution, runtime) {
  const [command, ...args] = resolution.upstream.command
  const child = spawn(command, args, {
    cwd: runtime.cwd,
    env: runtime.env,
    stdio: ["pipe", "pipe", "pipe"],
  })
  runtime.stdin.pipe(child.stdin)
  child.stdout.pipe(runtime.stdout)
  child.stderr.pipe(runtime.stderr)
  return await new Promise((resolveCode) => {
    child.on("error", (error) => {
      runtime.stderr.write(`Failed to start LSP MCP upstream: ${error.message}\n`)
      resolveCode(1)
    })
    child.on("close", (code) => {
      resolveCode(code ?? 0)
    })
  })
}

function writeJsonLine(output, value) {
  output.write(`${JSON.stringify(value)}\n`)
}
