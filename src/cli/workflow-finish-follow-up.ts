import { findConventionByStepId } from "../config/convention-registry.js"
import { UNMAPPED_BLOCKER_STEP_ID, type ClosurePayload, type ClosureStep, type ClosureTicket } from "./workflow-closure.js"

export type WorkflowFinishFollowUp = {
  readonly action: string
  readonly blockerId: string
  readonly command: string
}

export function workflowFinishFollowUp(payload: ClosurePayload): WorkflowFinishFollowUp | null {
  const step = payload.action === "next" ? payload.nextStep : payload.steps[0] ?? null
  return step === null || step.id === "terminal" || step.blockerId === undefined
    ? null
    : workflowFinishFollowUpForStep(step, payload.state.currentTicket)
}

export function workflowFinishFollowUpForStep(
  step: ClosureStep,
  currentTicket: ClosureTicket | null,
): WorkflowFinishFollowUp {
  const blockerId = step.blockerId ?? "unmapped-blocker"
  if (step.id === "verify-app") {
    return {
      action: "Run supported test/build/runtime verification and record the outcome.",
      blockerId,
      command: verificationFollowUpCommand(step),
    }
  }
  if (step.id === "fix-verification") {
    return {
      action: "Fix the compile/test failure and record the new verification outcome.",
      blockerId,
      command: verificationFollowUpCommand(step),
    }
  }
  if (step.id === "fill-implementation-report") {
    return {
      action: "Fill the implementation report with verification evidence.",
      blockerId,
      command: step.commandAfterContent ?? "npx ph plan --report-filled implementation",
    }
  }
  if (step.id === "fill-review-report") {
    return {
      action: "Fill the review report after review/manual QA.",
      blockerId,
      command: step.commandAfterContent ?? "npx ph plan --report-filled review",
    }
  }
  if (step.id === "record-workflow-evidence") {
    return {
      action: "Record workflow verification evidence.",
      blockerId,
      command: "npx ph workflow check",
    }
  }
  if (step.id === "rerun-bearshell-verification") {
    return {
      action: "Rerun final verification through bearshell.",
      blockerId,
      command: step.command ?? "npx ph bearshell <verification command>",
    }
  }
  if (step.id === "fill-report-coverage") {
    return {
      action: "Read the required context and update workflow report coverage evidence.",
      blockerId,
      command: step.commandAfterContent ?? "npx ph workflow check",
    }
  }
  if (step.id === "record-read-coverage") {
    return {
      action: "Record README read coverage in the implementation report.",
      blockerId,
      command: step.commandAfterContent ?? "npx ph workflow check",
    }
  }
  if (step.id === "record-profile-read-coverage") {
    return {
      action: "Record project profile read coverage in the implementation report.",
      blockerId,
      command: step.commandAfterContent ?? "npx ph workflow check",
    }
  }
  if (step.id === "record-java-role-read-coverage") {
    return {
      action: "Record generated Java role read coverage in the implementation report.",
      blockerId,
      command: step.commandAfterContent ?? "npx ph workflow check",
    }
  }
  if (step.id === "archive-current-ticket") {
    return {
      action: "Review the current ticket and archive it only after review confirms completion.",
      blockerId,
      command: step.commandAfterContent ?? ticketArchiveCommand(currentTicket),
    }
  }
  if (step.id === "install-convention-toolchain") {
    return {
      action: "Restore the required convention toolchain or lower that convention level.",
      blockerId,
      command: step.commandAfterContent ?? "npx ph workflow check",
    }
  }
  if (step.id === "fix-stack-alignment") {
    return {
      action: "Align the generated project with the accepted profile.",
      blockerId,
      command: step.commandAfterContent ?? "npx ph workflow check",
    }
  }
  if (step.id === UNMAPPED_BLOCKER_STEP_ID) {
    return {
      action: "Escalate the missing Persona Harness blocker mapping for maintainer review.",
      blockerId,
      command: "npx ph workflow closure next --json",
    }
  }
  const convention = findConventionByStepId(step.id)
  if (convention !== undefined) {
    return {
      action: "Fix the architecture convention violation.",
      blockerId,
      command: step.commandAfterContent ?? "npx ph workflow check",
    }
  }
  if (step.command !== undefined) {
    return { action: "Run the prioritized closure command.", blockerId, command: step.command }
  }
  if (step.commandAfterContent !== undefined) {
    return {
      action: "Complete the prioritized closure action.",
      blockerId,
      command: step.commandAfterContent,
    }
  }
  return {
    action: "Inspect the prioritized closure diagnostic before changing workflow state.",
    blockerId,
    command: "npx ph workflow closure next --json",
  }
}

function verificationFollowUpCommand(step: ClosureStep): string {
  return step.reason?.includes("PH direct verification") === true
    ? "npx ph workflow closure next --json"
    : "npx ph workflow check"
}

function ticketArchiveCommand(currentTicket: ClosureTicket | null): string {
  return currentTicket === null
    ? "npx ph workflow closure next --json"
    : `npx ph workflow archive ${currentTicket.id}`
}
