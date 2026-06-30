import {
  SERVER_NAME,
  VERSION,
  astGrepCapability,
  capabilities,
  isRecord,
  textSearch,
} from "./code-nav-core.mjs"

export async function runMcpServer(runtime) {
  return new Promise((resolveInput, rejectInput) => {
    let buffer = Buffer.alloc(0)
    runtime.stdin.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, Buffer.from(chunk)])
      buffer = drainMcpFrames(buffer, runtime)
    })
    runtime.stdin.on("end", resolveInput)
    runtime.stdin.on("error", rejectInput)
  })
}

function drainMcpFrames(buffer, runtime) {
  let cursor = 0
  while (cursor < buffer.length) {
    const headerEnd = buffer.indexOf("\r\n\r\n", cursor)
    if (headerEnd === -1) break
    const header = buffer.subarray(cursor, headerEnd).toString("utf8")
    const match = /^Content-Length: (?<length>\d+)$/m.exec(header)
    if (match?.groups?.length === undefined) break
    const length = Number.parseInt(match.groups.length, 10)
    const bodyStart = headerEnd + 4
    const bodyEnd = bodyStart + length
    if (buffer.length < bodyEnd) break
    const request = JSON.parse(buffer.subarray(bodyStart, bodyEnd).toString("utf8"))
    const response = handleMcpRequest(request, runtime)
    if (response !== undefined) writeMcpFrame(runtime.stdout, response)
    cursor = bodyStart + length
  }
  return buffer.subarray(cursor)
}

function writeMcpFrame(output, response) {
  const body = JSON.stringify({ jsonrpc: "2.0", ...response })
  output.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`)
}

function handleMcpRequest(input, runtime) {
  if (!isRecord(input)) return errorResponse(null, -32600, "Invalid Request")
  const id = jsonRpcId(input.id)
  if (input.method === "notifications/initialized") return undefined
  if (input.method === "ping") return successResponse(id, {})
  if (input.method === "initialize") return initializeResponse(id, input.params)
  if (input.method === "tools/list") return successResponse(id, { tools: mcpTools() })
  if (input.method === "tools/call") return handleToolCall(id, input.params, runtime)
  return errorResponse(id, -32601, `Method not found: ${String(input.method)}`)
}

function initializeResponse(id, params) {
  return successResponse(id, {
    capabilities: { tools: { listChanged: false } },
    protocolVersion: requestedProtocolVersion(params),
    serverInfo: { name: SERVER_NAME, version: String(VERSION) },
  })
}

function requestedProtocolVersion(params) {
  if (!isRecord(params) || typeof params.protocolVersion !== "string") return "2024-11-05"
  return params.protocolVersion
}

function mcpTools() {
  return [
    {
      name: "status",
      description: "Report PH code-nav preview status and honest capability boundaries.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "search_text",
      description: "Run bounded filesystem text search. This is not a symbol graph or codegraph replacement.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          root: { type: "string" },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
    {
      name: "ast_grep_availability",
      description: "Report whether sg/ast-grep is available on PATH without running rules.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
  ]
}

function handleToolCall(id, params, runtime) {
  if (!isRecord(params) || typeof params.name !== "string") {
    return errorResponse(id, -32602, "Invalid tools/call params")
  }
  if (params.name === "status") return toolResult(id, capabilities(runtime.env))
  if (params.name === "ast_grep_availability") return toolResult(id, astGrepCapability(runtime.env))
  if (params.name === "search_text") return handleSearchToolCall(id, params.arguments, runtime)
  return toolResult(id, { status: "unavailable", message: `Unknown tool: ${params.name}` }, true)
}

function handleSearchToolCall(id, args, runtime) {
  if (!isRecord(args) || typeof args.query !== "string" || args.query.trim() === "") {
    return errorResponse(id, -32602, "search_text requires a non-empty query")
  }
  const root = typeof args.root === "string" ? args.root : undefined
  return toolResult(id, textSearch(args.query, root, runtime.cwd))
}

function toolResult(id, payload, isError = false) {
  return successResponse(id, {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    isError,
  })
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
