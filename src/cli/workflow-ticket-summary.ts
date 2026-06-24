import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { BACKLOG_PATH, pendingTickets, type BacklogTicket } from "./workflow-ticket-model.js"

export type WorkflowPendingTicket = {
  readonly ticket: string
  readonly title: string
  readonly path: string
  readonly reviewArchiveCandidate: boolean
}

export function pendingWorkflowTickets(projectDir: string): readonly BacklogTicket[] {
  const backlogAbsolutePath = join(projectDir, BACKLOG_PATH)
  return existsSync(backlogAbsolutePath) ? pendingTickets(readFileSync(backlogAbsolutePath, "utf8")) : []
}

function looksLikeTechnicalConstraints(ticket: Pick<BacklogTicket, "ticket" | "title" | "path">): boolean {
  return /technical constraints|constraints|기술|제약/i.test(`${ticket.ticket} ${ticket.title} ${ticket.path}`)
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
    ...tickets.flatMap((ticket) => [
      `  Ticket: ${ticket.ticket}`,
      `  Title: ${ticket.title}`,
      `  Path: ${ticket.path}`,
      "  Next command: `npx ph workflow next` or `npx ph workflow continue`",
      `  If complete after review: \`npx ph workflow archive ${ticket.ticket}\``,
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
    "",
  ]
}
