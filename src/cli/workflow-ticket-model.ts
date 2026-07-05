export type StepSection = {
  readonly number: string
  readonly title: string
  readonly body: string
  readonly kind: "step" | "requirement"
}

export type RequirementSourceKind = "file" | "prompt"

export type RequirementSource = {
  readonly kind: RequirementSourceKind
  readonly path: string
  readonly label: string
}

export type BacklogTicket = {
  readonly order: number
  readonly ticket: string
  readonly title: string
  readonly status: string
  readonly path: string
}

export type BacklogParseResult =
  | { readonly kind: "ok"; readonly tickets: readonly BacklogTicket[] }
  | { readonly kind: "malformed"; readonly reason: string }

export const WORK_DIR = ".persona/workflow/work"
export const HISTORY_DIR = ".persona/workflow/history"
export const BACKLOG_PATH = ".persona/workflow/backlog.md"
export const REQUIREMENTS_ANALYSIS_PATH = ".persona/workflow/requirements-analysis.md"
export const REQUIREMENTS_DIR = ".persona/workflow/requirements"
export const LATEST_REQUIREMENTS_PATH = ".persona/workflow/requirements/latest.md"
export const DRAFT_REQUIREMENTS_BACKLOG_PATH = ".persona/workflow/requirements/backlog.md"
export const DRAFT_REQUIREMENTS_QUESTIONS_PATH = ".persona/workflow/requirements/questions.md"
export const DRAFT_REQUIREMENTS_ASSUMPTIONS_PATH = ".persona/workflow/requirements/assumptions.md"
export const TASK_CARD_NAME = "00-task-card.md"
export const WORKFLOW_BACKLOG_SCHEMA_VERSION = "workflow-backlog.1"
export const WORKFLOW_REQUIREMENTS_BACKLOG_SCHEMA_VERSION = "workflow-requirements-backlog.1"
export const WORKFLOW_TASK_CARD_SCHEMA_VERSION = "workflow-task-card.2"

export type TaskCardRuleDelivery = {
  readonly budget: number
  readonly estimatedTokens: number
  readonly policyCount: number
  readonly role: string
  readonly ruleCount: number
  readonly rulePackHash: string
  readonly rules: readonly {
    readonly path: string
    readonly policies: readonly string[]
  }[]
}

function schemaVersionLine(schemaVersion: string): string {
  return `schemaVersion: ${schemaVersion}`
}

function ensureTrailingNewline(value: string): string {
  return value.endsWith("\n") ? value : `${value}\n`
}

function insertOrReplaceSchemaVersion(markdown: string, schemaVersion: string): string {
  const lines = markdown.replace(/\r\n/gu, "\n").split("\n")
  const line = schemaVersionLine(schemaVersion)
  const existingIndex = lines.findIndex((candidate) => /^(?:schemaVersion|Schema version):/iu.test(candidate.trim()))
  if (existingIndex >= 0) {
    lines[existingIndex] = line
    return ensureTrailingNewline(lines.join("\n").replace(/\n+$/u, ""))
  }
  const statusIndex = lines.findIndex((candidate) => /^Status:/iu.test(candidate.trim()))
  const insertIndex = statusIndex >= 0 ? statusIndex + 1 : Math.min(1, lines.length)
  const nextLines = [...lines.slice(0, insertIndex), line, ...lines.slice(insertIndex)]
  return ensureTrailingNewline(nextLines.join("\n").replace(/\n+$/u, ""))
}

function stepHeading(line: string): { readonly number: string; readonly title: string } | undefined {
  const match = /^#{2,4}\s*Step\s+([0-9]+)[.:]?\s*(.*)$/iu.exec(line.trim())
  if (match === null) {
    return undefined
  }
  const title = match[2]?.trim() ?? ""
  return { number: match[1] ?? "0", title: title.length > 0 ? title : `Step ${match[1] ?? "0"}` }
}

export function parseStepSections(markdown: string): readonly StepSection[] {
  const lines = markdown.split(/\r?\n/u)
  const sections: StepSection[] = []
  let current: { readonly number: string; readonly title: string; readonly lines: string[] } | undefined

  for (const line of lines) {
    const heading = stepHeading(line)
    if (heading !== undefined) {
      if (current !== undefined) {
        sections.push({ number: current.number, title: current.title, body: current.lines.join("\n").trim(), kind: "step" })
      }
      current = { number: heading.number, title: heading.title, lines: [] }
    } else if (current !== undefined) {
      current.lines.push(line)
    }
  }

  if (current !== undefined) {
    sections.push({ number: current.number, title: current.title, body: current.lines.join("\n").trim(), kind: "step" })
  }

  return sections
}

function ticketForSection(section: StepSection): string {
  return section.kind === "step" ? `step-${section.number}` : `req-${section.number}`
}

function headingForSection(section: StepSection): string {
  return section.kind === "step" ? `Step ${section.number}. ${section.title}` : `Requirement ${section.number}. ${section.title}`
}

export function taskCardPath(ticket: string): string {
  return `${WORK_DIR}/${ticket}/${TASK_CARD_NAME}`
}

export function historyTaskCardPath(ticket: string): string {
  return `${HISTORY_DIR}/${ticket}/${TASK_CARD_NAME}`
}

