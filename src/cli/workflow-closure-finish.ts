import { findConventionByBlockerId } from "../config/convention-registry.js"
import type { ClosureBlocker, ClosurePayload, ClosureTicket } from "./workflow-closure.js"

export function workflowClosureFinishReasons(payload: ClosurePayload): readonly string[] {
  if (payload.state.finish === "passed" && payload.state.blockers.length === 0) {
    return []
  }
  return payload.state.blockers.map((blocker) => blockerFinishReason(blocker))
}

function blockerFinishReason(blocker: ClosureBlocker): string {
  if (blocker.id === "verification-failed") {
    if (isDirectVerificationReason(blocker.reason)) {
      return [
        `Closure blocker: ${blocker.id}`,
        `Verification failed: ${blocker.reason}`,
        "This is PH-run verification evidence, not generated app product-quality certification.",
        "Do not claim overall completion while verification failed.",
        "Required next actions:",
        "- Fix the compile/test failure reported by PH direct verification.",
        "- Re-run `npx ph workflow finish implement` or `npx ph workflow closure next --json` after the fix.",
      ].join("\n")
    }
    return [
      `Closure blocker: ${blocker.id}`,
      `Verification failed: ${blocker.reason}`,
      "This is workflow verification failure evidence, not generated app product-quality certification.",
      "Do not claim overall completion while verification failed.",
      "Required next actions:",
      "- Fix the compile/test failure.",
      "- Re-run `./gradlew test` or Windows `gradlew.bat test` through `npx ph bearshell`.",
      "- Re-run `npx ph workflow check`.",
    ].join("\n")
  }
  if (blocker.id === "verification-unknown") {
    if (isDirectVerificationReason(blocker.reason)) {
      return [
        `Closure blocker: ${blocker.id}`,
        `Verification evidence incomplete: ${blocker.reason}`,
        "Required next actions:",
        "- Ensure this Java/Spring/Gradle project has a supported verification command such as `./gradlew test` or Windows `gradlew.bat test`.",
        "- Re-run `npx ph workflow finish implement` or `npx ph workflow closure next --json`; PH will execute the verification command directly.",
      ].join("\n")
    }
    return [
      `Closure blocker: ${blocker.id}`,
      `Verification evidence incomplete: ${blocker.reason}`,
      "Required next actions:",
      "- Run test/build/runtime verification through `npx ph bearshell`.",
      "- Record explicit success/failure evidence in workflow reports.",
      "- Re-run `npx ph workflow check`.",
    ].join("\n")
  }
  if (blocker.id === "implementation-report-missing") {
    return [`Closure blocker: ${blocker.id}`, ".persona/workflow/implementation-report.md must be filled"].join("\n")
  }
  if (blocker.id === "review-report-missing") {
    return [
      `Closure blocker: ${blocker.id}`,
      `Implementation report is filled but review report is ${statusFromReason(blocker.reason)}.`,
      ".persona/workflow/review-report.md must be filled",
      "Next action: fill .persona/workflow/review-report.md after review/manual QA, then run `npx ph plan --report-filled review`.",
    ].join("\n")
  }
  if (blocker.id === "evidence-missing") {
    return [`Closure blocker: ${blocker.id}`, blocker.reason].join("\n")
  }
  if (blocker.id === "command-discipline-blocking") {
    return [`Closure blocker: ${blocker.id}`, `Command discipline blocking: ${blocker.reason}. Rerun final verification through \`npx ph bearshell\`.`].join("\n")
  }
  if (blocker.id === "report-coverage-missing") {
    return [
      `Closure blocker: ${blocker.id}`,
      `Report coverage missing: ${blocker.reason}`,
      "This is workflow evidence/read coverage missing, not generated app product-quality certification.",
      "Required next actions:",
      "- read README/profile/generated Java role files.",
      "- update implementation/review reports with actual coverage/checklist evidence.",
      "- Re-run `npx ph workflow check`.",
      "- Do not archive req tickets until review confirms requirements are satisfied.",
    ].join("\n")
  }
  if (blocker.id === "read-coverage-missing") {
    return [`Closure blocker: ${blocker.id}`, "README ranges read must be recorded in .persona/workflow/implementation-report.md before finish."].join("\n")
  }
  if (blocker.id === "profile-read-coverage-missing") {
    return [
      `Closure blocker: ${blocker.id}`,
      "Profile read coverage missing: project profile read coverage must be recorded in .persona/workflow/implementation-report.md. Record project profile read method/ranges before finish.",
    ].join("\n")
  }
  if (blocker.id === "java-role-read-coverage-missing") {
    return [
      `Closure blocker: ${blocker.id}`,
      `Java role read coverage missing: ${blocker.reason}`,
      "This is workflow evidence/read coverage missing, not generated app product-quality certification.",
      "Required next actions:",
      "- Read generated Controller/Service/Repository/Domain/DTO files.",
      "- Run role read follow-up if needed.",
      "- Re-run `npx ph workflow check`.",
    ].join("\n")
  }
  if (blocker.id === "stack-alignment-mismatch") {
    return [
      `Closure blocker: ${blocker.id}`,
      `Project profile and generated stack mismatch: ${blocker.reason}`,
      "This is a workflow/profile alignment gate, not generated app product-quality certification.",
      "Required next actions:",
      "- Re-read `.persona/project-profile.jsonc`.",
      "- Change the generated project to Spring Boot/Gradle/JPA/database structure.",
      "- Remove fake `gradle-shim.js`/Node shim files.",
      "- Re-run `npx ph workflow check`.",
    ].join("\n")
  }
  const convention = findConventionByBlockerId(blocker.id)
  if (convention !== undefined) {
    return [
      `Closure blocker: ${blocker.id}`,
      `Architecture convention violation: ${blocker.reason}`,
      `PH blocks the ${convention.id} convention violation in this scoped Java/Spring case.`,
      "This is a workflow architecture convention gate, not generated app product-quality certification.",
      "Required next actions:",
      `- ${convention.fixPath}`,
      "- Re-run `npx ph workflow check`.",
    ].join("\n")
  }
  if (blocker.id === "history-backlog-mismatch") {
    return [`Closure blocker: ${blocker.id}`, "Pending workflow tickets remain.", ...pendingTicketDetailLines(blocker.tickets ?? []), blocker.reason, `Repair backlog state: \`npx ph workflow archive ${ticketIdFromReason(blocker.reason)}\``].join("\n")
  }
  if (blocker.id === "pending-ticket") {
    return [
      `Closure blocker: ${blocker.id}`,
      `Pending workflow tickets remain: ${pendingTicketIds(blocker.tickets ?? [], blocker.reason)}.`,
      "Run `npx ph workflow next` to resume the next ticket.",
      "Do not claim overall completion while pending tickets remain.",
      ...pendingTicketDetailLines(blocker.tickets ?? []),
    ].join("\n")
  }
  return [`Closure blocker: ${blocker.id}`, blocker.reason].join("\n")
}

