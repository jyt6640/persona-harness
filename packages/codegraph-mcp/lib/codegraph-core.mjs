import { spawn } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { delimiter, dirname, join } from "node:path"

export const SERVER_NAME = "codegraph"
export const VERSION = 1

const requireFromHere = createRequire(import.meta.url)

export async function main(argv, runtime) {
  if (argv.length === 0 || argv.includes("--help") || argv[0] === "help") {
    runtime.stdout.write(`${usage()}\n`)
    return 0
  }
  if (argv[0] === "capabilities") {
    writeJson(runtime.stdout, capabilities(runtime.env))
    return 0
  }
  if (argv[0] === "mcp") {
    return runMcp(runtime)
  }
  runtime.stderr.write(`Unknown command: ${argv[0]}\n`)
  runtime.stderr.write(`${usage()}\n`)
  return 1
}

function usage() {
  return [
    "Persona Harness external CodeGraph MCP wrapper",
    "",
    "Usage:",
    "  ph-codegraph-mcp --help",
    "  ph-codegraph-mcp capabilities --json",
    "  ph-codegraph-mcp mcp",
    "",
    "Scope:",
    "- opt-in only for OpenCode bootstrap via `ph bootstrap backend --codegraph-preview`",
    "- wraps external @colbymchenry/codegraph or a PATH/PH_CODEGRAPH_BIN binary",
    "- if CodeGraph is unavailable, serves a status-only MCP facade instead of crashing",
    "- no PH-owned codegraph, OMO replacement, or token-saving claim",
    "- does not run codegraph init; create .codegraph intentionally when you want an index",
  ].join("\n")
}

function writeJson(output, value) {
  output.write(`${JSON.stringify(value, null, 2)}\n`)
}

export function capabilities(env) {
  const resolution = resolveCodegraph(env)
  return {
    schemaVersion: VERSION,
    name: "persona-harness-codegraph-wrapper",
    mode: "external-codegraph-wrapper",
    mcpProtocolServer: true,
    registeredWithOpenCodeByDefault: false,
    optInFlag: "--codegraph-preview",
    tokenSavingsClaimed: false,
    codegraph: resolution.kind === "available"
      ? {
          status: "available",
          source: resolution.source,
          command: [...resolution.command, ...resolution.argsPrefix, "serve", "--mcp"],
        }
      : {
          status: "unavailable",
          source: resolution.source,
          reason: resolution.reason,
        },
    limitations: [
      "External optional CodeGraph integration; PH does not own or certify CodeGraph.",
      "No token-saving, provider-token, or product-efficacy claim.",
      "PH wrapper does not run codegraph init or auto-create .codegraph.",
    ],
  }
}

function resolveCodegraph(env) {
  if (typeof env.PH_CODEGRAPH_BIN === "string" && env.PH_CODEGRAPH_BIN.trim() !== "") {
    if (existsSync(env.PH_CODEGRAPH_BIN)) {
      return { kind: "available", source: "PH_CODEGRAPH_BIN", command: [env.PH_CODEGRAPH_BIN], argsPrefix: [] }
    }
    return {
      kind: "unavailable",
      source: "PH_CODEGRAPH_BIN",
      reason: `PH_CODEGRAPH_BIN does not exist: ${env.PH_CODEGRAPH_BIN}`,
    }
  }

  const packaged = packagedCodegraphCommand()
  if (packaged !== undefined) return packaged

  const pathBinary = pathCodegraphCommand(env)
  if (pathBinary !== undefined) return pathBinary

  return {
    kind: "unavailable",
    source: "package-or-PATH",
    reason: "CodeGraph binary not found. Install @colbymchenry/codegraph or set PH_CODEGRAPH_BIN.",
  }
}

function packagedCodegraphCommand() {
  try {
    const packageJsonPath = requireFromHere.resolve("@colbymchenry/codegraph/package.json")
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"))
    const bin = packageJson?.bin?.codegraph
    if (typeof bin !== "string" || bin.trim() === "") return undefined
    const script = join(dirname(packageJsonPath), bin)
    if (!existsSync(script)) return undefined
    return { kind: "available", source: "@colbymchenry/codegraph optionalDependency", command: [process.execPath, script], argsPrefix: [] }
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "MODULE_NOT_FOUND") return undefined
    return undefined
  }
}

function pathCodegraphCommand(env) {
  for (const dir of (env.PATH ?? "").split(delimiter)) {
    if (dir.trim() === "") continue
    for (const candidate of codegraphCandidateNames()) {
      const command = join(dir, candidate)
      if (existsSync(command)) return { kind: "available", source: "PATH", command: [command], argsPrefix: [] }
    }
  }
  return undefined
}

function codegraphCandidateNames() {
  return process.platform === "win32" ? ["codegraph.cmd", "codegraph.exe", "codegraph"] : ["codegraph"]
}

function runMcp(runtime) {
  const resolution = resolveCodegraph(runtime.env)
  if (resolution.kind === "unavailable") {
    return runUnavailableMcpServer(runtime, resolution)
  }
  return runCodegraphProcess(runtime, resolution)
}

