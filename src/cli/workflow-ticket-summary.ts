import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { BACKLOG_PATH, HISTORY_DIR, pendingTickets, TASK_CARD_NAME, type BacklogTicket, WORK_DIR } from "./workflow-ticket-model.js"

export type WorkflowPendingTicket = {
  readonly ticket: string
  readonly title: string
  readonly path: string
  readonly reviewArchiveCandidate: boolean
  readonly archiveState: PendingTicketArchiveState
}

export type PendingTicketArchiveState = "active-work" | "history-only" | "missing-work"

export const PENDING_TICKETS_COMPLETION_GUIDANCE = "Do not claim overall completion while pending tickets remain."
export const TICKET_BY_TICKET_GUIDANCE =
  "Work one ticket at a time; do not open later tickets until the current ticket is implemented, reviewed, and archived."
export const TIMEBOXED_SCOPE_GUIDANCE =
  "For time-boxed or eval runs, split a smaller requirements source so every pending ticket can be honestly finished."
const PENDING_TICKET_COMPLETION_GUIDANCE = "Do not claim overall completion while this ticket remains pending."

export function pendingWorkflowTickets(projectDir: string): readonly BacklogTicket[] {
  const backlogAbsolutePath = join(projectDir, BACKLOG_PATH)
  return existsSync(backlogAbsolutePath) ? pendingTickets(readFileSync(backlogAbsolutePath, "utf8")) : []
}

function looksLikeTechnicalConstraints(ticket: Pick<BacklogTicket, "ticket" | "title" | "path">): boolean {
  return /technical constraints|constraints|기술|제약/i.test(`${ticket.ticket} ${ticket.title} ${ticket.path}`)
}

function archiveCandidateLabel(ticketId: string): string {
  return /^req[-_]?/i.test(ticketId) ? "this req ticket" : "this ticket"
}

export function pendingTicketArchiveState(projectDir: string, ticketId: string): PendingTicketArchiveState {
  if (existsSync(join(projectDir, WORK_DIR, ticketId, TASK_CARD_NAME))) {
    return "active-work"
  }
  if (existsSync(join(projectDir, HISTORY_DIR, ticketId, TASK_CARD_NAME))) {
    return "history-only"
  }
  return "missing-work"
}

function pendingTicketStateLines(ticketId: string, archiveState: PendingTicketArchiveState): readonly string[] {
  if (archiveState === "history-only") {
    return [
      "  State: history exists but backlog still marks this ticket pending.",
      `  Repair backlog state: \`npx ph workflow archive ${ticketId}\``,
    ]
  }
  if (archiveState === "missing-work") {
    return [
      "  State: task card is missing from both active work and history.",
      "  Inspect `.persona/workflow/backlog.md` and workflow ticket directories before claiming completion.",
    ]
  }
  return []
}

function taskCardContextLines(ticket: BacklogTicket, projectDir: string | undefined): readonly string[] {
  if (projectDir === undefined) {
    return []
  }
  const taskCardAbsolutePath = join(projectDir, ticket.path)
  if (!existsSync(taskCardAbsolutePath)) {
    return []
  }
  const contextLines = readFileSync(taskCardAbsolutePath, "utf8")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) =>
      line.length > 0
      && !/^Status:/iu.test(line)
      && !/^Ticket:/iu.test(line)
      && !/^Source(?:\s|:)/iu.test(line)
    )
    .slice(0, 8)
  return contextLines.length === 0 ? [] : ["Task card context:", ...contextLines.map((line) => `- ${line}`)]
}

export function workflowPendingTicketStatus(projectDir: string): readonly WorkflowPendingTicket[] {
  return pendingWorkflowTickets(projectDir).map((ticket) => ({
    ticket: ticket.ticket,
    title: ticket.title,
    path: ticket.path,
    reviewArchiveCandidate: looksLikeTechnicalConstraints(ticket),
    archiveState: pendingTicketArchiveState(projectDir, ticket.ticket),
  }))
}

export function formatPendingWorkflowTicketStatusLines(tickets: readonly WorkflowPendingTicket[]): readonly string[] {
  if (tickets.length === 0) {
    return ["- pending tickets: none"]
  }
  return [
    "- pending tickets: present",
    PENDING_TICKETS_COMPLETION_GUIDANCE,
    TICKET_BY_TICKET_GUIDANCE,
    TIMEBOXED_SCOPE_GUIDANCE,
    ...tickets.flatMap((ticket) => [
      `  Ticket: ${ticket.ticket}`,
      `  Title: ${ticket.title}`,
      `  Path: ${ticket.path}`,
      ...pendingTicketStateLines(ticket.ticket, ticket.archiveState),
      "  Next command: `npx ph workflow next` or `npx ph workflow continue`",
      `  If ${archiveCandidateLabel(ticket.ticket)} is actually complete after review: \`npx ph workflow archive ${ticket.ticket}\``,
      "  Archive is a candidate action only; do not auto-archive.",
      ...(ticket.reviewArchiveCandidate
        ? ["  Note: technical constraints review/archive candidate; do not auto-archive."]
        : []),
    ]),
  ]
}

export function pendingWorkflowTicketResumeLines(ticket: BacklogTicket | undefined, projectDir?: string): readonly string[] {
  const stateLines = ticket === undefined || projectDir === undefined ? [] : pendingTicketStateLines(ticket.ticket, pendingTicketArchiveState(projectDir, ticket.ticket))
  return ticket === undefined ? [] : [
    "Pending workflow ticket:",
    `Ticket: ${ticket.ticket}`,
    `Title: ${ticket.title}`,
    `Path: ${ticket.path}`,
    ...stateLines.map((line) => line.replace(/^  /u, "")),
    ...taskCardContextLines(ticket, projectDir),
    "Next command: npx ph workflow next",
    "Next action: implement only this ticket, then review and archive it when complete.",
    `If complete: npx ph workflow archive ${ticket.ticket}`,
    `If ${archiveCandidateLabel(ticket.ticket)} is actually complete after review: npx ph workflow archive ${ticket.ticket}`,
    "Archive is a candidate action only; do not auto-archive.",
    PENDING_TICKET_COMPLETION_GUIDANCE,
    TICKET_BY_TICKET_GUIDANCE,
    TIMEBOXED_SCOPE_GUIDANCE,
    "",
  ]
}
