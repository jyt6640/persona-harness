import type { CliRunResult } from "./bearshell.js"
import type { ClosureBlocker } from "./workflow-closure.js"
import {
  BACKLOG_PATH,
  DRAFT_REQUIREMENTS_ASSUMPTIONS_PATH,
  DRAFT_REQUIREMENTS_BACKLOG_PATH,
  DRAFT_REQUIREMENTS_QUESTIONS_PATH,
  LATEST_REQUIREMENTS_PATH,
  REQUIREMENTS_ANALYSIS_PATH,
  type RequirementSource,
} from "./workflow-ticket-model.js"
import { TICKET_BY_TICKET_GUIDANCE, TIMEBOXED_SCOPE_GUIDANCE } from "./workflow-ticket-summary.js"

export function uninitializedTicketOutput(): CliRunResult {
  return {
    status: 1,
    stdout: "",
    stderr: [
      "Persona Harness is not initialized for workflow tickets.",
      "",
      "Run `npx ph init` or `npx ph bootstrap backend` first.",
    ].join("\n") + "\n",
  }
}

export function splitConflictOutput(path: string): CliRunResult {
  return {
    status: 1,
    stdout: "",
    stderr: [
      "Workflow split refused to overwrite existing workflow state.",
      "",
      `Existing path: ${path}`,
      "",
      "Archive or remove the existing ticket state intentionally before splitting again.",
    ].join("\n") + "\n",
  }
}

export function missingRequirementSourceOutput(): CliRunResult {
  return {
    status: 1,
    stdout: "",
    stderr: [
      "Workflow requirement source not found.",
      "",
      "Provide a source file:",
      "- `npx ph workflow split README.md`",
      "",
      "Or capture prompt requirements first:",
      "- `npx ph workflow capture --stdin`",
      "- `npx ph workflow split`",
    ].join("\n") + "\n",
  }
}

export function backlogNotFoundOutput(): CliRunResult {
  return {
    status: 1,
    stdout: "",
    stderr: [
      "Workflow backlog not found.",
      "",
      "Run `npx ph workflow split README.md` first.",
    ].join("\n") + "\n",
  }
}

export function captureCompleteOutput(): CliRunResult {
  return {
    status: 0,
    stdout: [
      "Workflow requirements captured.",
      "",
      "Source kind: prompt",
      `Source path: ${LATEST_REQUIREMENTS_PATH}`,
      "",
      "Next:",
      "- `npx ph workflow split`",
      "- `npx ph workflow next`",
    ].join("\n") + "\n",
    stderr: "",
  }
}

export function draftCompleteOutput(): CliRunResult {
  return {
    status: 0,
    stdout: [
      "Requirements draft complete.",
      "",
      `Backlog: ${DRAFT_REQUIREMENTS_BACKLOG_PATH}`,
      `Questions: ${DRAFT_REQUIREMENTS_QUESTIONS_PATH}`,
      `Assumptions: ${DRAFT_REQUIREMENTS_ASSUMPTIONS_PATH}`,
      "",
      "Review gate:",
      "- Do not implement yet.",
      "- Ask the user to review the requirements draft.",
      "- Say `진행하자` after the user accepts the draft.",
      "",
      "Next after approval:",
      "- `npx ph workflow approve requirements`",
      `- \`npx ph workflow split ${DRAFT_REQUIREMENTS_BACKLOG_PATH}\``,
      "- `npx ph workflow next`",
    ].join("\n") + "\n",
    stderr: "",
  }
}

export function missingDraftRequirementsOutput(): CliRunResult {
  return {
    status: 1,
    stdout: "",
    stderr: [
      "Requirements draft not found.",
      "",
      `Expected: ${DRAFT_REQUIREMENTS_BACKLOG_PATH}`,
      "",
      "Create a draft first:",
      "- `npx ph workflow draft --stdin`",
    ].join("\n") + "\n",
  }
}

export function draftRequirementsConflictOutput(path: string): CliRunResult {
  return {
    status: 1,
    stdout: "",
    stderr: [
      "Requirements draft refused to overwrite existing draft artifacts.",
      "",
      `Existing path: ${path}`,
      "",
      "Review, approve, archive, or remove the draft intentionally before drafting again.",
    ].join("\n") + "\n",
  }
}

