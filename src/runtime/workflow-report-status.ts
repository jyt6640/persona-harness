import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

export type WorkflowReportStatus = "missing" | "template" | "filled" | "unknown"

type ParsedWorkflowReportStatus = Exclude<WorkflowReportStatus, "missing">

function cleanScalar(value: string): string {
  const trimmed = value.trim()
  const first = trimmed.at(0)
  const last = trimmed.at(-1)
  if (trimmed.length >= 2 && ((first === '"' && last === '"') || (first === "'" && last === "'"))) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function normalizeStatus(value: string | undefined): ParsedWorkflowReportStatus | undefined {
  const normalized = cleanScalar(value ?? "").toLowerCase()
  if (normalized === "template" || normalized === "filled") {
    return normalized
  }
  if (normalized !== "") {
    return "unknown"
  }
  return undefined
}

function frontmatterBounds(lines: readonly string[]): { readonly start: number; readonly end: number } | undefined {
  if (lines[0] !== "---") {
    return undefined
  }
  const closingOffset = lines.slice(1).findIndex((line) => line === "---")
  if (closingOffset === -1) {
    return undefined
  }
  return { start: 0, end: closingOffset + 1 }
}

function fieldValue(line: string, fieldName: string): string | undefined {
  const colonIndex = line.indexOf(":")
  if (colonIndex === -1) {
    return undefined
  }
  const key = line.slice(0, colonIndex).trim().toLowerCase()
  if (key !== fieldName) {
    return undefined
  }
  return line.slice(colonIndex + 1)
}

function frontmatterStatus(lines: readonly string[]): ParsedWorkflowReportStatus | undefined {
  const bounds = frontmatterBounds(lines)
  if (bounds === undefined) {
    return undefined
  }
  for (const line of lines.slice(bounds.start + 1, bounds.end)) {
    const status = normalizeStatus(fieldValue(line, "status"))
    if (status !== undefined) {
      return status
    }
  }
  return undefined
}

function legacyStatusValue(line: string): string | undefined {
  let working = line.trim()
  if (working.startsWith("- ") || working.startsWith("* ")) {
    working = working.slice(2).trim()
  }

  const lower = working.toLowerCase()
  for (const prefix of ["status:", "**status:**", "**status**:"]) {
    if (lower.startsWith(prefix)) {
      return working.slice(prefix.length).replace(/\*\*/g, "")
    }
  }
  return undefined
}

function legacyStatus(lines: readonly string[]): ParsedWorkflowReportStatus | undefined {
  const bounds = frontmatterBounds(lines)
  const searchableLines = bounds === undefined
    ? lines
    : [...lines.slice(0, bounds.start), ...lines.slice(bounds.end + 1)]
  for (const line of searchableLines) {
    const status = normalizeStatus(legacyStatusValue(line))
    if (status !== undefined) {
      return status
    }
  }
  return undefined
}

export function parseWorkflowReportStatusText(markdown: string): ParsedWorkflowReportStatus {
  const lines = markdown.split(/\r?\n/)
  const frontmatter = frontmatterStatus(lines)
  const fallback = legacyStatus(lines)

  if (frontmatter !== undefined && fallback !== undefined && frontmatter !== fallback) {
    return fallback
  }
  return frontmatter ?? fallback ?? "unknown"
}

export function readWorkflowReportStatus(projectDir: string, relativePath: string): WorkflowReportStatus {
  const reportPath = join(projectDir, relativePath)
  if (!existsSync(reportPath)) {
    return "missing"
  }
  return parseWorkflowReportStatusText(readFileSync(reportPath, "utf8"))
}

export function replaceWorkflowReportStatusText(
  markdown: string,
  status: Exclude<ParsedWorkflowReportStatus, "unknown">,
): string | undefined {
  const lines = markdown.split(/\r?\n/)
  const bounds = frontmatterBounds(lines)
  if (bounds !== undefined) {
    for (let index = bounds.start + 1; index < bounds.end; index += 1) {
      if (fieldValue(lines[index] ?? "", "status") !== undefined) {
        const indentationLength = (lines[index] ?? "").length - (lines[index] ?? "").trimStart().length
        lines[index] = `${" ".repeat(indentationLength)}status: ${status}`
        return lines.join("\n")
      }
    }
  }

  for (let index = 0; index < lines.length; index += 1) {
    if (legacyStatusValue(lines[index] ?? "") !== undefined) {
      lines[index] = `Status: ${status}`
      return lines.join("\n")
    }
  }

  return undefined
}
