import type { CliRunResult } from "./bearshell.js"
import type { ProjectReadBoundary } from "../io/bootstrap-write-boundary.js"
import type { ProjectReadSnapshot } from "../io/project-read-snapshot.js"
import { workflowClosureFinishReasons, workflowFinishFollowUp } from "./workflow-closure-finish.js"
import { workflowFinishFollowUpForStep } from "./workflow-finish-follow-up.js"
import { readWorkflowClosurePayload } from "./workflow-closure.js"
import { prepareCooperativeFinishContext } from "./cooperative-finish-context.js"
import { runCurrentProcessCooperativeFinish } from "./cooperative-finish-authority.js"
import { DEFAULT_FINISH_ASSURANCE_REQUIREMENT, type FinishAssuranceRequirement } from "./workflow-verification-decision.js"
import {
  failedRunnerOutput,
  passedFinishOutput,
  sourceReadRuntimeUnavailableFinishOutput,
  type WorkflowRunnerKind,
} from "./workflow-output.js"
import { readWorkflowFinishAuthority } from "./workflow-finish-authority.js"

export function runWorkflowFinishResult(
  runnerKind: WorkflowRunnerKind,
  projectDir: string,
  assurance: FinishAssuranceRequirement = DEFAULT_FINISH_ASSURANCE_REQUIREMENT,
  projectRead?: {
    readonly boundary: ProjectReadBoundary
    readonly snapshot: ProjectReadSnapshot
  },
): CliRunResult {
  if (assurance === "cooperative") return runCooperativeFinishResult(runnerKind, projectDir, projectRead)
  const payload = readWorkflowClosurePayload("next", projectDir, {
    projectReadBoundary: projectRead?.boundary,
    projectReadSnapshot: projectRead?.snapshot,
    recordTddGreenEvidence: true,
  })
  const reasons = workflowClosureFinishReasons(payload, projectDir, projectRead?.snapshot)
  if (reasons.length === 0) {
    const authority = readWorkflowFinishAuthority(projectDir, {
      projectReadBoundary: projectRead?.boundary,
    })
    if (!authority.completion.passed) {
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

function runCooperativeFinishResult(
  runnerKind: WorkflowRunnerKind,
  projectDir: string,
  projectRead?: {
    readonly boundary: ProjectReadBoundary
    readonly snapshot: ProjectReadSnapshot
  },
): CliRunResult {
  const context = prepareCooperativeFinishContext(projectDir, projectRead?.boundary)
  if (context.kind === "blocked") {
    if (context.code === "source-read-runtime-unavailable") {
      return sourceReadRuntimeUnavailableFinishOutput(runnerKind)
    }
    return failedRunnerOutput("finish", runnerKind, [`Cooperative verification blocked: ${context.code}.`])
  }
  const payload = readWorkflowClosurePayload("next", projectDir, {
    projectReadBoundary: projectRead?.boundary,
    projectReadSnapshot: projectRead?.snapshot,
    recordTddGreenEvidence: false,
  })
  const reasons = workflowClosureFinishReasons(payload, projectDir, projectRead?.snapshot)
    .filter((reason) => reason.blockerId !== "trusted-authority-required")
  if (reasons.length > 0) return failedRunnerOutput("finish", runnerKind, reasons)

  const result = runCurrentProcessCooperativeFinish(projectDir, projectRead?.boundary, context.value)
  return result.kind === "passed"
    ? passedFinishOutput(runnerKind, "cooperative")
    : result.code === "source-read-runtime-unavailable"
      ? sourceReadRuntimeUnavailableFinishOutput(runnerKind)
      : failedRunnerOutput("finish", runnerKind, [`Cooperative verification blocked: ${result.code}.`])
}