export function approvalCompleteOutput(): CliRunResult {
  return {
    status: 0,
    stdout: [
      "Requirements draft approved.",
      "",
      `Backlog: ${DRAFT_REQUIREMENTS_BACKLOG_PATH}`,
      "Status: accepted",
      "",
      "Next:",
      `- \`npx ph workflow split ${DRAFT_REQUIREMENTS_BACKLOG_PATH}\``,
      "- `npx ph workflow next`",
      "- `npx ph workflow implement`",
    ].join("\n") + "\n",
    stderr: "",
  }
}

export function splitCompleteOutput(source: RequirementSource, count: number): CliRunResult {
  return {
    status: 0,
    stdout: [
      "Workflow split complete.",
      "",
      `Source: ${source.label}`,
      `Source kind: ${source.kind}`,
      `Requirements analysis: ${REQUIREMENTS_ANALYSIS_PATH}`,
      `Backlog: ${BACKLOG_PATH}`,
      `Tickets created: ${count}`,
      "",
      "Scope strategy:",
      `- ${TICKET_BY_TICKET_GUIDANCE}`,
      `- ${TIMEBOXED_SCOPE_GUIDANCE}`,
      "",
      "Next:",
      "- `npx ph workflow next`",
    ].join("\n") + "\n",
    stderr: "",
  }
}

export function noPendingTicketsOutput(): CliRunResult {
  return {
    status: 0,
    stdout: [
      "Persona Workflow Next Ticket",
      "",
      "Status: complete",
      "No pending tickets remain in `.persona/workflow/backlog.md`.",
    ].join("\n") + "\n",
    stderr: "",
  }
}

export function nextTicketOutput(ticketId: string, title: string, path: string): CliRunResult {
  return {
    status: 0,
    stdout: [
      "Persona Workflow Next Ticket",
      "",
      `Ticket: ${ticketId}`,
      `Title: ${title}`,
      `Card: ${path}`,
      `Path: ${path}`,
      "",
      "Next:",
      "- Read the task card.",
      "- Implement only this ticket.",
      `- ${TICKET_BY_TICKET_GUIDANCE}`,
      "- Keep this as the current workflow ticket until it is archived.",
      `- When done, run \`npx ph workflow archive ${ticketId}\`.`,
    ].join("\n") + "\n",
    stderr: "",
  }
}

export function archiveCompleteOutput(ticketId: string, fromPath: string, toPath: string): CliRunResult {
  return {
    status: 0,
    stdout: [
      `Workflow ticket archived: ${ticketId}`,
      "",
      `From: ${fromPath}`,
      `To: ${toPath}`,
      "",
      "Next:",
      "- `npx ph workflow next`",
    ].join("\n") + "\n",
    stderr: "",
  }
}

export function archiveBlockedOutput(ticketId: string, blockers: readonly ClosureBlocker[]): CliRunResult {
  return {
    status: 1,
    stdout: "",
    stderr: [
      `Workflow ticket archive blocked: ${ticketId}`,
      "",
      "Archive requires the ticket to be reviewed against current workflow closure state.",
      "Resolve these non-ticket blockers before archiving:",
      ...blockers.map((blocker) => `- ${blocker.id}: ${blocker.reason}`),
      "",
      "Next:",
      "- Run `npx ph workflow closure next --json` for the first blocker.",
      "- Run `npx ph workflow check` after updating reports/evidence.",
      "- Do not archive or claim completion until blockers are resolved.",
    ].join("\n") + "\n",
  }
}

export function archiveBacklogRepairOutput(ticketId: string, historyPath: string): CliRunResult {
  return {
    status: 0,
    stdout: [
      `Workflow ticket archive state repaired: ${ticketId}`,
      "",
      `History: ${historyPath}`,
      "Backlog: .persona/workflow/backlog.md",
      "",
      "Next:",
      "- `npx ph workflow check`",
      "- `npx ph workflow finish implement`",
    ].join("\n") + "\n",
    stderr: "",
  }
}
