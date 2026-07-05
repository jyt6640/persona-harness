import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

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

export const WORKFLOW_LOOP_STATE_SCHEMA_VERSION = "workflow-loop-state.1"

export type WorkflowLoopState = {
  readonly completedAt?: string
  readonly finalDecision: "finish-passed" | "iteration-cap" | "no-blockers" | "not-run" | "unmapped-blocker"
  readonly iterations: readonly WorkflowLoopIterationRecord[]
  readonly schemaVersion: typeof WORKFLOW_LOOP_STATE_SCHEMA_VERSION
  readonly startedAt: string
}

export function workflowLoopDir(projectDir: string): string {
  return join(projectDir, ".persona", "workflow", "loop")
}

export function workflowLoopStatePath(projectDir: string): string {
  return join(projectDir, ".persona", "workflow", "workflow-loop-state.json")
}

export function readWorkflowLoopState(projectDir: string): WorkflowLoopState | null {
  const path = workflowLoopStatePath(projectDir)
  if (!existsSync(path)) {
    return null
  }
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"))
    if (typeof parsed !== "object" || parsed === null) {
      return null
    }
    const record = parsed as Record<string, unknown>
    if (
      (record.schemaVersion !== undefined && record.schemaVersion !== WORKFLOW_LOOP_STATE_SCHEMA_VERSION)
      || !Array.isArray(record.iterations)
    ) {
      return null
    }
    return {
      completedAt: typeof record.completedAt === "string" ? record.completedAt : undefined,
      finalDecision: readFinalDecision(record.finalDecision),
      iterations: record.iterations.filter(isIterationRecord),
      schemaVersion: WORKFLOW_LOOP_STATE_SCHEMA_VERSION,
      startedAt: typeof record.startedAt === "string" ? record.startedAt : new Date(0).toISOString(),
    }
  } catch {
    return null
  }
}

export function writeWorkflowLoopState(projectDir: string, state: WorkflowLoopState): string {
  const path = workflowLoopStatePath(projectDir)
  mkdirSync(join(projectDir, ".persona", "workflow"), { recursive: true })
  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`)
  return path
}

function readFinalDecision(value: unknown): WorkflowLoopState["finalDecision"] {
  if (
    value === "finish-passed" ||
    value === "iteration-cap" ||
    value === "no-blockers" ||
    value === "not-run" ||
    value === "unmapped-blocker"
  ) {
    return value
  }
  return "not-run"
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
