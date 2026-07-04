import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join, relative, resolve } from "node:path"
import process from "node:process"

import type { CliRunResult } from "./bearshell.js"
import { runBoundedProcess } from "./bounded-process.js"
import { continuationPromptCoreLines } from "./continuation-prompt.js"
import { workflowClosureFinishReasons } from "./workflow-closure-finish.js"
import {
  isUnmappedBlockerStep,
  readWorkflowClosurePayload,
  type ClosureBlocker,
  type ClosureNextPayload,
  type ClosureStep,
} from "./workflow-closure.js"
import { failedRunnerOutput, passedFinishOutput } from "./workflow-output.js"
import {
  readWorkflowLoopState,
  workflowLoopDir,
  workflowLoopStatePath,
  writeWorkflowLoopState,
  type WorkflowLoopIterationRecord,
  type WorkflowLoopState,
} from "./workflow-loop-state.js"

export type WorkflowLoopOptions = {
  readonly dryRun: boolean
  readonly graceMs: number
  readonly json: boolean
  readonly maxIterations: number
  readonly opencodeCommand: string
  readonly projectDir?: string
  readonly timeoutMs: number
}

type LoopPayload = {
  readonly boundaries: readonly string[]
  readonly defaultOff: true
  readonly finalDecision: WorkflowLoopState["finalDecision"]
  readonly iterations: readonly WorkflowLoopIterationRecord[]
  readonly maxIterations: number
  readonly mode: "dry-run" | "execute"
  readonly promptPreview: readonly string[]
  readonly schemaVersion: "workflow-loop.1"
  readonly statePath: string
  readonly termination: readonly string[]
}

export function runWorkflowLoopCommand(options: WorkflowLoopOptions): CliRunResult {
  const projectDir = resolve(options.projectDir ?? process.cwd())
  const initialFinish = deterministicFinish(projectDir)
  const closure = readWorkflowClosurePayload("next", projectDir) as ClosureNextPayload
  const promptPreview = firstPromptLines(closure)
  if (options.dryRun) {
    return formatPayload(
      {
        boundaries: loopBoundaries(),
        defaultOff: true,
        finalDecision: initialFinish.status === 0 ? "finish-passed" : closure.state.blockers.length === 0 ? "no-blockers" : isUnmappedBlockerStep(closure.nextStep) ? "unmapped-blocker" : "not-run",
        iterations: readWorkflowLoopState(projectDir)?.iterations ?? [],
        maxIterations: options.maxIterations,
        mode: "dry-run",
        promptPreview,
        schemaVersion: "workflow-loop.1",
        statePath: relative(projectDir, workflowLoopStatePath(projectDir)),
        termination: loopTermination(),
      },
      options.json,
    )
  }
  const state = executeLoop(projectDir, options, initialFinish, closure)
  return formatPayload(
    {
      boundaries: loopBoundaries(),
      defaultOff: true,
      finalDecision: state.finalDecision,
      iterations: state.iterations,
      maxIterations: options.maxIterations,
      mode: "execute",
      promptPreview,
      schemaVersion: "workflow-loop.1",
      statePath: relative(projectDir, workflowLoopStatePath(projectDir)),
      termination: loopTermination(),
    },
    options.json,
  )
}

function executeLoop(projectDir: string, options: WorkflowLoopOptions, initialFinish: CliRunResult, initialClosure: ClosureNextPayload): WorkflowLoopState {
  const startedAt = new Date().toISOString()
  let finish = initialFinish
  let closure = initialClosure
  const iterations: WorkflowLoopIterationRecord[] = []
  let finalDecision: WorkflowLoopState["finalDecision"] = "not-run"
  for (let index = 1; index <= options.maxIterations; index += 1) {
    if (finish.status === 0) {
      finalDecision = "finish-passed"
      break
    }
    const blocker = closure.state.blockers[0]
    if (blocker === undefined) {
      finalDecision = "no-blockers"
      break
    }
    if (isUnmappedBlockerStep(closure.nextStep)) {
      finalDecision = "unmapped-blocker"
      break
    }
    const record = runIteration(projectDir, options, index, blocker, closure)
    iterations.push(record)
    writeWorkflowLoopState(projectDir, { finalDecision: "not-run", iterations, schemaVersion: "workflow-loop-state.1", startedAt })
    finish = deterministicFinish(projectDir)
    closure = readWorkflowClosurePayload("next", projectDir) as ClosureNextPayload
  }
  if (finalDecision === "not-run") {
    finalDecision = finish.status === 0 ? "finish-passed" : closure.state.blockers.length === 0 ? "no-blockers" : isUnmappedBlockerStep(closure.nextStep) ? "unmapped-blocker" : "iteration-cap"
  }
  const state: WorkflowLoopState = {
    completedAt: new Date().toISOString(),
    finalDecision,
    iterations,
    schemaVersion: "workflow-loop-state.1",
    startedAt,
  }
  writeWorkflowLoopState(projectDir, state)
  return state
}

