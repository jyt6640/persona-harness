import { existsSync } from "node:fs"
import { join } from "node:path"

import { loadHarnessConfigResult } from "../config/harness-config.js"
import { readBackendProjectProfileState } from "../config/project-profile.js"
import { readDoctorReachability } from "./doctor-reachability.js"
import { IMPLEMENTATION_REPORT_PATH, REVIEW_REPORT_PATH } from "./plan.js"
import { readWorkflowPlanStatus } from "./plan-status.js"

export type ExistingAttachmentState = "ready" | "unrecognized" | "weak"

function hasAcceptedPlan(projectDir: string): boolean {
  try {
    return readWorkflowPlanStatus({ projectDir }).status === "accepted"
  } catch {
    return false
  }
}

export function existingAttachmentState(projectDir: string): ExistingAttachmentState {
  const reachability = readDoctorReachability(projectDir)
  const recognized = (
    existsSync(join(projectDir, ".persona", "harness.jsonc"))
    && loadHarnessConfigResult(projectDir).diagnostics.length === 0
    && reachability.projectPluginState === "configured"
    && (
      reachability.agentsState === "missing"
      || reachability.agentsState === "legacy observed"
      || reachability.agentsState === "current"
    )
  )
  if (!recognized) {
    return "unrecognized"
  }
  const workflowReady = (
    readBackendProjectProfileState(projectDir).status === "ready"
    && hasAcceptedPlan(projectDir)
    && existsSync(join(projectDir, IMPLEMENTATION_REPORT_PATH))
    && existsSync(join(projectDir, REVIEW_REPORT_PATH))
  )
  return reachability.level === "PASS" && workflowReady ? "ready" : "weak"
}
