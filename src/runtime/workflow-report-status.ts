import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

export type WorkflowReportStatus = "conflicting" | "filled" | "malformed" | "missing" | "template" | "unknown"

export type WorkflowReportStatusDetail = {
  readonly source: "file" | "frontmatter" | "legacy" | "missing"
  readonly status: WorkflowReportStatus
}

type ParsedWorkflowReportStatus = "filled" | "template" | "unknown"
type ReportFrontmatter =
  | { readonly kind: "absent" }
  | { readonly end: number; readonly kind: "present" }
  | { readonly kind: "unterminated" }

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

function reportFrontmatter(lines: readonly string[]): ReportFrontmatter {
  if (lines[0] !== "---") {
    return { kind: "absent" }
  }
  const closingOffset = lines.slice(1).findIndex((line) => line === "---")
  if (closingOffset === -1) {
    return { kind: "unterminated" }
  }
  return { end: closingOffset + 1, kind: "present" }
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

function collapsedStatus(statuses: readonly ParsedWorkflowReportStatus[]): ParsedWorkflowReportStatus | "conflicting" | undefined {
  const first = statuses[0]
  if (first === undefined) {
    return undefined
  }
  return statuses.every((status) => status === first) ? first : "conflicting"
}

function frontmatterStatus(lines: readonly string[], frontmatter: ReportFrontmatter): ParsedWorkflowReportStatus | "conflicting" | undefined {
  if (frontmatter.kind !== "present") {
    return undefined
  }
  const statuses = lines
    .slice(1, frontmatter.end)
    .flatMap((line) => {
      const status = normalizeStatus(fieldValue(line, "status"))
      return status === undefined ? [] : [status]
    })
  return collapsedStatus(statuses)
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

function legacyStatus(lines: readonly string[], frontmatter: ReportFrontmatter): ParsedWorkflowReportStatus | "conflicting" | undefined {
  const searchableLines = frontmatter.kind === "present"
    ? lines.slice(frontmatter.end + 1)
    : lines
  const statuses = searchableLines.flatMap((line) => {
    const status = normalizeStatus(legacyStatusValue(line))
    return status === undefined ? [] : [status]
  })
  return collapsedStatus(statuses)
}

export function parseWorkflowReportStatusDetail(markdown: string): WorkflowReportStatusDetail {
  const lines = markdown.split(/\r?\n/)
  const frontmatter = reportFrontmatter(lines)
  if (frontmatter.kind === "unterminated") {
    return { source: "frontmatter", status: "malformed" }
  }
  const frontmatterStatusValue = frontmatterStatus(lines, frontmatter)
  const legacyStatusValue = legacyStatus(lines, frontmatter)

  if (frontmatterStatusValue === "conflicting" || legacyStatusValue === "conflicting") {
    return { source: frontmatterStatusValue === "conflicting" ? "frontmatter" : "legacy", status: "conflicting" }
  }
  if (
    frontmatterStatusValue !== undefined
    && legacyStatusValue !== undefined
    && frontmatterStatusValue !== legacyStatusValue
  ) {
    return { source: "frontmatter", status: "conflicting" }
  }
  if (frontmatterStatusValue !== undefined) {
    return { source: "frontmatter", status: frontmatterStatusValue }
  }
  if (legacyStatusValue !== undefined) {
    return { source: "legacy", status: legacyStatusValue }
  }
  return { source: "file", status: "unknown" }
}

export function parseWorkflowReportStatusText(markdown: string): WorkflowReportStatus {
  return parseWorkflowReportStatusDetail(markdown).status
}

export function readWorkflowReportStatusDetail(projectDir: string, relativePath: string): WorkflowReportStatusDetail {
  const reportPath = join(projectDir, relativePath)
  if (!existsSync(reportPath)) {
    return { source: "missing", status: "missing" }
  }
  try {
    return parseWorkflowReportStatusDetail(readFileSync(reportPath, "utf8"))
  } catch {
    return { source: "file", status: "malformed" }
  }
}

export function readWorkflowReportStatus(projectDir: string, relativePath: string): WorkflowReportStatus {
  return readWorkflowReportStatusDetail(projectDir, relativePath).status
}

export function replaceWorkflowReportStatusText(
  markdown: string,
  status: Exclude<ParsedWorkflowReportStatus, "unknown">,
): string | undefined {
  const lines = markdown.split(/\r?\n/)
  const frontmatter = reportFrontmatter(lines)
  if (frontmatter.kind === "present") {
    for (let index = 1; index < frontmatter.end; index += 1) {
      if (fieldValue(lines[index] ?? "", "status") !== undefined) {
        const indentationLength = (lines[index] ?? "").length - (lines[index] ?? "").trimStart().length
        lines[index] = `${" ".repeat(indentationLength)}status: ${status}`
        return lines.join("\n")
      }
    }
  }
  if (frontmatter.kind === "unterminated") {
    return undefined
  }

  for (let index = 0; index < lines.length; index += 1) {
    if (legacyStatusValue(lines[index] ?? "") !== undefined) {
      lines[index] = `Status: ${status}`
      return lines.join("\n")
    }
  }

  return undefined
}
