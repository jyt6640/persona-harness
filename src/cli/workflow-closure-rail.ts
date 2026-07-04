import { findConventionByBlockerId, findConventionByStepId } from "../config/convention-registry.js"
import { createContinuationPromptLines, type ContinuationPromptContext } from "./continuation-prompt.js"
import { UNMAPPED_BLOCKER_STEP_ID, type ClosureBlocker, type ClosurePayload, type ClosureStep, type ClosureTicket } from "./workflow-closure.js"

export const POST_BUILD_CLOSURE_NEXT_ACTION = "if build/test/runtime already pass, fill implementation and review reports, archive the completed ticket after review, then run `npx ph workflow finish implement`"

export function workflowClosureRailLines(
  payload: ClosurePayload,
  context: Extract<ContinuationPromptContext, "cli-continue" | "closure-next"> = "cli-continue",
): readonly string[] {
  const step = nextStep(payload)
  if (step === null || step.id === "terminal") {
    return []
  }
  return [
    "Closure planner next step:",
    `Step: ${step.id}`,
    ...(step.blockerId === undefined ? [] : [`Blocker: ${step.blockerId}`]),
    ...(step.reason === undefined ? [] : [`Reason: ${step.reason}`]),
    ...(step.source === undefined ? [] : [`Source: ${step.source}`]),
    ...stepActionLines(step, payload.state.currentTicket),
    ...closureContinuationPromptPreviewLines(payload, step, context),
    ...additionalBlockerLines(payload.state.blockers.slice(1)),
    "",
  ]
}

function closureContinuationPromptPreviewLines(
  payload: ClosurePayload,
  step: ClosureStep,
  context: Extract<ContinuationPromptContext, "cli-continue" | "closure-next">,
): readonly string[] {
  const blocker = payload.state.blockers.find((candidate) => candidate.id === step.blockerId) ?? payload.state.blockers[0]
  if (blocker === undefined) {
    return []
  }
  return [
    "",
    "Continuation prompt body:",
    ...createContinuationPromptLines({ blocker, context, step }).map((line) => `  ${line}`),
  ]
}

function nextStep(payload: ClosurePayload): ClosureStep | null {
  if (payload.action === "next") {
    return payload.nextStep
  }
  return payload.steps[0] ?? null
}

function stepActionLines(step: ClosureStep, currentTicket: ClosureTicket | null): readonly string[] {
  if (step.id === "verify-app") {
    if (isDirectVerificationReason(step.reason)) {
      return [
        "Action: ensure a supported verification command exists for this project, such as `./gradlew test` or Windows `gradlew.bat test`.",
        "After fix: npx ph workflow closure next --json",
      ]
    }
    return [
      "Action: run test/build/runtime verification and record success/failure evidence in the workflow reports.",
      "After evidence: npx ph workflow check",
    ]
  }
  if (step.id === "fix-verification") {
    if (isDirectVerificationReason(step.reason)) {
      return [
        `Verification failed: ${step.reason ?? "verification failed"}`,
        "Next action: fix the compile/test failure, then rerun `npx ph workflow closure next --json` or `npx ph workflow finish implement`; PH will execute verification directly.",
        "Do not claim overall completion while verification failed.",
      ]
    }
    return [
      `Verification failed: ${step.reason ?? "verification failed"}`,
      "Next action: fix the compile/test failure, rerun `./gradlew test` or Windows `gradlew.bat test`, then run `npx ph workflow check`.",
      "Action: fix the compile/test/runtime failure, rerun verification, and record the result in the workflow reports.",
      "Do not claim overall completion while verification failed.",
      "After evidence: npx ph workflow check",
    ]
  }
  if (step.id === "fill-implementation-report") {
    return [
      "Post-build closure checklist:",
      "If build/test/runtime already pass, do not start new app generation.",
      "Fill .persona/workflow/implementation-report.md with verification evidence, then run npx ph plan --report-filled implementation.",
      ...(step.commandAfterContent === undefined ? [] : [`After content: ${step.commandAfterContent}`]),
      "Fill .persona/workflow/review-report.md after review/manual QA, then run npx ph plan --report-filled review.",
      ...ticketClosureLines(currentTicket),
      "Run npx ph workflow finish implement before claiming completion.",
    ]
  }
  if (step.id === "fill-review-report") {
    return [
      "Fill .persona/workflow/review-report.md after review/manual QA, then run npx ph plan --report-filled review.",
      ...(step.commandAfterContent === undefined ? [] : [`After content: ${step.commandAfterContent}`]),
    ]
  }
  if (step.id === "archive-current-ticket") {
    return [
      ...ticketClosureLines(currentTicket),
      ...(step.commandAfterContent === undefined ? [] : [`After review: ${step.commandAfterContent}`]),
      "Archive is a candidate action only; do not auto-archive.",
    ]
  }
  if (step.id === "rerun-bearshell-verification") {
    return [
      "Final verification needs bearshell rerun.",
      ...(step.reason === undefined ? [] : [`Command discipline: ${step.reason}`]),
      "Next action: rerun final verification through `npx ph bearshell` for test/build/bootRun, update implementation/review reports, then run `npx ph workflow check`.",
      "Do not claim overall completion until final verification is recorded through bearshell.",
    ]
  }
  if (step.id === "fill-report-coverage") {
    return [
      "Reports say filled but required coverage is missing.",
      ...(step.reason === undefined ? [] : [`Report coverage: ${step.reason}`]),
      "Next action: read README/profile/generated Java role files, then update implementation/review reports with actual coverage/checklist evidence.",
      "Do not archive req tickets until review confirms requirements are satisfied.",
    ]
  }
  if (step.id === "record-java-role-read-coverage") {
    return [
      ...(step.reason === undefined ? [] : [`Java role read coverage missing: ${step.reason}`]),
      "Next action: read generated Controller/Service/Repository/Domain/DTO files, then rerun `npx ph workflow check`.",
    ]
  }
  if (step.id === "fix-stack-alignment") {
    return [
      ...(step.reason === undefined ? [] : [`Project profile and generated stack mismatch: ${step.reason}`]),
      "Next action: re-read `.persona/project-profile.jsonc`, align the generated stack, then rerun `npx ph workflow check`.",
    ]
  }
  if (step.id === UNMAPPED_BLOCKER_STEP_ID) {
    return [
      ...(step.reason === undefined ? [] : [`Unmapped closure blocker: ${step.reason}`]),
      "Next action: stop the continuation loop and escalate the missing PH blocker-to-step mapping to configuration or maintainer review.",
      "Do not rerun `npx ph workflow finish implement` or `npx ph workflow check` as the direct next action for this blocker.",
    ]
  }
  const stepConvention = findConventionByStepId(step.id)
  if (stepConvention !== undefined) {
    return [
      ...(step.reason === undefined ? [] : [`Architecture convention violation: ${step.reason}`]),
      `Next action: ${stepConvention.fixPath}, then rerun \`npx ph workflow check\`.`,
    ]
  }
  if (step.command !== undefined) {
    return [`Command: ${step.command}`]
  }
  if (step.commandAfterContent !== undefined) {
    return [`After content: ${step.commandAfterContent}`]
  }
  return []
}

