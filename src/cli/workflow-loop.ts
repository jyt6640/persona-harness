import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join, relative, resolve } from "node:path"
import process from "node:process"

import { AtomicWriteConflictError } from "../io/atomic-file.js"
import {
  formatRuleDeliveryPromptLines,
  ruleDeliveryRoleForBlocker,
  ruleDeliveryStageForBlocker,
  rulePackContentHash,
  selectRulesForDelivery,
} from "../rules/rule-delivery.js"
import type { CliRunResult } from "./bearshell.js"
import { runBoundedProcess } from "./bounded-process.js"
import { workflowFinishFollowUp, workflowFinishFollowUpLines, type WorkflowFinishFollowUp } from "./workflow-finish-follow-up.js"
import {
  isUnmappedBlockerStep,
  readWorkflowClosurePayload,
  type ClosureBlocker,
  type ClosureNextPayload,
} from "./workflow-closure.js"
import { runWorkflowFinishResult } from "./workflow-finish-runner.js"
import {
  readWorkflowLoopState,
  readWorkflowLoopStateSnapshot,
  WORKFLOW_LOOP_STATE_SCHEMA_VERSION,
  workflowLoopDir,
  workflowLoopStatePath,
  writeWorkflowLoopState,
  type WorkflowLoopIterationRecord,
  type WorkflowLoopState,
} from "./workflow-loop-state.js"
import { toWorkflowStateConflict } from "./workflow-state-conflict.js"

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
  const promptPreview = firstPromptLines(projectDir, closure)
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
  try {
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
  } catch (error) {
    if (error instanceof AtomicWriteConflictError) {
      const conflict = toWorkflowStateConflict(error, projectDir)
      return { status: 1, stdout: "", stderr: `${conflict.message}\n` }
    }
    throw error
  }
}

function executeLoop(projectDir: string, options: WorkflowLoopOptions, initialFinish: CliRunResult, initialClosure: ClosureNextPayload): WorkflowLoopState {
  const startedAt = new Date().toISOString()
  const rulePackHash = rulePackContentHash(projectDir)
  let finish = initialFinish
  let closure = initialClosure
  const iterations: WorkflowLoopIterationRecord[] = []
  let stateToken = readWorkflowLoopStateSnapshot(projectDir).token
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
    stateToken = writeWorkflowLoopState(
      projectDir,
      { finalDecision: "not-run", iterations, rulePackHash, schemaVersion: WORKFLOW_LOOP_STATE_SCHEMA_VERSION, startedAt },
      stateToken,
    )
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
    rulePackHash,
    schemaVersion: WORKFLOW_LOOP_STATE_SCHEMA_VERSION,
    startedAt,
  }
  writeWorkflowLoopState(projectDir, state, stateToken)
  return state
}

function runIteration(
  projectDir: string,
  options: WorkflowLoopOptions,
  iteration: number,
  blocker: ClosureBlocker,
  closure: ClosureNextPayload,
): WorkflowLoopIterationRecord {
  const followUp = workflowFinishFollowUp(closure)
  if (followUp === null) {
    throw new TypeError("workflow loop iteration requires a closure follow-up")
  }
  const dir = workflowLoopDir(projectDir)
  mkdirSync(dir, { recursive: true })
  const blockerTotal = closure.state.blockers.length
  const promptPath = join(dir, `iteration-${iteration}-prompt.md`)
  const stdoutPath = join(dir, `iteration-${iteration}-stdout.log`)
  const stderrPath = join(dir, `iteration-${iteration}-stderr.log`)
  writeFileSync(promptPath, `${workflowLoopPrompt(projectDir, blocker, followUp, 1, blockerTotal).join("\n")}\n`)
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
  return runWorkflowFinishResult("implement", projectDir)
}

function firstPromptLines(projectDir: string, closure: ClosureNextPayload): readonly string[] {
  const blocker = closure.state.blockers[0]
  if (blocker === undefined) {
    return []
  }
  const followUp = workflowFinishFollowUp(closure)
  if (followUp === null) {
    return []
  }
  return workflowLoopPrompt(projectDir, blocker, followUp, 1, closure.state.blockers.length)
}

function workflowLoopPrompt(
  projectDir: string,
  blocker: ClosureBlocker,
  followUp: WorkflowFinishFollowUp,
  blockerIndex: number,
  blockerTotal: number,
): readonly string[] {
  const deliveryRole = ruleDeliveryRoleForBlocker(blocker.id)
  const deliveryStage = ruleDeliveryStageForBlocker(blocker.id)
  const delivery = selectRulesForDelivery(projectDir, deliveryRole, { stage: deliveryStage })
  return [
    "[Persona Harness Workflow Loop]",
    "Closure blockers remain; do not claim completion.",
    `Blocker: ${blocker.id} (blocker ${blockerIndex}/${blockerTotal})`,
    `Reason: ${blocker.reason}`,
    `Source: ${blocker.source}`,
    ...workflowFinishFollowUpLines(followUp),
    ...formatRuleDeliveryPromptLines(delivery),
    "Complete only the prioritized action and stop after the finish gate result is visible.",
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
      ...(payload.promptPreview.length === 0 ? [] : ["", "Prompt preview:", ...payload.promptPreview.map((line) => `  ${line}`)]),
      "",
      "Boundaries:",
      ...payload.boundaries.map((line) => `- ${line}`),
      "",
    ].join("\n"),
    stderr: "",
  }
}
