import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { BACKLOG_PATH, pendingTickets, type BacklogTicket } from "./workflow-ticket-model.js"

export function pendingWorkflowTickets(projectDir: string): readonly BacklogTicket[] {
  const backlogAbsolutePath = join(projectDir, BACKLOG_PATH)
  return existsSync(backlogAbsolutePath) ? pendingTickets(readFileSync(backlogAbsolutePath, "utf8")) : []
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