function ticketClosureLines(currentTicket: ClosureTicket | null): readonly string[] {
  if (currentTicket === null) {
    return ["Review completed pending tickets; archive only tickets that are satisfied after review."]
  }
  const ticketLabel = /^req[-_]?/iu.test(currentTicket.id) ? "req ticket" : "ticket"
  return [`Review the current ${ticketLabel}; if it is satisfied, run npx ph workflow archive ${currentTicket.id}.`]
}

function additionalBlockerLines(blockers: readonly ClosureBlocker[]): readonly string[] {
  return blockers.flatMap((blocker) => {
    const lines = blockerRailLines(blocker)
    return lines.length === 0 ? [] : ["", `Additional closure blocker: ${blocker.id}`, ...lines]
  })
}

function blockerRailLines(blocker: ClosureBlocker): readonly string[] {
  if (blocker.id === "command-discipline-blocking") {
    return [
      "Final verification needs bearshell rerun.",
      `Command discipline: ${blocker.reason}`,
      "Next action: rerun final verification through `npx ph bearshell` for test/build/bootRun, update implementation/review reports, then run `npx ph workflow check`.",
      "Do not claim overall completion until final verification is recorded through bearshell.",
    ]
  }
  if (blocker.id === "review-report-missing") {
    return [
      `Implementation report is filled but review report is ${statusFromReason(blocker.reason)}.`,
      "Next action: fill .persona/workflow/review-report.md after review/manual QA, then run npx ph plan --report-filled review.",
      "Do not claim overall completion until review report is filled and finish passes.",
    ]
  }
  if (blocker.id === "report-coverage-missing") {
    return [
      "Reports say filled but required coverage is missing.",
      `Report coverage: ${blocker.reason}`,
      "Next action: read README/profile/generated Java role files, then update implementation/review reports with actual coverage/checklist evidence.",
      "Do not archive req tickets until review confirms requirements are satisfied.",
    ]
  }
  const blockerConvention = findConventionByBlockerId(blocker.id)
  if (blockerConvention !== undefined) {
    return [
      `Architecture convention violation: ${blocker.reason}`,
      `Next action: ${blockerConvention.fixPath}, then rerun \`npx ph workflow check\`.`,
    ]
  }
  return []
}

function statusFromReason(reason: string): string {
  return reason.split(/\s+/u).at(-1) ?? "unknown"
}

function isDirectVerificationReason(reason: string | undefined): boolean {
  return reason?.includes("PH direct verification") === true
}
