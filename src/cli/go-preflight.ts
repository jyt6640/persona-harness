import { existsSync, lstatSync } from "node:fs"
import { join } from "node:path"

import { readBackendProjectProfileState } from "../config/project-profile.js"
import type { CliRunResult } from "./bearshell.js"
import { GO_OWNED_PATHS } from "./go-transaction.js"
import { IMPLEMENTATION_REPORT_PATH, REVIEW_REPORT_PATH } from "./plan.js"
import { PlanStatusError, readWorkflowPlanStatus } from "./plan-status.js"
import {
  BACKLOG_PATH,
  DRAFT_REQUIREMENTS_ASSUMPTIONS_PATH,
  DRAFT_REQUIREMENTS_BACKLOG_PATH,
  DRAFT_REQUIREMENTS_QUESTIONS_PATH,
  HISTORY_DIR,
  LATEST_REQUIREMENTS_PATH,
  REQUIREMENTS_ANALYSIS_PATH,
  WORK_DIR,
} from "./workflow-ticket-model.js"

function errorCode(error: unknown): string | undefined {
  return error instanceof Error && "code" in error && typeof error.code === "string"
    ? error.code
    : undefined
}

export function goBlockedOutput(reason: string, nextCommand: string): CliRunResult {
  return {
    status: 1,
    stdout: "",
    stderr: [`Persona Harness Go cannot start: ${reason}`, `Next command: ${nextCommand}`].join("\n") + "\n",
  }
}

export function goSetupBlocker(projectDir: string): CliRunResult | undefined {
  if (!existsSync(join(projectDir, ".persona", "harness.jsonc"))) {
    return goBlockedOutput("Persona Harness is not initialized.", "npx ph bootstrap backend")
  }
  if (readBackendProjectProfileState(projectDir).status !== "ready") {
    return goBlockedOutput("the backend project profile is not ready.", "npx ph intake --default backend --force")
  }
  try {
    const plan = readWorkflowPlanStatus({ projectDir })
    return plan.status === "accepted"
      ? undefined
      : goBlockedOutput("the workflow plan is not accepted.", "npx ph plan --accept")
  } catch (error) {
    if (!(error instanceof PlanStatusError)) {
      throw error
    }
    const planExists = existsSync(join(projectDir, ".persona", "workflow", "plan.md"))
    return goBlockedOutput(
      planExists ? "the workflow plan status must be repaired." : "the workflow plan is missing.",
      planExists ? "npx ph plan --accept" : "npx ph plan --auto-accept",
    )
  }
}

export function goWorkflowBoundaryBlocker(projectDir: string): CliRunResult | undefined {
  const requiredFiles = [IMPLEMENTATION_REPORT_PATH, REVIEW_REPORT_PATH]
  if (requiredFiles.some((path) => !existsSync(join(projectDir, path)))) {
    return goBlockedOutput("required workflow report templates are missing.", "npx ph workflow check")
  }
  const boundaries = [".persona", ".persona/workflow", ...GO_OWNED_PATHS, ...requiredFiles]
  for (const relativePath of boundaries) {
    try {
      if (lstatSync(join(projectDir, relativePath)).isSymbolicLink()) {
        return goBlockedOutput("a workflow write boundary is symbolic-linked.", "npx ph workflow check")
      }
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error
      }
      if (errorCode(error) !== "ENOENT") {
        return goBlockedOutput("a workflow write boundary cannot be inspected.", "npx ph workflow check")
      }
    }
  }
  return undefined
}

export function goExistingStateBlocker(projectDir: string): CliRunResult | undefined {
  if (existsSync(join(projectDir, BACKLOG_PATH))) {
    return goBlockedOutput("a workflow backlog/current ticket already exists.", "npx ph workflow next")
  }
  if (
    [DRAFT_REQUIREMENTS_BACKLOG_PATH, DRAFT_REQUIREMENTS_QUESTIONS_PATH, DRAFT_REQUIREMENTS_ASSUMPTIONS_PATH]
      .some((path) => existsSync(join(projectDir, path)))
  ) {
    return goBlockedOutput("requirements draft state already exists.", "npx ph workflow approve requirements")
  }
  if (existsSync(join(projectDir, LATEST_REQUIREMENTS_PATH))) {
    return goBlockedOutput("captured requirements are waiting to be split.", "npx ph workflow split")
  }
  if ([REQUIREMENTS_ANALYSIS_PATH, WORK_DIR, HISTORY_DIR].some((path) => existsSync(join(projectDir, path)))) {
    return goBlockedOutput("conflicting workflow ticket fragments already exist.", "npx ph workflow check")
  }
  return undefined
}
