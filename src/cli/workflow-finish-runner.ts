import type { CliRunResult } from "./bearshell.js"
import { workflowClosureFinishReasons, workflowFinishFollowUp } from "./workflow-closure-finish.js"
import { workflowFinishFollowUpForStep } from "./workflow-finish-follow-up.js"
import { readWorkflowClosurePayload } from "./workflow-closure.js"
import { prepareCooperativeFinishContext } from "./cooperative-finish-context.js"
import { runCurrentProcessCooperativeFinish } from "./cooperative-finish-authority.js"
import { DEFAULT_FINISH_ASSURANCE_REQUIREMENT, type FinishAssuranceRequirement } from "./workflow-verification-decision.js"
import { failedRunnerOutput, passedFinishOutput, type WorkflowRunnerKind } from "./workflow-output.js"
import { readWorkflowFinishAuthority } from "./workflow-finish-authority.js"

export function runWorkflowFinishResult(
  runnerKind: WorkflowRunnerKind,
  projectDir: string,
  assurance: FinishAssuranceRequirement = DEFAULT_FINISH_ASSURANCE_REQUIREMENT,
): CliRunResult {
  if (assurance === "cooperative") return runCooperativeFinishResult(runnerKind, projectDir)
  const payload = readWorkflowClosurePayload("next", projectDir, { recordTddGreenEvidence: true })
  const reasons = workflowClosureFinishReasons(payload, projectDir)
  if (reasons.length === 0) {
    const authority = readWorkflowFinishAuthority(projectDir)
    if (authority.status === "blocked") {
      const blocker = authority.blocker
      const followUp = workflowFinishFollowUpForStep({
        blockerId: blocker.id,
        id: blocker.id,
        kind: "human-or-model-content",
        reason: blocker.reason,
        source: blocker.source,
        status: "blocked",
      })
      return failedRunnerOutput("finish", runnerKind, [], {
        blockerIds: [blocker.id],
        followUp,
      })
    }
    return passedFinishOutput(runnerKind)
  }
  const followUp = workflowFinishFollowUp(payload)
  return followUp === null
    ? failedRunnerOutput("finish", runnerKind, reasons)
    : failedRunnerOutput("finish", runnerKind, reasons, {
        blockerIds: payload.state.blockers.map((blocker) => blocker.id),
        followUp,
      })
}

function runCooperativeFinishResult(runnerKind: WorkflowRunnerKind, projectDir: string): CliRunResult {
  const context = prepareCooperativeFinishContext(projectDir)
  if (context.kind === "blocked") {
    return failedRunnerOutput("finish", runnerKind, [`Cooperative verification blocked: ${context.code}.`])
  }
  const payload = readWorkflowClosurePayload("next", projectDir, { recordTddGreenEvidence: false })
  const reasons = workflowClosureFinishReasons(payload, projectDir)
    .filter((reason) => reason.blockerId !== "trusted-authority-required")
  if (reasons.length > 0) return failedRunnerOutput("finish", runnerKind, reasons)

  const result = runCurrentProcessCooperativeFinish(projectDir)
  return result.kind === "passed"
    ? passedFinishOutput(runnerKind, "cooperative")
    : failedRunnerOutput("finish", runnerKind, [`Cooperative verification blocked: ${result.code}.`])
}
