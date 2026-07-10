import type { CliRunResult } from "./bearshell.js"
import { workflowClosureFinishReasons, workflowFinishFollowUp } from "./workflow-closure-finish.js"
import { readWorkflowClosurePayload } from "./workflow-closure.js"
import { failedRunnerOutput, passedFinishOutput, type WorkflowRunnerKind } from "./workflow-output.js"

export function runWorkflowFinishResult(runnerKind: WorkflowRunnerKind, projectDir: string): CliRunResult {
  const payload = readWorkflowClosurePayload("next", projectDir, { recordTddGreenEvidence: true })
  const reasons = workflowClosureFinishReasons(payload, projectDir)
  if (reasons.length === 0) {
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
