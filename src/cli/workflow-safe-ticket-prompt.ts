import type { BacklogTicket } from "./workflow-ticket-model.js"
import {
  TICKET_BY_TICKET_GUIDANCE,
  TIMEBOXED_SCOPE_GUIDANCE,
} from "./workflow-ticket-summary.js"
import {
  safeArtifactReference,
  safeWorkflowCode,
  safeWorkflowCommand,
} from "./workflow-safe-rendering.js"

export function safePendingTicketResumeLines(
  ticket: BacklogTicket | undefined,
): readonly string[] {
  if (ticket === undefined) {
    return []
  }
  const ticketId = safeWorkflowCode(ticket.ticket, "invalid-ticket-code")
  const ticketPath = safeArtifactReference(ticket.path)
  const archiveCommand = safeWorkflowCommand(`npx ph workflow archive ${ticket.ticket}`)
  return [
    "Pending workflow ticket:",
    `Ticket: ${ticketId}`,
    "Status: pending",
    ...(ticketPath === undefined ? [] : [`Artifact: ${ticketPath}`]),
    "Next command: npx ph workflow next",
    "Next action: implement only this ticket, then review it before archiving.",
    ...(archiveCommand === undefined ? [] : [`After review: ${archiveCommand}`]),
    "Archive is a candidate action only; do not auto-archive.",
    TICKET_BY_TICKET_GUIDANCE,
    TIMEBOXED_SCOPE_GUIDANCE,
    "",
  ]
}