function formatTaskCardRuleDelivery(delivery: TaskCardRuleDelivery | undefined): readonly string[] {
  if (delivery === undefined) {
    return []
  }
  return [
    "## Scoped Rule Delivery",
    "",
    `Rule delivery role: ${delivery.role}`,
    `Rule pack hash: ${delivery.rulePackHash}`,
    `Rule budget: ${delivery.ruleCount}/${delivery.budget}`,
    `Rule policy bullets: ${delivery.policyCount}`,
    `Estimated delivered tokens: ${delivery.estimatedTokens}`,
    "Rule delivery is narrow by role scope; PH closure/check/finish gates remain broad and authoritative.",
    "",
    "### Matching Rules",
    "",
    ...(delivery.rules.length === 0
      ? ["- No scoped PH rules matched this ticket work type."]
      : delivery.rules.flatMap((rule) => [`- ${rule.path}`, ...rule.policies.map((policy) => `  - ${policy}`)])),
    "",
  ]
}

export function formatTaskCard(
  source: RequirementSource,
  section: StepSection,
  ruleDelivery?: TaskCardRuleDelivery,
): string {
  const ticket = ticketForSection(section)
  const heading = headingForSection(section)
  const body = section.body.length > 0 ? section.body : `(No body was captured under this ${section.kind} heading.)`
  return [
    `# Task Card: ${heading}`,
    "",
    "Status: pending",
    schemaVersionLine(WORKFLOW_TASK_CARD_SCHEMA_VERSION),
    `Ticket: ${ticket}`,
    `Source: ${source.label}`,
    `Source kind: ${source.kind}`,
    `Source path: ${source.path}`,
    `Source heading: ${heading}`,
    "",
    "## Goal",
    "",
    `Implement ${heading} from the source requirements.`,
    "",
    "## Source Requirement",
    "",
    body,
    "",
    "## Scope",
    "",
    "- Implement only this ticket.",
    "- Keep existing project style when source code already exists.",
    "- Preserve Persona Harness workflow reports when they exist.",
    "",
    ...formatTaskCardRuleDelivery(ruleDelivery),
    "## Non-Goals",
    "",
    "- No automatic code generation from split.",
    "- No product-quality certification.",
    "- No TDD relay enforcement yet.",
    "",
    "## Completion Evidence",
    "",
    "- Fill `.persona/workflow/implementation-report.md` when implementation work is done.",
    "- Fill `.persona/workflow/review-report.md` after review/manual QA.",
    `- Archive with \`npx ph workflow archive ${ticket}\` only after the ticket is complete.`,
  ].join("\n") + "\n"
}

export function formatBacklog(source: RequirementSource, sections: readonly StepSection[]): string {
  const rows = sections.map((section, index) => {
    const ticket = ticketForSection(section)
    return `| ${index + 1} | ${ticket} | ${section.title} | pending | ${taskCardPath(ticket)} |`
  })
  return [
    "# Persona Workflow Backlog",
    "",
    `Source: ${source.label}`,
    `Source kind: ${source.kind}`,
    `Source path: ${source.path}`,
    "Status: active",
    schemaVersionLine(WORKFLOW_BACKLOG_SCHEMA_VERSION),
    "",
    "| Order | Ticket | Title | Status | Path |",
    "| --- | --- | --- | --- | --- |",
    ...rows,
  ].join("\n") + "\n"
}

export function parseBacklog(markdown: string): readonly BacklogTicket[] {
  return markdown
    .split(/\r?\n/u)
    .filter((line) => line.startsWith("|") && !line.includes("---") && !line.includes("Order"))
    .map((line) => line.split("|").map((cell) => cell.trim()).filter((cell) => cell.length > 0))
    .filter((cells) => cells.length >= 5)
    .map((cells) => ({
      order: Number.parseInt(cells[0] ?? "0", 10),
      ticket: cells[1] ?? "",
      title: cells[2] ?? "",
      status: cells[3] ?? "",
      path: cells[4] ?? "",
    }))
    .filter((ticket) => Number.isFinite(ticket.order) && ticket.ticket.length > 0)
}

export function parseBacklogState(markdown: string): BacklogParseResult {
  const tickets = parseBacklog(markdown)
  if (tickets.length > 0) {
    return { kind: "ok", tickets }
  }
  const trimmed = markdown.trim()
  if (trimmed.length === 0) {
    return { kind: "ok", tickets }
  }
  if (/Persona Workflow Backlog|^\|.*\bOrder\b.*\bTicket\b/im.test(markdown)) {
    return {
      kind: "malformed",
      reason: "workflow backlog exists but no valid ticket rows could be parsed",
    }
  }
  return { kind: "ok", tickets }
}

export function replaceBacklogTicket(markdown: string, ticketId: string): string {
  const replaced = markdown
    .split(/\r?\n/u)
    .map((line) => {
      const cells = line.split("|").map((cell) => cell.trim())
      if (cells.length < 7 || cells[2] !== ticketId) {
        return line
      }
      const title = cells[3] ?? ""
      const order = cells[1] ?? ""
      return `| ${order} | ${ticketId} | ${title} | archived | ${historyTaskCardPath(ticketId)} |`
    })
    .join("\n")
  return insertOrReplaceSchemaVersion(replaced, WORKFLOW_BACKLOG_SCHEMA_VERSION)
}

export function pendingTickets(markdown: string): readonly BacklogTicket[] {
  return parseBacklog(markdown).filter((ticket) => ticket.status === "pending" || ticket.status === "active")
}