function runCodegraphProcess(runtime, resolution) {
  return new Promise((resolve) => {
    const child = spawn(resolution.command[0], [...resolution.command.slice(1), ...resolution.argsPrefix, "serve", "--mcp"], {
      cwd: runtime.cwd,
      env: runtime.env,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    })
    runtime.stdin.pipe(child.stdin)
    child.stdout.pipe(runtime.stdout)
    child.stderr.pipe(runtime.stderr)
    child.on("error", (error) => {
      runtime.stderr.write(`CodeGraph wrapper failed to start: ${error.message}\n`)
      resolve(1)
    })
    child.on("close", (code) => resolve(code ?? 0))
  })
}

function runUnavailableMcpServer(runtime, resolution) {
  return new Promise((resolve, reject) => {
    let buffer = Buffer.alloc(0)
    runtime.stdin.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, Buffer.from(chunk)])
      buffer = drainFrames(buffer, runtime, resolution)
    })
    runtime.stdin.on("end", () => resolve(0))
    runtime.stdin.on("error", reject)
  })
}

function drainFrames(buffer, runtime, resolution) {
  let cursor = 0
  while (cursor < buffer.length) {
    const frame = readNextFrame(buffer, cursor)
    if (frame === undefined) break
    const input = JSON.parse(frame.body)
    const response = handleUnavailableRequest(input, runtime, resolution)
    if (response !== undefined) writeResponse(runtime.stdout, response, frame.transport)
    cursor = frame.nextCursor
  }
  return buffer.subarray(cursor)
}

function readNextFrame(buffer, cursor) {
  const contentLength = readContentLengthFrame(buffer, cursor)
  if (contentLength !== undefined) return contentLength
  return readJsonLineFrame(buffer, cursor)
}

function readContentLengthFrame(buffer, cursor) {
  const headerEnd = buffer.indexOf("\r\n\r\n", cursor)
  if (headerEnd === -1) return undefined
  const header = buffer.subarray(cursor, headerEnd).toString("utf8")
  const match = /^Content-Length: (?<length>\d+)$/im.exec(header)
  if (match?.groups?.length === undefined) return undefined
  const length = Number.parseInt(match.groups.length, 10)
  const bodyStart = headerEnd + 4
  const bodyEnd = bodyStart + length
  if (buffer.length < bodyEnd) return undefined
  return { body: buffer.subarray(bodyStart, bodyEnd).toString("utf8"), nextCursor: bodyEnd, transport: "content-length" }
}

function readJsonLineFrame(buffer, cursor) {
  const lineEnd = buffer.indexOf("\n", cursor)
  if (lineEnd === -1) return undefined
  const body = buffer.subarray(cursor, lineEnd).toString("utf8").trim()
  if (body === "") return { body: "null", nextCursor: lineEnd + 1, transport: "json-line" }
  return { body, nextCursor: lineEnd + 1, transport: "json-line" }
}

function handleUnavailableRequest(input, runtime, resolution) {
  if (!isRecord(input)) return errorResponse(null, -32600, "Invalid Request")
  const id = jsonRpcId(input.id)
  if (input.method === "notifications/initialized") return undefined
  if (input.method === "ping") return successResponse(id, {})
  if (input.method === "initialize") return successResponse(id, {
    capabilities: { tools: { listChanged: false } },
    protocolVersion: requestedProtocolVersion(input.params),
    serverInfo: { name: SERVER_NAME, version: String(VERSION) },
  })
  if (input.method === "tools/list") return successResponse(id, { tools: unavailableTools() })
  if (input.method === "tools/call") return handleUnavailableToolCall(id, input.params, runtime, resolution)
  return errorResponse(id, -32601, `Method not found: ${String(input.method)}`)
}

function unavailableTools() {
  return [
    {
      name: "status",
      description: "Report why external CodeGraph is unavailable. OpenCode exposes this as codegraph_status.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
  ]
}

function handleUnavailableToolCall(id, params, runtime, resolution) {
  if (!isRecord(params) || typeof params.name !== "string") return errorResponse(id, -32602, "Invalid tools/call params")
  if (params.name !== "status") return toolResult(id, unavailablePayload(runtime, resolution), true)
  return toolResult(id, unavailablePayload(runtime, resolution), true)
}

function unavailablePayload(runtime, resolution) {
  return {
    schemaVersion: VERSION,
    status: "unavailable",
    source: resolution.source,
    reason: resolution.reason,
    cwd: runtime.cwd,
    nextActions: [
      "Install external CodeGraph, for example `npm i -g @colbymchenry/codegraph`, or install Persona Harness optional dependencies.",
      "Run `codegraph init` intentionally in the project when you want a .codegraph index.",
      "Re-run `npx ph bootstrap backend` if you opted out earlier.",
    ],
    limitations: [
      "Status-only unavailable facade; no indexed code navigation is available until CodeGraph is installed.",
      "No PH-owned codegraph or token-saving claim.",
    ],
  }
}

function requestedProtocolVersion(params) {
  if (!isRecord(params) || typeof params.protocolVersion !== "string") return "2024-11-05"
  return params.protocolVersion
}

function toolResult(id, payload, isError = false) {
  return successResponse(id, {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    isError,
  })
}

function writeResponse(output, response, transport) {
  if (transport === "json-line") {
    output.write(`${JSON.stringify({ jsonrpc: "2.0", ...response })}\n`)
    return
  }
  const body = JSON.stringify({ jsonrpc: "2.0", ...response })
  output.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`)
}

function successResponse(id, result) {
  return { id, result }
}

function errorResponse(id, code, message) {
  return { error: { code, message }, id }
}

function jsonRpcId(value) {
  if (typeof value === "string" || typeof value === "number" || value === null) return value
  return null
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
