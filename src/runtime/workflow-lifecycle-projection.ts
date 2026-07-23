import type { WorkflowLoopStateSnapshot } from "../cli/workflow-loop-state.js"
import type { RalphLoopStateSnapshot } from "./ralph-loop-state.js"
import type { WorkflowReportStatusDetail } from "./workflow-report-status.js"

export const WORKFLOW_LIFECYCLE_SCHEMA_VERSION = "workflow-lifecycle.1"

type LifecyclePathStatus = "safe" | "unavailable" | "unsafe"
type LifecycleReadiness = "blocked" | "ready-for-closure"
type LifecycleReportKind = "implementation" | "review"

export type WorkflowLifecycleBlocker = {
  readonly id: string
  readonly reason: string
  readonly source: string
}

export type WorkflowLifecycleFinishAuthority = {
  readonly blocker: WorkflowLifecycleBlocker | null
  readonly status: "blocked" | "trusted"
}

export type WorkflowLifecycleProjection = {
  readonly blockers: readonly WorkflowLifecycleBlocker[]
  readonly evidence: { readonly source: string; readonly status: "missing" | "present" }
  readonly finishAuthority: WorkflowLifecycleFinishAuthority
  readonly loops: {
    readonly ralph: "absent" | "current" | "malformed"
    readonly workflow: "absent" | "current" | "malformed" | "stale" | "unassessed"
  }
  readonly paths: {
    readonly evidence: LifecyclePathStatus
    readonly harness: "invalid" | "safe"
    readonly rules: LifecyclePathStatus
  }
  readonly readiness: LifecycleReadiness
  readonly reports: {
    readonly implementation: WorkflowReportStatusDetail
    readonly review: WorkflowReportStatusDetail
  }
  readonly schemaVersion: typeof WORKFLOW_LIFECYCLE_SCHEMA_VERSION
  readonly tickets: { readonly status: "clear" | "pending" }
}

export type WorkflowLifecycleProjectionInput = {
  readonly currentRulePackHash: string | undefined
  readonly evidence: "missing" | "present"
  readonly evidencePath: LifecyclePathStatus
  readonly evidenceSource: string
  readonly finishAuthority: WorkflowLifecycleFinishAuthority
  readonly harness: "invalid" | "safe"
  readonly implementationReport: WorkflowReportStatusDetail
  readonly pendingTicketCount: number
  readonly ralphLoop: RalphLoopStateSnapshot
  readonly reviewReport: WorkflowReportStatusDetail
  readonly rulesPath: LifecyclePathStatus
  readonly rulesSource: string
  readonly workflowLoop: WorkflowLoopStateSnapshot
}

export function projectWorkflowLifecycle(input: WorkflowLifecycleProjectionInput): WorkflowLifecycleProjection {
  const paths = {
    evidence: input.evidencePath,
    harness: input.harness,
    rules: input.rulesPath,
  } as const
  const loops = {
    ralph: ralphLoopStatus(input.ralphLoop),
    workflow: workflowLoopStatus(input.workflowLoop, input.currentRulePackHash),
  } as const
  const safety = safetyBlockers(input, paths)
  const blockers = safety.length > 0
    ? safety
    : lifecycleBlockers(input, loops)
  return {
    blockers,
    evidence: { source: input.evidenceSource, status: input.evidence },
    finishAuthority: input.finishAuthority,
    loops,
    paths,
    readiness: blockers.length === 0 ? "ready-for-closure" : "blocked",
    reports: {
      implementation: input.implementationReport,
      review: input.reviewReport,
    },
    schemaVersion: WORKFLOW_LIFECYCLE_SCHEMA_VERSION,
    tickets: { status: input.pendingTicketCount === 0 ? "clear" : "pending" },
  }
}

function safetyBlockers(
  input: WorkflowLifecycleProjectionInput,
  paths: WorkflowLifecycleProjection["paths"],
): readonly WorkflowLifecycleBlocker[] {
  if (paths.harness === "invalid") {
    return [{
      id: "harness-config-invalid",
      reason: "harness.jsonc is malformed, corrupt, or unsafe; read-only recovery is required before continuing.",
      source: ".persona/harness.jsonc",
    }]
  }
  if (paths.rules === "unsafe") {
    return [{
      id: "rules-path-unsafe",
      reason: "configured rules traversal is unsafe or exceeds bounded no-follow limits; read-only recovery is required before continuing.",
      source: input.rulesSource,
    }]
  }
  if (paths.evidence === "unsafe") {
    return [{
      id: "evidence-path-unsafe",
      reason: "configured evidence traversal is unsafe or exceeds bounded no-follow limits; read-only recovery is required before continuing.",
      source: input.evidenceSource,
    }]
  }
  return []
}

