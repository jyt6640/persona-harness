import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join, relative, resolve } from "node:path"
import process from "node:process"

import { AtomicWriteConflictError } from "../io/atomic-file.js"
import { rulePackContentHash } from "../rules/rule-delivery.js"
import type { CliRunResult } from "./bearshell.js"
import { runBoundedProcess, type BoundedProcessOutcome } from "./bounded-process.js"
import {
  isUnmappedBlockerStep,
  readWorkflowClosurePayload,
  type ClosureBlocker,
  type ClosureNextPayload,
} from "./workflow-closure.js"
import { runWorkflowFinishResult } from "./workflow-finish-runner.js"
import {
  formatWorkflowLoopPayload,
  workflowLoopDecisionForChildOutcome,
  workflowLoopPayload,
  workflowLoopPrompt,
  workflowLoopResultForDecision,
  type WorkflowLoopResult,
} from "./workflow-loop-rendering.js"
import {
  readWorkflowLoopState,
  readWorkflowLoopStateSnapshot,
  WORKFLOW_LOOP_STATE_SCHEMA_VERSION,
  workflowLoopDir,
  workflowLoopStatePath,
  writeWorkflowLoopState,
  type WorkflowLoopFinalDecision,
  type WorkflowLoopIterationRecord,
  type WorkflowLoopState,
} from "./workflow-loop-state.js"

export type { WorkflowLoopFinalDecision } from "./workflow-loop-state.js"
export {
  workflowLoopResultForDecision,
  type WorkflowLoopResult,
} from "./workflow-loop-rendering.js"

export type WorkflowLoopOptions = {
  readonly dryRun: boolean
  readonly graceMs: number
  readonly json: boolean
  readonly maxIterations: number
  readonly opencodeCommand: string
  readonly projectDir?: string
  readonly timeoutMs: number
}

export function runWorkflowLoopCommand(options: WorkflowLoopOptions): CliRunResult {
  const projectDir = resolve(options.projectDir ?? process.cwd())
  const initialFinish = deterministicFinish(projectDir)
  const closure = readWorkflowClosurePayload("next", projectDir) as ClosureNextPayload
  const rulePackHash = rulePackContentHash(projectDir)
  const promptPreview = firstPromptLines(projectDir, closure, rulePackHash)
  if (options.dryRun) {
    const finalDecision = initialLoopDecision(initialFinish.status, closure)
    return formatWorkflowLoopPayload(
      workflowLoopPayload({
        defaultOff: true,
        ...workflowLoopResultForDecision(finalDecision),
        iterations: readWorkflowLoopState(projectDir)?.iterations ?? [],
        maxIterations: options.maxIterations,
        mode: "dry-run",
        promptPreview,
        rulePackHash,
        schemaVersion: "workflow-loop.1",
        statePath: relative(projectDir, workflowLoopStatePath(projectDir)),
      }),
      options.json,
    )
  }
  try {
    const state = executeLoop(projectDir, options, initialFinish, closure)
    return formatWorkflowLoopPayload(
      workflowLoopPayload({
        defaultOff: true,
        ...workflowLoopResultForDecision(state.finalDecision),
        iterations: state.iterations,
        maxIterations: options.maxIterations,
        mode: "execute",
        promptPreview,
        rulePackHash,
        schemaVersion: "workflow-loop.1",
        statePath: relative(projectDir, workflowLoopStatePath(projectDir)),
      }),
      options.json,
    )
  } catch (error) {
    if (error instanceof AtomicWriteConflictError) {
      return formatWorkflowLoopPayload(
        workflowLoopPayload({
          defaultOff: true,
          ...workflowLoopResultForDecision("state-conflict"),
          iterations: readWorkflowLoopState(projectDir)?.iterations ?? [],
          maxIterations: options.maxIterations,
          mode: "execute",
          promptPreview,
          rulePackHash,
          schemaVersion: "workflow-loop.1",
          statePath: relative(projectDir, workflowLoopStatePath(projectDir)),
        }),
        options.json,
      )
    }
    throw error
  }
}

function initialLoopDecision(finishStatus: number, closure: ClosureNextPayload): WorkflowLoopFinalDecision {
  if (finishStatus === 0) {
    return "finish-passed"
  }
  if (closure.state.blockers.length === 0) {
    return "no-blockers"
  }
  if (isUnmappedBlockerStep(closure.nextStep)) {
    return "unmapped-blocker"
  }
  return "not-run"
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
    const iteration = runIteration(projectDir, options, index, blocker, closure)
    iterations.push(iteration.record)
    stateToken = writeWorkflowLoopState(
      projectDir,
      { finalDecision: "not-run", iterations, rulePackHash, schemaVersion: WORKFLOW_LOOP_STATE_SCHEMA_VERSION, startedAt },
      stateToken,
    )
    const childDecision = workflowLoopDecisionForChildOutcome(iteration.outcome)
    if (childDecision !== undefined) {
      finalDecision = childDecision
      break
    }
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

type LoopIterationExecution = {
  readonly outcome: BoundedProcessOutcome
  readonly record: WorkflowLoopIterationRecord
}

function runIteration(
  projectDir: string,
  options: WorkflowLoopOptions,
  iteration: number,
  blocker: ClosureBlocker,
  closure: ClosureNextPayload,
): LoopIterationExecution {
  if (closure.nextStep === null) {
    throw new TypeError("workflow loop iteration requires a closure follow-up")
  }
  const dir = workflowLoopDir(projectDir)
  mkdirSync(dir, { recursive: true })
  const blockerTotal = closure.state.blockers.length
  const promptPath = join(dir, `iteration-${iteration}-prompt.md`)
  const stdoutPath = join(dir, `iteration-${iteration}-stdout.log`)
  const stderrPath = join(dir, `iteration-${iteration}-stderr.log`)
  writeFileSync(
    promptPath,
    `${workflowLoopPrompt({
      blocker,
      depth: { index: 1, total: blockerTotal },
      rulePackHash: rulePackContentHash(projectDir),
      step: closure.nextStep,
    }).join("\n")}\n`,
  )
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
    outcome: result.outcome,
    record: {
      blockerId: blocker.id,
      blockerIndex: 1,
      blockerTotal,
      exitStatus: result.status,
      iteration,
      promptPath: relative(projectDir, promptPath),
      stderrPath: relative(projectDir, stderrPath),
      stdoutPath: relative(projectDir, stdoutPath),
      timedOut: result.timedOut || result.killed,
    },
  }
}

function deterministicFinish(projectDir: string): CliRunResult {
  if (!existsSync(join(projectDir, ".persona"))) {
    return { status: 1, stdout: "", stderr: "Persona Harness is not initialized in this project.\n" }
  }
  return runWorkflowFinishResult("implement", projectDir)
}

function firstPromptLines(
  projectDir: string,
  closure: ClosureNextPayload,
  rulePackHash: string,
): readonly string[] {
  const blocker = closure.state.blockers[0]
  if (blocker === undefined || closure.nextStep === null) {
    return []
  }
  return workflowLoopPrompt({
    blocker,
    depth: { index: 1, total: closure.state.blockers.length },
    rulePackHash,
    step: closure.nextStep,
  })
}
