import { resolve } from "node:path"
import process from "node:process"

import type { CliRunResult } from "./bearshell.js"
import type { ClosureBlocker, ClosureStep } from "./workflow-closure.js"
import { closureStepNextAction, createContinuationPromptLines } from "./continuation-prompt.js"
import { readWorkflowClosurePayload } from "./workflow-closure.js"

const RALPH_LOOP_MAX_ATTEMPTS = 3

type RalphLoopOptions = {
  readonly json: boolean
  readonly projectDir?: string
}

type RalphLoopPayload = {
  readonly schemaVersion: "workflow-ralph-loop.1"
  readonly name: "ralph-loop"
  readonly subtitle: "blocker-driven continuation"
  readonly mode: "dry-run"
  readonly mutates: false
  readonly defaultOff: true
  readonly retryPolicy: {
    readonly maxAttempts: number
    readonly attemptsUsed: number
    readonly remainingAttempts: number
    readonly stateSource: "not-persisted-dry-run"
  }
  readonly state: {
    readonly blockerCount: number
    readonly finish: "blocked" | "passed"
  }
  readonly retry: {
    readonly eligible: boolean
    readonly reason: "closure-blocker-present" | "no-closure-blockers"
  }
  readonly blocker: ClosureBlocker | null
  readonly nextStep: ClosureStep | null
  readonly nextAction: string | null
  readonly promptLines: readonly string[]
  readonly measurementPlan: {
    readonly sample: "n=30 blocker/completion A/B"
    readonly metrics: readonly string[]
    readonly killCriteria: readonly string[]
  }
  readonly boundaries: readonly string[]
}

export function runWorkflowRalphLoopCommand(options: RalphLoopOptions): CliRunResult {
  const projectDir = resolve(options.projectDir ?? process.cwd())
  const payload = ralphLoopPayload(projectDir)
  if (options.json) {
    return { status: 0, stdout: `${JSON.stringify(payload, null, 2)}\n`, stderr: "" }
  }
  return { status: 0, stdout: `${formatRalphLoopText(payload)}\n`, stderr: "" }
}

function ralphLoopPayload(projectDir: string): RalphLoopPayload {
  const closure = readWorkflowClosurePayload("next", projectDir)
  const blocker = closure.state.blockers[0] ?? null
  const nextStep = closure.action === "next" ? closure.nextStep : null
  return {
    schemaVersion: "workflow-ralph-loop.1",
    name: "ralph-loop",
    subtitle: "blocker-driven continuation",
    mode: "dry-run",
    mutates: false,
    defaultOff: true,
    retryPolicy: {
      maxAttempts: RALPH_LOOP_MAX_ATTEMPTS,
      attemptsUsed: 0,
      remainingAttempts: RALPH_LOOP_MAX_ATTEMPTS,
      stateSource: "not-persisted-dry-run",
    },
    state: {
      blockerCount: closure.state.blockers.length,
      finish: closure.state.finish,
    },
    retry: {
      eligible: blocker !== null,
      reason: blocker === null ? "no-closure-blockers" : "closure-blocker-present",
    },
    blocker,
    nextStep,
    nextAction: nextStep === null ? null : closureStepNextAction(nextStep),
    promptLines: blocker === null ? [] : createContinuationPromptLines({ blocker, context: "ralph-loop", step: nextStep }),
    measurementPlan: {
      sample: "n=30 blocker/completion A/B",
      metrics: [
        "early-completion rate",
        "unresolved closure blocker count",
        "retry attempts",
        "runaway retry rate",
        "finish status",
        "elapsed/provider/read/tool telemetry when available",
      ],
      killCriteria: [
        "no completion-integrity improvement",
        "runaway retry rate exceeds the configured cap",
        "cost or elapsed overhead exceeds the accepted measurement budget",
      ],
    },
    boundaries: [
      "default-off preview",
      "read-only dry-run; no workflow state or evidence is written",
      "closure blockers are deterministic PH gate output, not LLM self-judgment",
      "retry-capped; no infinite loop",
      "not a success, reliability, generated-app quality, or closure guarantee",
    ],
  }
}

function formatRalphLoopText(payload: RalphLoopPayload): string {
  const lines = [
    "Persona Harness ralph-loop: blocker-driven continuation",
    "Mode: dry-run (read-only, default-off, no prompt sent)",
    `Closure blockers: ${payload.state.blockerCount}`,
    `Finish state: ${payload.state.finish}`,
    `Retry cap: ${payload.retryPolicy.maxAttempts} attempts; dry-run attempts used: ${payload.retryPolicy.attemptsUsed}`,
  ]
  if (payload.blocker === null) {
    lines.push("Result: no closure blockers remain; continuation is not eligible.")
  } else {
    lines.push(
      "Result: continuation is eligible because closure blockers remain.",
      "Early completion: blocked by PH closure gate until `npx ph workflow finish implement` passes.",
      `First blocker: ${payload.blocker.id}`,
      `Reason: ${payload.blocker.reason}`,
      `Source: ${payload.blocker.source}`,
    )
    if (payload.nextAction !== null) {
      lines.push(`Next action: ${payload.nextAction}`)
    }
    lines.push("", "Prompt preview:", ...payload.promptLines.map((line) => `  ${line}`))
  }
  lines.push(
    "",
    "Measurement plan:",
    `- ${payload.measurementPlan.sample}`,
    ...payload.measurementPlan.metrics.map((metric) => `- metric: ${metric}`),
    ...payload.measurementPlan.killCriteria.map((criterion) => `- kill: ${criterion}`),
    "",
    "Boundaries:",
    ...payload.boundaries.map((boundary) => `- ${boundary}`),
  )
  return lines.join("\n")
}
