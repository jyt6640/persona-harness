import { join } from "node:path"

import {
  readWorkflowLifecycleStateFile,
  WorkflowLifecycleStateError,
  writeWorkflowLifecycleStateFile,
  type WorkflowLifecycleStateToken,
} from "../io/workflow-lifecycle-state.js"
import type { ProjectReadSnapshot } from "../io/project-read-snapshot.js"

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
  readonly integrity: "absent" | "malformed" | "unsafe" | "valid"
  readonly state: WorkflowLoopState | null
  readonly token: WorkflowLifecycleStateToken
}

const MAX_WORKFLOW_LOOP_STATE_BYTES = 128 * 1024

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

export function readWorkflowLoopStateSnapshot(
  projectDir: string,
  snapshot?: ProjectReadSnapshot,
): WorkflowLoopStateSnapshot {
  if (snapshot !== undefined) {
    const relativePath = ".persona/workflow/workflow-loop-state.json"
    if (!snapshot.hasFile(relativePath)) return { integrity: "absent", state: null, token: null }
    const source = snapshot.readText(relativePath, MAX_WORKFLOW_LOOP_STATE_BYTES)
    if (source === undefined) return { integrity: "unsafe", state: null, token: null }
    const state = parseWorkflowLoopState(source)
    return { integrity: state === null ? "malformed" : "valid", state, token: null }
  }
  const file = readWorkflowLifecycleStateFile(
    projectDir,
    "workflow-loop-state.json",
    MAX_WORKFLOW_LOOP_STATE_BYTES,
  )
  if (file.kind === "absent") {
    return { integrity: "absent", state: null, token: null }
  }
  if (file.kind === "blocked") return { integrity: "unsafe", state: null, token: null }
  const state = parseWorkflowLoopState(file.value.bytes.toString("utf8"))
  return {
    integrity: state === null ? "malformed" : "valid",
    state,
    token: file.value.token,
  }
}

export function readWorkflowLoopState(projectDir: string): WorkflowLoopState | null {
  return readWorkflowLoopStateSnapshot(projectDir).state
}

export function writeWorkflowLoopState(
  projectDir: string,
  state: WorkflowLoopState,
  expectedToken?: WorkflowLifecycleStateToken,
): WorkflowLifecycleStateToken {
  const snapshot = expectedToken === undefined ? readWorkflowLoopStateSnapshot(projectDir) : undefined
  if (snapshot?.integrity === "unsafe") {
    throw new WorkflowLifecycleStateError()
  }
  return writeWorkflowLifecycleStateFile(
    projectDir,
    "workflow-loop-state.json",
    expectedToken ?? snapshot?.token ?? null,
    `${JSON.stringify(state, null, 2)}\n`,
  )
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
