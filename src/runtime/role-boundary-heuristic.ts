import { readWorkflowRelayPayload } from "../cli/workflow-relay.js"
import { appendRoleBoundaryObservation, readRoleBoundaryHeuristicFindings } from "./role-boundary-evidence.js"
import type { RoleBoundaryHeuristicFinding } from "./role-boundary-evidence.js"
import { isWriteOrEditTool, normalizeObservedPath, roleBoundaryPathPolicy } from "./role-boundary-policy.js"

export type { RoleBoundaryHeuristicFinding }
export { readRoleBoundaryHeuristicFindings }

type RoleBoundaryWriteDeps = {
  readonly appendObservation?: typeof appendRoleBoundaryObservation
  readonly readRelayPayload?: typeof readWorkflowRelayPayload
}

type ObserveRoleBoundaryWriteInput = {
  readonly callID?: string
  readonly multiAgentEnabled: boolean
  readonly projectDir: string
  readonly sessionID: string
  readonly targetFile?: string
  readonly tool: string
}

export function observeRoleBoundaryWrite(input: ObserveRoleBoundaryWriteInput, deps: RoleBoundaryWriteDeps = {}): void {
  if (!input.multiAgentEnabled) {
    return
  }
  if (!isWriteOrEditTool(input.tool) || input.targetFile === undefined) {
    return
  }
  const readRelayPayload = deps.readRelayPayload ?? readWorkflowRelayPayload
  const relay = readRelayPayload("status", input.projectDir)
  if (!relay.enabled || relay.currentRole === null || relay.currentTicket === null) {
    return
  }
  const path = normalizeObservedPath(input.projectDir, input.targetFile)
  const policy = roleBoundaryPathPolicy(relay.currentRole, relay.currentTicket.id, path)
  if (policy.allowed) {
    return
  }
  const appendObservation = deps.appendObservation ?? appendRoleBoundaryObservation
  appendObservation(input.projectDir, {
    callID: input.callID,
    currentTicketId: relay.currentTicket.id,
    path,
    policy: policy.reason,
    role: relay.currentRole,
    sessionID: input.sessionID,
  })
}
