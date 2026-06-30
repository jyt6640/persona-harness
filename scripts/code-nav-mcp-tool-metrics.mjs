#!/usr/bin/env node
import { readFileSync } from "node:fs"

const SERVER_PREFIX = "persona-harness-code-nav_"
const RAW_TOOL_NAMES = ["status", "search_text", "ast_grep_availability"]
const NAMESPACED_TOOL_NAMES = RAW_TOOL_NAMES.map((name) => `${SERVER_PREFIX}${name}`)
const EXACT_TOOL_NAMES = new Set([...RAW_TOOL_NAMES, ...NAMESPACED_TOOL_NAMES])
const NAMESPACED_TOOL_PATTERN = /\bpersona-harness-code-nav_(?:status|search_text|ast_grep_availability)\b/gu
const TOOL_NAME_KEY_PATTERN = /(^|\.|_)(tool|toolName|tool_name|name|id|identifier)$/iu

export function canonicalCodeNavToolName(name) {
  if (typeof name !== "string") return undefined
  if (RAW_TOOL_NAMES.includes(name)) return name
  if (name.startsWith(SERVER_PREFIX)) {
    const rawName = name.slice(SERVER_PREFIX.length)
    if (RAW_TOOL_NAMES.includes(rawName)) return rawName
  }
  return undefined
}

export function isCodeNavToolName(name) {
  return canonicalCodeNavToolName(name) !== undefined
}

export function collectCodeNavToolMetrics(text) {
  const counts = new Map()
  let eventsScanned = 0
  for (const line of text.split(/\r?\n/u)) {
    if (line.trim() === "") continue
    eventsScanned += 1
    const names = collectToolNamesFromLine(line)
    for (const name of names) {
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }
  }
  const exactToolNames = [...counts.keys()].sort()
  return {
    codeNavToolCallCount: [...counts.values()].reduce((sum, count) => sum + count, 0),
    codeNavToolCallCounts: Object.fromEntries(exactToolNames.map((name) => [name, counts.get(name) ?? 0])),
    exactToolNames,
    canonicalToolCallCounts: canonicalCounts(counts),
    recognizedToolNames: {
      namespaced: NAMESPACED_TOOL_NAMES,
      raw: RAW_TOOL_NAMES,
    },
    eventsScanned,
  }
}

function collectToolNamesFromLine(line) {
  const parsed = parseJson(line)
  if (parsed !== undefined) return collectToolNamesFromJson(parsed)
  return new Set([...line.matchAll(NAMESPACED_TOOL_PATTERN)].map((match) => match[0]))
}

function collectToolNamesFromJson(value) {
  const names = new Set()
  visitJson(value, "", (path, stringValue) => {
    if (NAMESPACED_TOOL_NAMES.includes(stringValue)) {
      names.add(stringValue)
      return
    }
    if (RAW_TOOL_NAMES.includes(stringValue) && TOOL_NAME_KEY_PATTERN.test(path)) {
      names.add(stringValue)
    }
  })
  return names
}

function visitJson(value, path, onString) {
  if (typeof value === "string") {
    onString(path, value)
    return
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => visitJson(entry, `${path}.${index}`, onString))
    return
  }
  if (value === null || typeof value !== "object") return
  for (const [key, entry] of Object.entries(value)) {
    visitJson(entry, path === "" ? key : `${path}.${key}`, onString)
  }
}

function parseJson(line) {
  try {
    return JSON.parse(line)
  } catch {
    return undefined
  }
}

function canonicalCounts(counts) {
  const result = Object.fromEntries(RAW_TOOL_NAMES.map((name) => [name, 0]))
  for (const [exactName, count] of counts) {
    const canonical = canonicalCodeNavToolName(exactName)
    if (canonical !== undefined) result[canonical] += count
  }
  return result
}

function readInput(paths) {
  if (paths.length === 0 || (paths.length === 1 && paths[0] === "-")) {
    return readFileSync(0, "utf8")
  }
  return paths.map((path) => readFileSync(path, "utf8")).join("\n")
}

function main() {
  const args = process.argv.slice(2)
  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write([
      "Usage: node scripts/code-nav-mcp-tool-metrics.mjs [log.jsonl ...]",
      "",
      "Counts PH code-nav MCP tool calls in OpenCode logs.",
      "Recognizes raw MCP tool names and OpenCode namespaced names such as persona-harness-code-nav_search_text.",
      "Reads stdin when no files are provided or when path is '-'.",
      "",
    ].join("\n"))
    return
  }
  process.stdout.write(`${JSON.stringify(collectCodeNavToolMetrics(readInput(args)), null, 2)}\n`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
