export type StepSection = {
  readonly number: string
  readonly title: string
  readonly body: string
}

export type BacklogTicket = {
  readonly order: number
  readonly ticket: string
  readonly title: string
  readonly status: string
  readonly path: string
}

export const WORK_DIR = ".persona/workflow/work"
export const HISTORY_DIR = ".persona/workflow/history"
export const BACKLOG_PATH = ".persona/workflow/backlog.md"
export const TASK_CARD_NAME = "00-task-card.md"

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
        sections.push({ number: current.number, title: current.title, body: current.lines.join("\n").trim() })
      }
      current = { number: heading.number, title: heading.title, lines: [] }
    } else if (current !== undefined) {
      current.lines.push(line)
    }
  }

  if (current !== undefined) {
    sections.push({ number: current.number, title: current.title, body: current.lines.join("\n").trim() })
  }

  return sections
}

export function taskCardPath(ticket: string): string {
  return `${WORK_DIR}/${ticket}/${TASK_CARD_NAME}`
}

export function historyTaskCardPath(ticket: string): string {
  return `${HISTORY_DIR}/${ticket}/${TASK_CARD_NAME}`
}

export function formatTaskCard(sourceFile: string, section: StepSection): string {
  const ticket = `step-${section.number}`
  const body = section.body.length > 0 ? section.body : "(No body was captured under this Step heading.)"
  return [
    `# Task Card: Step ${section.number}. ${section.title}`,
    "",
    "Status: pending",
    `Ticket: ${ticket}`,
    `Source: ${sourceFile}`,
    `Source heading: Step ${section.number}. ${section.title}`,
    "",
    "## Goal",
    "",
    `Implement Step ${section.number} from the source requirements.`,
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

export function formatBacklog(sourceFile: string, sections: readonly StepSection[]): string {
  const rows = sections.map((section, index) => {
    const ticket = `step-${section.number}`
    return `| ${index + 1} | ${ticket} | ${section.title} | pending | ${taskCardPath(ticket)} |`
  })
  return [
    "# Persona Workflow Backlog",
    "",
    `Source: ${sourceFile}`,
    "Status: active",
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

export function replaceBacklogTicket(markdown: string, ticketId: string): string {
  return markdown
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
}
