import { findConventionByStepId } from "../config/convention-registry.js"
import { UNMAPPED_BLOCKER_STEP_ID, type ClosurePayload, type ClosureStep } from "./workflow-closure.js"
import { TRUSTED_AUTHORITY_REQUIRED_BLOCKER_ID } from "./workflow-finish-authority.js"
import { safeWorkflowCommand } from "./workflow-safe-rendering.js"

export type WorkflowFollowUpCommand = {
  readonly phase: "after-action" | "now"
  readonly value: string
}

export type WorkflowFinishFollowUp = {
  readonly action: string
  readonly blockerId: string
  readonly command?: WorkflowFollowUpCommand
}

export function workflowFinishFollowUp(payload: ClosurePayload): WorkflowFinishFollowUp | null {
  const step = payload.action === "next" ? payload.nextStep : payload.steps[0] ?? null
  return step === null || step.id === "terminal" || step.blockerId === undefined
    ? null
    : workflowFinishFollowUpForStep(step)
}

export function workflowFinishFollowUpForStep(step: ClosureStep): WorkflowFinishFollowUp {
  const blockerId = step.blockerId ?? "unmapped-blocker"
  if (step.id === TRUSTED_AUTHORITY_REQUIRED_BLOCKER_ID) {
    return {
      action: "No trusted Persona Harness or external authority receipt is available. Provide the fixed canonical-main finish-attestation bundle; keep unsigned project-local evidence diagnostic-only.",
      blockerId,
    }
  }
  if (step.id === "verify-app") {
    return {
      action: isDirectVerificationReason(step.reason)
        ? "Ensure the project has a supported verification command, then record the result through Persona Harness."
        : "Run the project's supported test/build/runtime verification and record the outcome in workflow evidence.",
      blockerId,
      command: isDirectVerificationReason(step.reason) ? undefined : afterActionCommand("npx ph workflow check"),
    }
  }
  if (step.id === "fix-verification") {
    return {
      action: isDirectVerificationReason(step.reason)
        ? "Fix the compile/test failure reported by Persona Harness verification."
        : "Fix the compile/test failure, rerun supported verification, and record the new outcome.",
      blockerId,
      command: isDirectVerificationReason(step.reason) ? undefined : afterActionCommand("npx ph workflow check"),
    }
  }
  if (step.id === "fill-implementation-report") {
    return {
      action: "Complete the required substantive content in .persona/workflow/implementation-report.md, including verification evidence, before marking it filled.",
      blockerId,
      command: commandForStep(step),
    }
  }
  if (step.id === "fill-review-report") {
    return {
      action: "Complete the required substantive content in .persona/workflow/review-report.md after review/manual QA before marking it filled.",
      blockerId,
      command: commandForStep(step),
    }
  }
  if (step.id === "record-workflow-evidence") {
    return {
      action: "Record workflow verification evidence.",
      blockerId,
      command: commandForStep(step),
    }
  }
  if (step.id === "record-tdd-red") {
    return {
      action: "Run the Persona Harness TDD test to record required failing-test evidence.",
      blockerId,
      command: commandForStep(step),
    }
  }
  if (step.id === "record-tdd-green") {
    return {
      action: "Run the targeted test after preserving required red evidence.",
      blockerId,
      command: commandForStep(step),
    }
  }
  if (step.id === "rerun-bearshell-verification") {
    return {
      action: "Rerun final test/build/runtime verification through Persona Harness bearshell and update the workflow reports.",
      blockerId,
      command: commandForStep(step),
    }
  }
  if (step.id === "fill-report-coverage") {
    return {
      action: "Read README, project-profile, and generated role context, then update workflow reports with actual coverage evidence.",
      blockerId,
      command: commandForStep(step),
    }
  }
  if (step.id === "record-read-coverage") {
    return {
      action: "Record README read coverage in the implementation report.",
      blockerId,
      command: commandForStep(step),
    }
  }
  if (step.id === "record-profile-read-coverage") {
    return {
      action: "Record project profile read coverage in the implementation report.",
      blockerId,
      command: commandForStep(step),
    }
  }
  if (step.id === "record-java-role-read-coverage") {
    return {
      action: "Record generated Java role read coverage in the implementation report.",
      blockerId,
      command: commandForStep(step),
    }
  }
  if (step.id === "archive-current-ticket") {
    return {
      action: "Review the current ticket and confirm it is complete before archiving it.",
      blockerId,
      command: commandForStep(step),
    }
  }
  if (step.id === "install-convention-toolchain") {
    return {
      action: "Install sg/ast-grep or lower the affected convention from block level.",
      blockerId,
      command: commandForStep(step),
    }
  }
  if (step.id === "fix-stack-alignment") {
    return {
      action: "Re-read .persona/project-profile.jsonc and align the generated Spring Boot/Gradle/JPA/database stack.",
      blockerId,
      command: commandForStep(step),
    }
  }
  if (step.id === UNMAPPED_BLOCKER_STEP_ID) {
    return {
      action: "Escalate the missing Persona Harness blocker mapping for maintainer review before retrying automation.",
      blockerId,
    }
  }
  const convention = findConventionByStepId(step.id)
  if (convention !== undefined) {
    return {
      action: convention.fixPath.charAt(0).toUpperCase() + convention.fixPath.slice(1),
      blockerId,
      command: commandForStep(step),
    }
  }
  if (step.id === "accept-plan") {
    return {
      action: "Create or accept the workflow plan before implementation.",
      blockerId,
      command: commandForStep(step),
    }
  }
  if (step.id === "repair-archive-state") {
    return {
      action: "Repair the archived ticket backlog state.",
      blockerId,
      command: commandForStep(step),
    }
  }
  if (step.command !== undefined) {
    return {
      action: "Run the registered closure command for this blocker.",
      blockerId,
      command: commandForStep(step),
    }
  }
  if (step.commandAfterContent !== undefined) {
    return {
      action: "Complete the registered workflow content for this blocker.",
      blockerId,
      command: commandForStep(step),
    }
  }
  return {
    action: "Inspect the registered closure diagnostic artifact for this blocker.",
    blockerId,
  }
}

export function workflowFinishFollowUpLines(followUp: WorkflowFinishFollowUp): readonly string[] {
  return [
    `Next action: ${followUp.action}`,
    ...(followUp.command === undefined ? [] : [`Next command: ${formatFollowUpCommand(followUp.command)}`]),
  ]
}

function commandForStep(step: ClosureStep): WorkflowFollowUpCommand | undefined {
  const command = safeWorkflowCommand(step.command)
  if (command !== undefined) {
    return { phase: "now", value: command }
  }
  const commandAfterContent = safeWorkflowCommand(step.commandAfterContent)
  if (commandAfterContent !== undefined) {
    return { phase: "after-action", value: commandAfterContent }
  }
  return undefined
}

function afterActionCommand(value: string): WorkflowFollowUpCommand {
  return { phase: "after-action", value }
}

function formatFollowUpCommand(command: WorkflowFollowUpCommand): string {
  return command.phase === "now"
    ? command.value
    : `after completing the action, run ${command.value}`
}

function isDirectVerificationReason(reason: string | undefined): boolean {
  return reason?.includes("PH direct verification") === true
}
