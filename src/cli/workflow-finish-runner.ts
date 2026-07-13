import type { CliRunResult } from "./bearshell.js"
import { workflowClosureFinishReasons, workflowFinishFollowUp } from "./workflow-closure-finish.js"
import { workflowFinishFollowUpForStep } from "./workflow-finish-follow-up.js"
import { readWorkflowClosurePayload } from "./workflow-closure.js"
import { failedRunnerOutput, passedFinishOutput, type WorkflowRunnerKind } from "./workflow-output.js"
import { readWorkflowFinishAuthority } from "./workflow-finish-authority.js"

export function runWorkflowFinishResult(runnerKind: WorkflowRunnerKind, projectDir: string): CliRunResult {
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