function lifecycleBlockers(
  input: WorkflowLifecycleProjectionInput,
  loops: WorkflowLifecycleProjection["loops"],
): readonly WorkflowLifecycleBlocker[] {
  return [
    reportBlocker("implementation", input.implementationReport),
    reportBlocker("review", input.reviewReport),
    ...(input.evidence === "missing" ? [{
      id: "evidence-missing",
      reason: `${input.evidenceSource} must contain at least one evidence file`,
      source: input.evidenceSource,
    }] : []),
    ...workflowLoopBlockers(loops.workflow),
    ...ralphLoopBlockers(loops.ralph),
    ...(input.pendingTicketCount === 0 ? [] : [{
      id: "pending-ticket",
      reason: "pending workflow tickets remain",
      source: ".persona/workflow/backlog.md",
    }]),
  ].flatMap((blocker) => blocker === undefined ? [] : [blocker])
}

function reportBlocker(
  kind: LifecycleReportKind,
  report: WorkflowReportStatusDetail,
): WorkflowLifecycleBlocker | undefined {
  const source = `.persona/workflow/${kind}-report.md`
  switch (report.status) {
    case "filled":
      return undefined
    case "conflicting":
      return { id: `${kind}-report-conflicting`, reason: `${kind} report has conflicting status markers`, source }
    case "malformed":
      return { id: `${kind}-report-malformed`, reason: `${kind} report status is malformed`, source }
    case "missing":
    case "template":
    case "unknown":
      return { id: `${kind}-report-missing`, reason: `${kind} report is ${report.status}`, source }
    default:
      return assertNever(report.status)
  }
}

function workflowLoopBlockers(status: WorkflowLifecycleProjection["loops"]["workflow"]): readonly WorkflowLifecycleBlocker[] {
  switch (status) {
    case "absent":
      return [{
        id: "workflow-loop-state-absent",
        reason: "workflow-loop state is absent; establish the explicit bounded loop state before continuing.",
        source: ".persona/workflow/workflow-loop-state.json",
      }]
    case "current":
    case "unassessed":
      return []
    case "malformed":
      return [{
        id: "workflow-loop-state-malformed",
        reason: "workflow-loop state is malformed; review the persisted state before retrying continuation.",
        source: ".persona/workflow/workflow-loop-state.json",
      }]
    case "stale":
      return [{
        id: "workflow-loop-state-stale",
        reason: "workflow-loop state was created for a different rule pack; review or replace it before continuing.",
        source: ".persona/workflow/workflow-loop-state.json",
      }]
    default:
      return assertNever(status)
  }
}

function ralphLoopBlockers(status: WorkflowLifecycleProjection["loops"]["ralph"]): readonly WorkflowLifecycleBlocker[] {
  switch (status) {
    case "absent":
      return [{
        id: "ralph-loop-state-absent",
        reason: "ralph-loop state is absent; establish it through the approved bounded runtime before continuing.",
        source: ".persona/workflow/ralph-loop-state.json",
      }]
    case "current":
      return []
    case "malformed":
      return [{
        id: "ralph-loop-state-malformed",
        reason: "ralph-loop state is malformed; review the persisted state before retrying continuation.",
        source: ".persona/workflow/ralph-loop-state.json",
      }]
    default:
      return assertNever(status)
  }
}

function workflowLoopStatus(
  snapshot: WorkflowLoopStateSnapshot,
  currentRulePackHash: string | undefined,
): WorkflowLifecycleProjection["loops"]["workflow"] {
  switch (snapshot.integrity) {
    case "absent":
      return "absent"
    case "malformed":
      return "malformed"
    case "valid":
      if (snapshot.state === null) {
        return "malformed"
      }
      if (currentRulePackHash === undefined) {
        return "unassessed"
      }
      return snapshot.state.rulePackHash === currentRulePackHash ? "current" : "stale"
    default:
      return assertNever(snapshot.integrity)
  }
}

function ralphLoopStatus(snapshot: RalphLoopStateSnapshot): WorkflowLifecycleProjection["loops"]["ralph"] {
  switch (snapshot.integrity) {
    case "absent":
      return "absent"
    case "malformed":
      return "malformed"
    case "valid":
      return "current"
    default:
      return assertNever(snapshot.integrity)
  }
}

function assertNever(value: never): never {
  throw new TypeError(`Unexpected workflow lifecycle value: ${String(value)}`)
}
