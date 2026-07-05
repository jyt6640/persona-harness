import { existsSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import process from "node:process"

import { AtomicWriteConflictError, readTextFileSnapshot, writeFileAtomicIfUnchanged } from "../io/atomic-file.js"
import { PLAN_PATH, type PlanOptions } from "./plan.js"
import { beforeWorkflowStateWrite, toWorkflowStateConflict } from "./workflow-state-conflict.js"

export type PlanAcceptanceStatus = "draft" | "needs-revision" | "accepted"

export type PlanStatusResult = {
  readonly planPath: string
  readonly status: string
}

export class PlanStatusError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PlanStatusError"
  }
}

function resolvePlanPath(options: PlanOptions): string {
  const projectDir = resolve(options.projectDir ?? process.cwd())
  return join(projectDir, PLAN_PATH)
}

function readPlanText(planPath: string): string {
  if (!existsSync(planPath)) {
    throw new PlanStatusError("No workflow plan found. Run npx ph plan first.")
  }
  return readFileSync(planPath, "utf8")
}

function extractStatus(planText: string): string {
  const match = planText.match(/^Status:\s*(.+?)\s*$/m)
  if (match?.[1] === undefined) {
    throw new PlanStatusError("No Status line found in .persona/workflow/plan.md.")
  }
  return match[1].trim()
}

export function readWorkflowPlanStatus(options: PlanOptions = {}): PlanStatusResult {
  const planPath = resolvePlanPath(options)
  const planText = readPlanText(planPath)
  return { planPath, status: extractStatus(planText) }
}

export function updateWorkflowPlanStatus(
  status: PlanAcceptanceStatus,
  options: PlanOptions = {},
): PlanStatusResult {
  const planPath = resolvePlanPath(options)
  if (!existsSync(planPath)) {
    throw new PlanStatusError("No workflow plan found. Run npx ph plan first.")
  }
  const snapshot = readTextFileSnapshot(planPath)
  extractStatus(snapshot.text)

  const updatedPlan = snapshot.text.replace(/^Status:\s*.+?\s*$/m, `Status: ${status}`)
  beforeWorkflowStateWrite(options, planPath)
  try {
    writeFileAtomicIfUnchanged(snapshot, updatedPlan)
  } catch (error) {
    if (error instanceof AtomicWriteConflictError) {
      throw toWorkflowStateConflict(error, resolve(options.projectDir ?? process.cwd()))
    }
    throw error
  }
  return { planPath, status }
}
