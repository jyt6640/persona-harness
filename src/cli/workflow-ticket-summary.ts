import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { BACKLOG_PATH, pendingTickets, type BacklogTicket } from "./workflow-ticket-model.js"

export type WorkflowPendingTicket = {
  readonly ticket: string
  readonly title: string
  readonly path: string
  readonly reviewArchiveCandidate: boolean
}

export const PENDING_TICKETS_COMPLETION_GUIDANCE = "Do not claim overall completion while pending tickets remain."
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

export function workflowPendingTicketStatus(projectDir: string): readonly WorkflowPendingTicket[] {
  return pendingWorkflowTickets(projectDir).map((ticket) => ({
    ticket: ticket.ticket,
    title: ticket.title,
    path: ticket.path,
    reviewArchiveCandidate: looksLikeTechnicalConstraints(ticket),
  }))
}

export function formatPendingWorkflowTicketStatusLines(tickets: readonly WorkflowPendingTicket[]): readonly string[] {
  if (tickets.length === 0) {
    return ["- pending tickets: none"]
  }
  return [
    "- pending tickets: present",
    PENDING_TICKETS_COMPLETION_GUIDANCE,
    ...tickets.flatMap((ticket) => [
      `  Ticket: ${ticket.ticket}`,
      `  Title: ${ticket.title}`,
      `  Path: ${ticket.path}`,
      "  Next command: `npx ph workflow next` or `npx ph workflow continue`",
      `  If ${archiveCandidateLabel(ticket.ticket)} is actually complete after review: \`npx ph workflow archive ${ticket.ticket}\``,
      "  Archive is a candidate action only; do not auto-archive.",
      ...(ticket.reviewArchiveCandidate
        ? ["  Note: technical constraints review/archive candidate; do not auto-archive."]
        : []),
    ]),
  ]
}

export function pendingWorkflowTicketResumeLines(ticket: BacklogTicket | undefined): readonly string[] {
  return ticket === undefined ? [] : [
    "Pending workflow ticket:",
    `Ticket: ${ticket.ticket}`,
    `Title: ${ticket.title}`,
    `Path: ${ticket.path}`,
    "Next command: npx ph workflow next",
    `If complete: npx ph workflow archive ${ticket.ticket}`,
    `If ${archiveCandidateLabel(ticket.ticket)} is actually complete after review: npx ph workflow archive ${ticket.ticket}`,
    "Archive is a candidate action only; do not auto-archive.",
    PENDING_TICKET_COMPLETION_GUIDANCE,
    "",
  ]
}