function runIteration(
  projectDir: string,
  options: WorkflowLoopOptions,
  iteration: number,
  blocker: ClosureBlocker,
  closure: ClosureNextPayload,
): WorkflowLoopIterationRecord {
  const dir = workflowLoopDir(projectDir)
  mkdirSync(dir, { recursive: true })
  const blockerTotal = closure.state.blockers.length
  const promptPath = join(dir, `iteration-${iteration}-prompt.md`)
  const stdoutPath = join(dir, `iteration-${iteration}-stdout.log`)
  const stderrPath = join(dir, `iteration-${iteration}-stderr.log`)
  writeFileSync(promptPath, `${workflowLoopPrompt(blocker, closure.nextStep, 1, blockerTotal).join("\n")}\n`)
  const result = runBoundedProcess({
    args: ["run", readFileSync(promptPath, "utf8")],
    command: options.opencodeCommand,
    cwd: projectDir,
    graceMs: options.graceMs,
    timeoutMs: options.timeoutMs,
  })
  writeFileSync(stdoutPath, result.stdout)
  writeFileSync(stderrPath, result.stderr)
  return {
    blockerId: blocker.id,
    blockerIndex: 1,
    blockerTotal,
    exitStatus: result.status,
    iteration,
    promptPath: relative(projectDir, promptPath),
    stderrPath: relative(projectDir, stderrPath),
    stdoutPath: relative(projectDir, stdoutPath),
    timedOut: result.timedOut || result.killed,
  }
}

function deterministicFinish(projectDir: string): CliRunResult {
  if (!existsSync(join(projectDir, ".persona"))) {
    return { status: 1, stdout: "", stderr: "Persona Harness is not initialized in this project.\n" }
  }
  const reasons = workflowClosureFinishReasons(readWorkflowClosurePayload("next", projectDir, { recordTddGreenEvidence: true }), projectDir)
  if (reasons.length > 0) {
    return failedRunnerOutput("finish", "implement", reasons)
  }
  return passedFinishOutput("implement")
}

function firstPromptLines(closure: ClosureNextPayload): readonly string[] {
  const blocker = closure.state.blockers[0]
  if (blocker === undefined) {
    return []
  }
  if (isUnmappedBlockerStep(closure.nextStep)) {
    return []
  }
  return workflowLoopPrompt(blocker, closure.nextStep, 1, closure.state.blockers.length)
}

function workflowLoopPrompt(
  blocker: ClosureBlocker,
  step: ClosureStep | null,
  blockerIndex: number,
  blockerTotal: number,
): readonly string[] {
  return [
    "[Persona Harness Workflow Loop]",
    ...continuationPromptCoreLines(blocker, step, { index: blockerIndex, total: blockerTotal }),
    "Run only the commands needed for this blocker and stop after the finish gate result is visible.",
  ]
}

function loopTermination(): readonly string[] {
  return ["finish exit 0", "no remaining closure blockers", "unmapped closure blocker diagnostic", "iteration cap"]
}

function loopBoundaries(): readonly string[] {
  return [
    "explicit command only; no hooks, no default runtime behavior, and no autonomous completion claim",
    "success is determined only by deterministic PH finish/closure gates",
    "no token-saving, product-efficacy, app-quality, or broad reliability claim",
  ]
}

function formatPayload(payload: LoopPayload, json: boolean): CliRunResult {
  if (json) {
    return { status: 0, stdout: `${JSON.stringify(payload, null, 2)}\n`, stderr: "" }
  }
  return {
    status: 0,
    stdout: [
      "Persona Harness workflow loop",
      `Mode: ${payload.mode}`,
      `Final decision: ${payload.finalDecision}`,
      `Iterations: ${payload.iterations.length}/${payload.maxIterations}`,
      `State: ${payload.statePath}`,
      "",
      "Termination:",
      ...payload.termination.map((line) => `- ${line}`),
      "",
      "Boundaries:",
      ...payload.boundaries.map((line) => `- ${line}`),
      "",
    ].join("\n"),
    stderr: "",
  }
}
