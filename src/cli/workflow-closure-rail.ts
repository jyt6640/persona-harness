import { createContinuationPromptLines, type ContinuationPromptContext } from "./continuation-prompt.js"
import {
  workflowFinishFollowUpForStep,
  workflowFinishFollowUpLines,
} from "./workflow-finish-follow-up.js"
import type { ClosureBlocker, ClosurePayload, ClosureStep } from "./workflow-closure.js"
import {
  safeWorkflowCode,
  workflowDiagnosticReference,
  type WorkflowDiagnosticReference,
} from "./workflow-safe-rendering.js"

export const POST_BUILD_CLOSURE_NEXT_ACTION = "if build/test/runtime already pass, fill implementation and review reports, archive the completed ticket after review, then run `npx ph workflow finish implement`"

const MAX_ADDITIONAL_BLOCKERS = 7

export function workflowClosureRailLines(
  payload: ClosurePayload,
  context: Extract<ContinuationPromptContext, "cli-continue" | "closure-next"> = "cli-continue",
): readonly string[] {
  const step = nextStep(payload)
  if (step === null || step.id === "terminal") {
    return []
  }
  const blocker = blockerForStep(payload, step)
  const reference = blocker === null
    ? stepReference(step)
    : workflowDiagnosticReference(blocker, step)
  return [
    "Closure planner next step:",
    ...diagnosticReferenceLines(reference),
    ...workflowFinishFollowUpLines(workflowFinishFollowUpForStep(step)),
    ...closureContinuationPromptPreviewLines(blocker, step, context),
    ...additionalBlockerLines(payload, step),
    "",
  ]
}

function nextStep(payload: ClosurePayload): ClosureStep | null {
  if (payload.action === "next") {
    return payload.nextStep
  }
  return payload.steps[0] ?? null
}

function blockerForStep(payload: ClosurePayload, step: ClosureStep): ClosureBlocker | null {
  return payload.state.blockers.find((candidate) => candidate.id === step.blockerId)
    ?? payload.state.blockers[0]
    ?? null
}

function stepReference(step: ClosureStep): WorkflowDiagnosticReference {
  return {
    artifactRefs: [],
    blockerId: safeWorkflowCode(step.blockerId ?? "unmapped-blocker", "invalid-blocker-code"),
    status: step.status,
    stepId: safeWorkflowCode(step.id, "invalid-step-code"),
  }
}

function diagnosticReferenceLines(reference: WorkflowDiagnosticReference): readonly string[] {
  return [
    ...(reference.stepId === undefined ? [] : [`Step: ${reference.stepId}`]),
    `Blocker: ${reference.blockerId}`,
    ...(reference.status === undefined ? [] : [`Status: ${reference.status}`]),
    ...reference.artifactRefs.map((ref) => `Artifact: ${ref}`),
  ]
}

function closureContinuationPromptPreviewLines(
  blocker: ClosureBlocker | null,
  step: ClosureStep,
  context: Extract<ContinuationPromptContext, "cli-continue" | "closure-next">,
): readonly string[] {
  if (blocker === null) {
    return []
  }
  return [
    "",
    "Continuation prompt body:",
    ...createContinuationPromptLines({ blocker, context, step }).map((line) => `  ${line}`),
  ]
}

function additionalBlockerLines(payload: ClosurePayload, prioritizedStep: ClosureStep): readonly string[] {
  const blockers = payload.state.blockers
    .filter((blocker) => blocker.id !== prioritizedStep.blockerId)
    .slice(0, MAX_ADDITIONAL_BLOCKERS)
  if (blockers.length === 0) {
    return []
  }
  return [
    "",
    "Additional closure blockers:",
    ...blockers.flatMap((blocker) => {
      const step = payload.steps.find((candidate) => candidate.blockerId === blocker.id) ?? null
      const reference = workflowDiagnosticReference(blocker, step)
      return diagnosticReferenceLines(reference).map((line) => `- ${line}`)
    }),
  ]
}