function pendingTicketIds(tickets: readonly ClosureTicket[], fallbackReason: string): string {
  return tickets.length > 0 ? tickets.map((ticket) => ticket.id).join(", ") : ticketIdFromReason(fallbackReason)
}

function pendingTicketDetailLines(tickets: readonly ClosureTicket[]): readonly string[] {
  return tickets.flatMap((ticket) => [
    `  Ticket: ${ticket.id}`,
    `  Title: ${ticket.title}`,
    `  Path: ${ticket.path}`,
    ...pendingTicketStateLines(ticket),
    "  Next command: `npx ph workflow next`",
    `  If this ticket is complete: \`npx ph workflow archive ${ticket.id}\``,
    `  If ${archiveCandidateLabel(ticket.id)} is actually complete after review: \`npx ph workflow archive ${ticket.id}\``,
    "  Archive is a candidate action only; do not auto-archive.",
    ...technicalConstraintLines(ticket),
  ])
}

function pendingTicketStateLines(ticket: ClosureTicket): readonly string[] {
  if (ticket.state === "history-only") {
    return ["  State: history exists but backlog still marks this ticket pending.", `  Repair backlog state: \`npx ph workflow archive ${ticket.id}\``]
  }
  if (ticket.state === "missing-work") {
    return ["  State: task card is missing from both active work and history.", "  Inspect `.persona/workflow/backlog.md` and workflow ticket directories before claiming completion."]
  }
  return []
}

function technicalConstraintLines(ticket: ClosureTicket): readonly string[] {
  if (!ticket.reviewArchiveCandidate || ticket.technicalSignals.length === 0) {
    return []
  }
  return [
    `  Technical constraints note: may already be satisfied by ${ticket.technicalSignals.join(", ")}.`,
    `  Archive only after review: \`npx ph workflow archive ${ticket.id}\``,
  ]
}

function archiveCandidateLabel(ticketId: string): string {
  return /^req[-_]?/iu.test(ticketId) ? "this req ticket" : "this ticket"
}

function ticketIdFromReason(reason: string): string {
  return reason.split(/\s+/u)[0] ?? "<ticket>"
}

function statusFromReason(reason: string): string {
  return reason.split(/\s+/u).at(-1) ?? "unknown"
}

function isDirectVerificationReason(reason: string): boolean {
  return reason.includes("PH direct verification")
}
