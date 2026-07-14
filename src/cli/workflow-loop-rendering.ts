import {
  ruleDeliveryRoleForBlocker,
  ruleDeliveryStageForBlocker,
} from "../rules/rule-delivery.js"
import type { CliRunResult } from "./bearshell.js"
import type { BoundedProcessOutcome } from "./bounded-process.js"
import { continuationPromptCoreLines } from "./continuation-prompt.js"
import type { ClosureBlocker, ClosureStep } from "./workflow-closure.js"
import type {
  WorkflowLoopFinalDecision,
  WorkflowLoopIterationRecord,
} from "./workflow-loop-state.js"
import { safeArtifactReference, safeWorkflowCode } from "./workflow-safe-rendering.js"

const MAX_RENDERED_ITERATIONS = 16

export type WorkflowLoopResult = {
  readonly diagnosticCodes: readonly string[]
  readonly exitCode: 0 | 1
  readonly finalDecision: WorkflowLoopFinalDecision
  readonly success: boolean
}

export type WorkflowLoopPayload = WorkflowLoopResult & {
  readonly boundaries: readonly string[]
  readonly defaultOff: true
  readonly iterations: readonly WorkflowLoopIterationRecord[]
  readonly maxIterations: number
  readonly mode: "dry-run" | "execute"
  readonly promptPreview: readonly string[]
  readonly rulePackHash: string
  readonly schemaVersion: "workflow-loop.1"
  readonly statePath: string
  readonly termination: readonly string[]
}

type WorkflowLoopPromptInput = {
  readonly blocker: ClosureBlocker
  readonly depth: {
    readonly index: number
    readonly total: number
  }
  readonly rulePackHash: string
  readonly step: ClosureStep
}

export function workflowLoopResultForDecision(
  finalDecision: WorkflowLoopFinalDecision,
): WorkflowLoopResult {
  switch (finalDecision) {
    case "finish-passed":
      return { diagnosticCodes: [], exitCode: 0, finalDecision, success: true }
    case "child-failure":
      return { diagnosticCodes: ["child-failure"], exitCode: 1, finalDecision, success: false }
    case "iteration-cap":
      return { diagnosticCodes: ["iteration-cap"], exitCode: 1, finalDecision, success: false }
    case "no-blockers":
      return { diagnosticCodes: ["no-blockers-without-finish"], exitCode: 1, finalDecision, success: false }
    case "not-run":
      return { diagnosticCodes: ["dry-run-blocked"], exitCode: 1, finalDecision, success: false }
    case "output-limit":
      return { diagnosticCodes: ["child-output-limit"], exitCode: 1, finalDecision, success: false }
    case "signal":
      return { diagnosticCodes: ["child-signal"], exitCode: 1, finalDecision, success: false }
    case "spawn-failure":
      return { diagnosticCodes: ["child-spawn-failure"], exitCode: 1, finalDecision, success: false }
    case "state-conflict":
      return { diagnosticCodes: ["workflow-state-conflict"], exitCode: 1, finalDecision, success: false }
    case "timeout":
      return { diagnosticCodes: ["child-timeout"], exitCode: 1, finalDecision, success: false }
    case "unmapped-blocker":
      return { diagnosticCodes: ["unmapped-blocker"], exitCode: 1, finalDecision, success: false }
    default:
      return assertNever(finalDecision)
  }
}

export function workflowLoopPayload(
  input: Omit<WorkflowLoopPayload, "boundaries" | "termination">,
): WorkflowLoopPayload {
  return {
    ...input,
    boundaries: [
      "explicit command only; no hooks, no default runtime behavior, and no autonomous completion claim",
      "success is determined only by deterministic PH finish/closure gates",
      "no token-saving, product-efficacy, app-quality, or broad reliability claim",
    ],
    termination: [
      "finish exit 0",
      "no remaining closure blockers",
      "unmapped closure blocker diagnostic",
      "iteration cap",
    ],
  }
}

export function workflowLoopDecisionForChildOutcome(
  outcome: BoundedProcessOutcome,
): WorkflowLoopFinalDecision | undefined {
  switch (outcome) {
    case "failed":
      return "child-failure"
    case "output-limit":
      return "output-limit"
    case "passed":
      return undefined
    case "signal":
      return "signal"
    case "spawn-failure":
      return "spawn-failure"
    case "timeout":
      return "timeout"
    default:
      return assertNever(outcome)
  }
}

export function workflowLoopPrompt(input: WorkflowLoopPromptInput): readonly string[] {
  const deliveryRole = ruleDeliveryRoleForBlocker(input.blocker.id)
  const deliveryStage = ruleDeliveryStageForBlocker(input.blocker.id)
  return [
    "[Persona Harness Workflow Loop]",
    ...continuationPromptCoreLines(input.blocker, input.step, input.depth),
    `Rule role: ${deliveryRole}`,
    `Rule stage: ${deliveryStage ?? "none"}`,
    `Rule pack hash: ${input.rulePackHash}`,
    "Complete only the prioritized action and stop after the finish gate result is visible.",
  ]
}

export function formatWorkflowLoopPayload(
  payload: WorkflowLoopPayload,
  json: boolean,
): CliRunResult {
  const diagnosticCodes = payload.diagnosticCodes
    .slice(0, 8)
    .map((code) => safeWorkflowCode(code, "invalid-diagnostic-code"))
  const iterations = payload.iterations
    .slice(0, MAX_RENDERED_ITERATIONS)
    .map((iteration) => ({
      ...iteration,
      blockerId: safeWorkflowCode(iteration.blockerId, "invalid-blocker-code"),
      promptPath: safeArtifactReference(iteration.promptPath) ?? ".persona/workflow/loop",
      stderrPath: safeArtifactReference(iteration.stderrPath) ?? ".persona/workflow/loop",
      stdoutPath: safeArtifactReference(iteration.stdoutPath) ?? ".persona/workflow/loop",
    }))
  const rendering = {
    iterationCount: payload.iterations.length,
    renderedIterationCount: iterations.length,
    truncated: payload.iterations.length > iterations.length,
  }
  if (json) {
    return {
      status: payload.exitCode,
      stdout: `${JSON.stringify({ ...payload, diagnosticCodes, iterations, rendering }, null, 2)}\n`,
      stderr: "",
    }
  }
  return {
    status: payload.exitCode,
    stdout: [
      "Persona Harness workflow loop",
      `Mode: ${payload.mode}`,
      `Success: ${payload.success}`,
      `Final decision: ${payload.finalDecision}`,
      `Exit code: ${payload.exitCode}`,
      `Diagnostic codes: ${diagnosticCodes.length === 0 ? "none" : diagnosticCodes.join(", ")}`,
      `Iterations: ${payload.iterations.length}/${payload.maxIterations}; rendered: ${iterations.length}`,
      `State: ${payload.statePath}`,
      `Rule pack hash: ${payload.rulePackHash}`,
      "",
      "Termination:",
      ...payload.termination.map((line) => `- ${line}`),
      ...(payload.promptPreview.length === 0
        ? []
        : ["", "Prompt preview:", ...payload.promptPreview.map((line) => `  ${line}`)]),
      "",
      "Boundaries:",
      ...payload.boundaries.map((line) => `- ${line}`),
      "",
    ].join("\n"),
    stderr: "",
  }
}

function assertNever(value: never): never {
  throw new TypeError(`Unknown workflow loop value: ${String(value)}`)
}
