import type { ClosurePayload, ClosureStep, ClosureTicket } from "./workflow-closure.js"

export const POST_BUILD_CLOSURE_NEXT_ACTION =
  "if build/test/runtime already pass, fill implementation and review reports, archive the completed ticket after review, then run `npx ph workflow finish implement`"

export function workflowClosureRailLines(payload: ClosurePayload): readonly string[] {
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
    "",
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
    return [
      "Action: run test/build/runtime verification and record success/failure evidence in the workflow reports.",
      "After evidence: npx ph workflow check",
    ]
  }
  if (step.id === "fix-verification") {
    return [
      "Action: fix the compile/test/runtime failure, rerun verification, and record the result in the workflow reports.",
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
