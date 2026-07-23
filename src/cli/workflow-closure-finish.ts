import { findConventionByBlockerId } from "../config/convention-registry.js"
import { CONVENTION_TOOLCHAIN_MISSING_BLOCKER_ID } from "./architecture-conventions.js"
import { workflowFinishFollowUpForStep } from "./workflow-finish-follow-up.js"
import { TRUSTED_AUTHORITY_REQUIRED_BLOCKER_ID } from "./workflow-finish-authority.js"
import { personaHarnessSelfProfileGuidance } from "./self-profile-guidance.js"
import { UNMAPPED_BLOCKER_STEP_ID, type ClosureBlocker, type ClosurePayload, type ClosureStep, type ClosureTicket } from "./workflow-closure.js"
import type { StructuredWorkflowRequiredFix } from "./workflow-required-fix.js"

export { workflowFinishFollowUp } from "./workflow-finish-follow-up.js"

export function workflowClosureFinishReasons(payload: ClosurePayload, projectDir?: string): readonly StructuredWorkflowRequiredFix[] {
  if (payload.state.finish === "passed" && payload.state.blockers.length === 0) {
    return []
  }
  return payload.state.blockers.map((blocker) => {
    const step = payload.steps.find((candidate) => candidate.blockerId === blocker.id) ?? null
    return {
      blockerId: blocker.id,
      detail: blockerFinishReason(blocker, projectDir),
      nextAction: step === null ? null : workflowFinishFollowUpForStep(step).action,
      reason: blocker.reason,
      source: blocker.source,
      step: step === null ? null : {
        command: step.command,
        commandAfterContent: step.commandAfterContent,
        id: step.id,
        kind: step.kind,
        status: step.status,
      },
      type: "closure-blocker",
    }
  })
}

function blockerFinishReason(blocker: ClosureBlocker, projectDir?: string): string {
  if (blocker.id === TRUSTED_AUTHORITY_REQUIRED_BLOCKER_ID) {
    return [
      `Closure blocker: ${blocker.id}`,
      blocker.reason,
      "Unsigned project-local evidence remains diagnostic-only until a trusted P3 authority path exists.",
    ].join("\n")
  }
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
  if (blocker.id === "implementation-report-conflicting" || blocker.id === "implementation-report-malformed") {
    return [
      `Closure blocker: ${blocker.id}`,
      `Implementation report status is not trustworthy: ${blocker.reason}`,
      "Do not choose a legacy or frontmatter status marker by fallback.",
      "Correct the report status markers, then re-run `npx ph workflow check`.",
    ].join("\n")
  }
  if (blocker.id === "review-report-missing") {
    return [
      `Closure blocker: ${blocker.id}`,
      `Implementation report is filled but review report is ${statusFromReason(blocker.reason)}.`,
      ".persona/workflow/review-report.md must be filled",
      "Next action: fill .persona/workflow/review-report.md after review/manual QA, then run `npx ph plan --report-filled review`.",
    ].join("\n")
  }
  if (blocker.id === "review-report-conflicting" || blocker.id === "review-report-malformed") {
    return [
      `Closure blocker: ${blocker.id}`,
      `Review report status is not trustworthy: ${blocker.reason}`,
      "Do not choose a legacy or frontmatter status marker by fallback.",
      "Correct the report status markers, then re-run `npx ph workflow check`.",
    ].join("\n")
  }
  if (blocker.id === "evidence-missing") {
    return [`Closure blocker: ${blocker.id}`, blocker.reason].join("\n")
  }
  if (blocker.id === "workflow-loop-state-absent") {
    return [
      `Closure blocker: ${blocker.id}`,
      "No persisted workflow-loop state is available.",
      "Run the explicit bounded workflow loop to establish its state before continuing.",
    ].join("\n")
  }
  if (blocker.id === "workflow-loop-state-malformed" || blocker.id === "workflow-loop-state-stale") {
    return [
      `Closure blocker: ${blocker.id}`,
      `Persisted workflow-loop state is not safe to continue: ${blocker.reason}`,
      "Review the state and rule-pack identity before replacing it; do not silently recover or continue from it.",
    ].join("\n")
  }
  if (blocker.id === "ralph-loop-state-absent") {
    return [
      `Closure blocker: ${blocker.id}`,
      "No persisted ralph-loop state is available.",
      "Establish it through the approved bounded runtime before continuing.",
    ].join("\n")
  }
  if (blocker.id === "ralph-loop-state-malformed") {
    return [
      `Closure blocker: ${blocker.id}`,
      `Persisted ralph-loop state is not safe to continue: ${blocker.reason}`,
      "Review the state before replacing it; do not silently recover or continue from it.",
    ].join("\n")
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
      ...personaHarnessSelfProfileGuidance(projectDir).map((line) => `- ${line}`),
      "- Change the generated project to Spring Boot/Gradle/JPA/database structure.",
      "- Remove fake `gradle-shim.js`/Node shim files.",
      "- Re-run `npx ph workflow check`.",
    ].join("\n")
  }
  if (blocker.id === CONVENTION_TOOLCHAIN_MISSING_BLOCKER_ID) {
    return [
      `Closure blocker: ${blocker.id}`,
      `Convention toolchain missing: ${blocker.reason}`,
      "A block-level toolchain-dependent convention check could not run because ast-grep is unavailable.",
      "Required next actions:",
      "- Install `sg`/ast-grep or set `PH_AST_GREP_BIN`.",
      "- Or lower that convention level to `warn`/`report` if block fail-closed is not intended for this workspace.",
      "- Re-run `npx ph workflow check` after the toolchain/configuration action.",
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
  return unmappedBlockerFinishReason(blocker)
}

function unmappedBlockerFinishReason(blocker: ClosureBlocker): string {
  return [
    `Closure blocker: ${blocker.id}`,
    `Unmapped closure blocker: ${blocker.reason}`,
    `The blocker id has no closure step mapping: ${blocker.id}.`,
    "Treat this as a PH bug or unregistered convention.",
    "Required next actions:",
    "- escalate to Persona Harness configuration/maintainer review.",
    "- Register a closure step mapping for this blocker id before retrying automated continuation.",
    "- Do not directly rerun `npx ph workflow finish implement` or `npx ph workflow check` as the next action for this blocker.",
  ].join("\n")
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
