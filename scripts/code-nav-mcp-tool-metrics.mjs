#!/usr/bin/env node
import { readFileSync } from "node:fs"

const SERVER_PREFIX = "persona-harness-code-nav_"
const RAW_TOOL_NAMES = ["status", "search_text", "ast_grep_availability"]
const NAMESPACED_TOOL_NAMES = RAW_TOOL_NAMES.map((name) => `${SERVER_PREFIX}${name}`)
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
  const toolUseCounts = new Map()
  const mentionCounts = new Map()
  let eventsScanned = 0
  for (const line of text.split(/\r?\n/u)) {
    if (line.trim() === "") continue
    eventsScanned += 1
    const names = collectToolNamesFromLine(line)
    incrementCounts(toolUseCounts, names.toolUses)
    incrementCounts(mentionCounts, names.mentions)
  }
  const exactToolNames = [...toolUseCounts.keys()].sort()
  const exactMentionNames = [...mentionCounts.keys()].sort()
  return {
    codeNavToolCallCount: sumCounts(toolUseCounts),
    codeNavToolCallCounts: Object.fromEntries(exactToolNames.map((name) => [name, toolUseCounts.get(name) ?? 0])),
    codeNavToolMentionCount: sumCounts(mentionCounts),
    codeNavToolMentionCounts: Object.fromEntries(exactMentionNames.map((name) => [name, mentionCounts.get(name) ?? 0])),
    exactToolNames,
    exactMentionNames,
    canonicalToolCallCounts: canonicalCounts(toolUseCounts),
    canonicalToolMentionCounts: canonicalCounts(mentionCounts),
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
  return {
    mentions: new Set([...line.matchAll(NAMESPACED_TOOL_PATTERN)].map((match) => match[0])),
    toolUses: new Set(),
  }
}

function collectToolNamesFromJson(value) {
  const toolUses = new Set()
  const mentions = new Set()
  visitJson(value, "", (path, stringValue) => {
    if (isCodeNavToolName(stringValue) && TOOL_NAME_KEY_PATTERN.test(path)) {
      toolUses.add(stringValue)
      return
    }
    for (const match of stringValue.matchAll(NAMESPACED_TOOL_PATTERN)) {
      mentions.add(match[0])
    }
  })
  return { mentions, toolUses }
}

function incrementCounts(counts, names) {
  for (const name of names) {
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
}

function sumCounts(counts) {
  return [...counts.values()].reduce((sum, count) => sum + count, 0)
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
