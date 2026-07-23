import { existsSync, mkdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { fileChangeToken, writeFileAtomicIfTokenUnchanged, type FileChangeToken } from "../io/atomic-file.js"

export type WorkflowLoopIterationRecord = {
  readonly blockerId: string
  readonly blockerIndex: number
  readonly blockerTotal: number
  readonly exitStatus: number
  readonly iteration: number
  readonly promptPath: string
  readonly stderrPath: string
  readonly stdoutPath: string
  readonly timedOut: boolean
}

export type WorkflowLoopFinalDecision =
  | "child-failure"
  | "finish-passed"
  | "iteration-cap"
  | "no-blockers"
  | "not-run"
  | "output-limit"
  | "signal"
  | "spawn-failure"
  | "state-conflict"
  | "timeout"
  | "unmapped-blocker"

const LEGACY_WORKFLOW_LOOP_STATE_SCHEMA_VERSION = "workflow-loop-state.1"
export const WORKFLOW_LOOP_STATE_SCHEMA_VERSION = "workflow-loop-state.2"

export type WorkflowLoopState = {
  readonly completedAt?: string
  readonly finalDecision: WorkflowLoopFinalDecision
  readonly iterations: readonly WorkflowLoopIterationRecord[]
  readonly rulePackHash: string
  readonly schemaVersion: typeof WORKFLOW_LOOP_STATE_SCHEMA_VERSION
  readonly startedAt: string
}

export type WorkflowLoopStateSnapshot = {
  readonly integrity: "absent" | "malformed" | "valid"
  readonly state: WorkflowLoopState | null
  readonly token: FileChangeToken | null
}

type ParsedWorkflowLoopStateRecord = {
  readonly completedAt?: string
  readonly finalDecision: WorkflowLoopState["finalDecision"]
  readonly iterations: readonly WorkflowLoopIterationRecord[]
  readonly rulePackHash?: string
  readonly schemaVersion?: string
  readonly startedAt: string
}

export function workflowLoopDir(projectDir: string): string {
  return join(projectDir, ".persona", "workflow", "loop")
}

export function workflowLoopStatePath(projectDir: string): string {
  return join(projectDir, ".persona", "workflow", "workflow-loop-state.json")
}

function parseWorkflowLoopState(source: string): WorkflowLoopState | null {
  try {
    const parsed: unknown = JSON.parse(source)
    if (typeof parsed !== "object" || parsed === null) {
      return null
    }
    const record = parsed as Record<string, unknown>
    if (!isWorkflowLoopStateRecord(record)) {
      return null
    }
    return {
      completedAt: typeof record.completedAt === "string" ? record.completedAt : undefined,
      finalDecision: readFinalDecision(record.finalDecision),
      iterations: record.iterations.filter(isIterationRecord),
      rulePackHash: typeof record.rulePackHash === "string" ? record.rulePackHash : "legacy-unrecorded",
      schemaVersion: WORKFLOW_LOOP_STATE_SCHEMA_VERSION,
      startedAt: typeof record.startedAt === "string" ? record.startedAt : new Date(0).toISOString(),
    }
  } catch {
    return null
  }
}

export function readWorkflowLoopStateSnapshot(projectDir: string): WorkflowLoopStateSnapshot {
  const path = workflowLoopStatePath(projectDir)
  if (!existsSync(path)) {
    return { integrity: "absent", state: null, token: null }
  }
  try {
    const state = parseWorkflowLoopState(readFileSync(path, "utf8"))
    return {
      integrity: state === null ? "malformed" : "valid",
      state,
      token: fileChangeToken(path),
    }
  } catch {
    return { integrity: "malformed", state: null, token: fileChangeToken(path) }
  }
}

export function readWorkflowLoopState(projectDir: string): WorkflowLoopState | null {
  return readWorkflowLoopStateSnapshot(projectDir).state
}

export function writeWorkflowLoopState(
  projectDir: string,
  state: WorkflowLoopState,
  expectedToken: FileChangeToken | null = fileChangeToken(workflowLoopStatePath(projectDir)),
): FileChangeToken {
  const path = workflowLoopStatePath(projectDir)
  mkdirSync(join(projectDir, ".persona", "workflow"), { recursive: true })
  return writeFileAtomicIfTokenUnchanged(path, expectedToken, `${JSON.stringify(state, null, 2)}\n`)
}

function readFinalDecision(value: unknown): WorkflowLoopState["finalDecision"] {
  if (isWorkflowLoopFinalDecision(value)) {
    return value
  }
  return "not-run"
}

function isWorkflowLoopStateRecord(record: Record<string, unknown>): record is Record<string, unknown> & ParsedWorkflowLoopStateRecord {
  const iterations = record.iterations
  if (
    (record.schemaVersion !== undefined
      && record.schemaVersion !== WORKFLOW_LOOP_STATE_SCHEMA_VERSION
      && record.schemaVersion !== LEGACY_WORKFLOW_LOOP_STATE_SCHEMA_VERSION)
    || !Array.isArray(iterations)
    || !iterations.every(isIterationRecord)
    || !isWorkflowLoopFinalDecision(record.finalDecision)
    || !isNonEmptyString(record.startedAt)
    || (record.completedAt !== undefined && !isNonEmptyString(record.completedAt))
  ) {
    return false
  }
  if (record.schemaVersion === WORKFLOW_LOOP_STATE_SCHEMA_VERSION) {
    return isNonEmptyString(record.rulePackHash)
  }
  return record.rulePackHash === undefined || isNonEmptyString(record.rulePackHash)
}

function isWorkflowLoopFinalDecision(value: unknown): value is WorkflowLoopState["finalDecision"] {
  return value === "child-failure"
    || value === "finish-passed"
    || value === "iteration-cap"
    || value === "no-blockers"
    || value === "not-run"
    || value === "output-limit"
    || value === "signal"
    || value === "spawn-failure"
    || value === "state-conflict"
    || value === "timeout"
    || value === "unmapped-blocker"
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== ""
}

function isIterationRecord(value: unknown): value is WorkflowLoopIterationRecord {
  if (typeof value !== "object" || value === null) {
    return false
  }
  const record = value as Record<string, unknown>
  return (
    typeof record.blockerId === "string" &&
    typeof record.blockerIndex === "number" &&
    typeof record.blockerTotal === "number" &&
    typeof record.exitStatus === "number" &&
    typeof record.iteration === "number" &&
    typeof record.promptPath === "string" &&
    typeof record.stderrPath === "string" &&
    typeof record.stdoutPath === "string" &&
    typeof record.timedOut === "boolean"
  )
}
