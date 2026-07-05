import type { MultiAgentRole } from "../config/harness-config.js"
import type { ClosureBlocker, ClosureTicket } from "./workflow-closure.js"

export type RelayAction = "next" | "status" | "validate"

export type RelayBlockerId =
  | "multi-agent-disabled"
  | "no-current-ticket"
  | "role-implementation-artifact-incomplete"
  | "role-implementation-artifact-missing"
  | "role-review-artifact-incomplete"
  | "role-review-artifact-missing"
  | "role-test-artifact-incomplete"
  | "role-test-artifact-missing"

export type RelayBlocker = {
  readonly id: RelayBlockerId
  readonly reason: string
  readonly source: string
}

export type RelayRoleArtifact = {
  readonly path: string
  readonly readiness: "complete" | "incomplete" | "missing"
  readonly reason: string | null
  readonly role: MultiAgentRole
  readonly status: "missing" | "present"
}

export type RelayRoleCompletionState = {
  readonly completedRoles: readonly MultiAgentRole[]
  readonly currentRole: MultiAgentRole | null
  readonly incompleteRoles: readonly MultiAgentRole[]
  readonly missingRoles: readonly MultiAgentRole[]
  readonly nextRole: MultiAgentRole | null
  readonly overall: "blocked" | "complete" | "disabled" | "no-current-ticket"
}

export type WorkflowRelayPayload = {
  readonly action: RelayAction
  readonly blockers: readonly RelayBlocker[]
  readonly closureBlocker: ClosureBlocker | null
  readonly currentRole: MultiAgentRole | null
  readonly currentTicket: ClosureTicket | null
  readonly enabled: boolean
  readonly gateCommand: string
  readonly nextRole: MultiAgentRole | null
  readonly promptBlock: string
  readonly promptLines: readonly string[]
  readonly requiredArtifact: string | null
  readonly requiredOutputArtifact: string | null
  readonly rulePackHash: string
  readonly roleArtifacts: readonly RelayRoleArtifact[]
  readonly roleCompletionState: RelayRoleCompletionState
  readonly roleOrder: readonly MultiAgentRole[]
  readonly scopedInputFiles: readonly string[]
  readonly scopedInputs: readonly string[]
}
