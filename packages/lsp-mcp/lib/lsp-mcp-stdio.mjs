export async function runUnavailableMcpServer(runtime, resolution, options) {
  return await new Promise((resolveInput, rejectInput) => {
    let buffer = Buffer.alloc(0)
    runtime.stdin.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, Buffer.from(chunk)])
      buffer = drainMcpFrames(buffer, runtime, resolution, options)
    })
    runtime.stdin.on("end", resolveInput)
    runtime.stdin.on("error", rejectInput)
  })
}

function drainMcpFrames(buffer, runtime, resolution, options) {
  let cursor = 0
  while (cursor < buffer.length) {
    const frame = readNextInputFrame(buffer, cursor)
    if (frame === undefined) break
    const request = JSON.parse(frame.body)
    const response = handleUnavailableMcpRequest(request, runtime, resolution, options)
    if (response !== undefined) writeMcpResponse(runtime.stdout, response, frame.transport)
    cursor = frame.nextCursor
  }
  return buffer.subarray(cursor)
}

function readNextInputFrame(buffer, cursor) {
  const contentLengthFrame = readContentLengthFrame(buffer, cursor)
  if (contentLengthFrame !== undefined) return contentLengthFrame
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
  return {
    body: buffer.subarray(bodyStart, bodyEnd).toString("utf8"),
    nextCursor: bodyEnd,
    transport: "content-length",
  }
}

function readJsonLineFrame(buffer, cursor) {
  const lineEnd = buffer.indexOf("\n", cursor)
  if (lineEnd === -1) return undefined
  const body = buffer.subarray(cursor, lineEnd).toString("utf8").trim()
  if (body === "") return { body: "null", nextCursor: lineEnd + 1, transport: "json-line" }
  return { body, nextCursor: lineEnd + 1, transport: "json-line" }
}

function writeMcpResponse(output, response, transport) {
  if (transport === "json-line") {
    writeJsonLine(output, { jsonrpc: "2.0", ...response })
    return
  }
  const body = JSON.stringify({ jsonrpc: "2.0", ...response })
  output.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`)
}

function handleUnavailableMcpRequest(input, runtime, resolution, options) {
  if (!isRecord(input)) return errorResponse(null, -32600, "Invalid Request")
  const id = jsonRpcId(input.id)
  if (input.method === "notifications/initialized") return undefined
  if (input.method === "ping") return successResponse(id, {})
  if (input.method === "initialize") return initializeResponse(id, input.params, options)
  if (input.method === "tools/list") return successResponse(id, { tools: unavailableTools() })
  if (input.method === "tools/call") return handleUnavailableToolCall(id, input.params, runtime, resolution, options)
  return errorResponse(id, -32601, `Method not found: ${String(input.method)}`)
}

function initializeResponse(id, params, options) {
  return successResponse(id, {
    capabilities: { tools: { listChanged: false } },
    protocolVersion: requestedProtocolVersion(params),
    serverInfo: { name: options.serverName, version: String(options.version) },
  })
}

function requestedProtocolVersion(params) {
  if (!isRecord(params) || typeof params.protocolVersion !== "string") return "2024-11-05"
  return params.protocolVersion
}

function unavailableTools() {
  return [
    {
      name: "lsp_status",
      description: "Report PH LSP MCP wrapper availability. OpenCode exposes this as persona-harness-lsp_lsp_status.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
  ]
}

function handleUnavailableToolCall(id, params, runtime, resolution, options) {
  if (!isRecord(params) || typeof params.name !== "string") {
    return errorResponse(id, -32602, "Invalid tools/call params")
  }
  if (params.name === "lsp_status") {
    return toolResult(id, options.statusPayload(runtime.env))
  }
  return toolResult(id, {
    status: "unavailable",
    reason: resolution.reason,
    message: "LSP tools are unavailable until the upstream LSP MCP package and Java LSP binary are installed.",
  }, true)
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

function writeJsonLine(output, value) {
  output.write(`${JSON.stringify(value)}\n`)
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
