import type { ClosureStepKind, ClosureStepStatus } from "./workflow-closure.js"

export type StructuredWorkflowRequiredFix = {
  readonly blockerId: string
  readonly detail: string
  readonly nextAction: string | null
  readonly reason: string
  readonly source: string
  readonly step: {
    readonly command?: string
    readonly commandAfterContent?: string
    readonly id: string
    readonly kind: ClosureStepKind
    readonly status: ClosureStepStatus
  } | null
  readonly type: "closure-blocker"
}

export type WorkflowRequiredFix = string | StructuredWorkflowRequiredFix

export function isStructuredWorkflowRequiredFix(fix: WorkflowRequiredFix): fix is StructuredWorkflowRequiredFix {
  return typeof fix !== "string"
}
