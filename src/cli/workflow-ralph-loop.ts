import { resolve } from "node:path"
import process from "node:process"

import type { CliRunResult } from "./bearshell.js"
import type { ClosureBlocker, ClosureStep } from "./workflow-closure.js"
import { closureStepNextAction, createContinuationPromptLines } from "./continuation-prompt.js"
import { readWorkflowClosurePayload } from "./workflow-closure.js"
import { loadHarnessConfig } from "../config/harness-config.js"
import { readRalphLoopState, ralphLoopStatePath } from "../runtime/ralph-loop-state.js"

type RalphLoopOptions = {
  readonly json: boolean
  readonly projectDir?: string
}

type RalphLoopPayload = {
  readonly schemaVersion: "workflow-ralph-loop.4"
  readonly name: "ralph-loop"
  readonly subtitle: "blocker-driven continuation"
  readonly mode: "dry-run"
  readonly mutates: false
  readonly defaultOff: true
  readonly execution: {
    readonly cooldownMs: number
    readonly enabled: boolean
    readonly ordinaryIdleContinuationDisabledWhenEnabled: true
    readonly statePath: string
    readonly runtimeSurface: "session.idle" | "tool.execute.after"
    readonly runtimeSurfaces: readonly ("session.idle" | "tool.execute.after")[]
    readonly toolOutputTriggerEnabled: boolean
  }
  readonly retryPolicy: {
    readonly maxAttempts: number
    readonly maxSessionAttempts: number
    readonly attemptsUsed: number
    readonly knownSessions: number
    readonly remainingSessionAttempts: number
    readonly stateSource: "persisted-workflow-state"
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
  const config = loadHarnessConfig(projectDir)
  const persistedState = readRalphLoopState(projectDir)
  const closure = readWorkflowClosurePayload("next", projectDir)
  const blocker = closure.state.blockers[0] ?? null
  const nextStep = closure.action === "next" ? closure.nextStep : null
  const knownSessions = Object.keys(persistedState.sessions).length
  const depth = blocker === null ? undefined : { index: 1, total: closure.state.blockers.length }
  return {
    schemaVersion: "workflow-ralph-loop.4",
    name: "ralph-loop",
    subtitle: "blocker-driven continuation",
    mode: "dry-run",
    mutates: false,
    defaultOff: true,
    execution: {
      cooldownMs: config.enforce.ralphLoop.cooldownMs,
      enabled: config.enforce.ralphLoop.enabled,
      ordinaryIdleContinuationDisabledWhenEnabled: true,
      statePath: ralphLoopStatePath(projectDir),
      runtimeSurface: config.enforce.ralphLoop.toolOutputTrigger ? "tool.execute.after" : "session.idle",
      runtimeSurfaces: config.enforce.ralphLoop.toolOutputTrigger ? ["tool.execute.after"] : ["session.idle"],
      toolOutputTriggerEnabled: config.enforce.ralphLoop.toolOutputTrigger,
    },
    retryPolicy: {
      maxAttempts: config.enforce.ralphLoop.maxAttempts,
      maxSessionAttempts: config.enforce.ralphLoop.maxSessionAttempts,
      attemptsUsed: 0,
      knownSessions,
      remainingSessionAttempts: config.enforce.ralphLoop.maxSessionAttempts,
      stateSource: "persisted-workflow-state",
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
    promptLines: blocker === null ? [] : createContinuationPromptLines({ blocker, context: "ralph-loop", depth, step: nextStep }),
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
    `Execution config: ${payload.execution.enabled ? "enabled" : "disabled"}; runtime surface: ${payload.execution.runtimeSurface}`,
    `Tool-output trigger: ${payload.execution.toolOutputTriggerEnabled ? "enabled" : "disabled"}; idle fallback: ${payload.execution.toolOutputTriggerEnabled ? "suppressed to avoid duplicate prompts" : "available when ralph-loop is enabled"}`,
    `Closure blockers: ${payload.state.blockerCount}`,
    `Finish state: ${payload.state.finish}`,
    `Retry cap: ${payload.retryPolicy.maxAttempts} attempts per blocker; ${payload.retryPolicy.maxSessionAttempts} attempts per session; dry-run attempts used: ${payload.retryPolicy.attemptsUsed}; known sessions: ${payload.retryPolicy.knownSessions}`,
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
