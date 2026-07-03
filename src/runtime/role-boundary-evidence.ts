import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

import type { MultiAgentRole } from "../config/harness-config.js"
import { loadHarnessConfig, resolveConfiguredPath } from "../config/harness-config.js"
import { isRecord } from "../config/jsonc.js"
import { warnRuntimeFailure } from "./error-boundary.js"
import { HEURISTIC_LIMITATION, ROLE_BOUNDARY_LIMITATIONS } from "./role-boundary-policy.js"

export type RoleBoundaryHeuristicFinding = {
  readonly count: number
  readonly currentTicketId: string
  readonly heuristic: true
  readonly id: "role-boundary-heuristic-write-outside-role"
  readonly limitation: string
  readonly message: string
  readonly path: string
  readonly role: MultiAgentRole
  readonly sessionID: string
  readonly severity: "warning"
  readonly source: "runtime-write-observation"
}

export type RoleBoundaryObservationInput = {
  readonly callID?: string
  readonly currentTicketId: string
  readonly path: string
  readonly policy: string
  readonly role: MultiAgentRole
  readonly sessionID: string
}

type RoleBoundaryObservation = {
  readonly callIDs: readonly string[]
  readonly count: number
  readonly currentTicketId: string
  readonly firstSeen: string
  readonly lastSeen: string
  readonly limitation: string
  readonly path: string
  readonly policy: string
  readonly role: MultiAgentRole
  readonly severity: "warning"
}

type RoleBoundaryEvidencePayload = {
  readonly count: number
  readonly enforcement: false
  readonly evidenceKind: "role-boundary-heuristic"
  readonly firstSeen: string
  readonly lastSeen: string
  readonly limitations: readonly string[]
  readonly observations: readonly RoleBoundaryObservation[]
  readonly reportOnly: true
  readonly schemaVersion: "role-boundary-heuristic.1"
  readonly sessionID: string
}

function safeSessionKey(sessionID: string): string {
  return sessionID.replace(/[^a-zA-Z0-9._-]+/g, "-").toLowerCase() || "session"
}

function roleBoundaryEvidenceDir(projectDir: string): string {
  const config = loadHarnessConfig(projectDir)
  return join(resolveConfiguredPath(projectDir, config.evidenceDir), "role-boundary")
}

function roleBoundaryEvidencePath(projectDir: string, sessionID: string): string {
  return join(roleBoundaryEvidenceDir(projectDir), `${safeSessionKey(sessionID)}.json`)
}

function observationKey(observation: Pick<RoleBoundaryObservation, "currentTicketId" | "path" | "role">): string {
  return `${observation.currentTicketId}\u0000${observation.role}\u0000${observation.path}`
}

function observationFromRecord(value: unknown): RoleBoundaryObservation | undefined {
  if (!isRecord(value)) {
    return undefined
  }
  const role = value.role
  if (role !== "test-writer" && role !== "implementer" && role !== "reviewer") {
    return undefined
  }
  if (value.severity !== "warning") {
    return undefined
  }
  return {
    callIDs: Array.isArray(value.callIDs) ? value.callIDs.filter((item): item is string => typeof item === "string") : [],
    count: typeof value.count === "number" ? value.count : 0,
    currentTicketId: typeof value.currentTicketId === "string" ? value.currentTicketId : "unknown",
    firstSeen: typeof value.firstSeen === "string" ? value.firstSeen : new Date().toISOString(),
    lastSeen: typeof value.lastSeen === "string" ? value.lastSeen : new Date().toISOString(),
    limitation: typeof value.limitation === "string" ? value.limitation : HEURISTIC_LIMITATION,
    path: typeof value.path === "string" ? value.path : "unknown",
    policy: typeof value.policy === "string" ? value.policy : "unknown role path policy",
    role,
    severity: "warning",
  }
}

function readEvidence(path: string): RoleBoundaryEvidencePayload | undefined {
  if (!existsSync(path)) {
    return undefined
  }
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"))
    if (!isRecord(parsed) || parsed.schemaVersion !== "role-boundary-heuristic.1") {
      return undefined
    }
    const observations = Array.isArray(parsed.observations)
      ? parsed.observations.map(observationFromRecord).filter((item): item is RoleBoundaryObservation => item !== undefined)
      : []
    return {
      count: typeof parsed.count === "number" ? parsed.count : observations.reduce((sum, item) => sum + item.count, 0),
      enforcement: false,
      evidenceKind: "role-boundary-heuristic",
      firstSeen: typeof parsed.firstSeen === "string" ? parsed.firstSeen : new Date().toISOString(),
      lastSeen: typeof parsed.lastSeen === "string" ? parsed.lastSeen : new Date().toISOString(),
      limitations: ROLE_BOUNDARY_LIMITATIONS,
      observations,
      reportOnly: true,
      schemaVersion: "role-boundary-heuristic.1",
      sessionID: typeof parsed.sessionID === "string" ? parsed.sessionID : "unknown-session",
    }
  } catch (error) {
    if (error instanceof Error) {
      warnRuntimeFailure("evidence-write", "role-boundary-heuristic-read", path, error)
      return undefined
    }
    warnRuntimeFailure("evidence-write", "role-boundary-heuristic-read", path, new Error(String(error)))
    return undefined
  }
}

function updateObservation(
  observations: readonly RoleBoundaryObservation[],
  next: RoleBoundaryObservation,
): readonly RoleBoundaryObservation[] {
  const updated: RoleBoundaryObservation[] = []
  let merged = false
  for (const previous of observations) {
    if (observationKey(previous) !== observationKey(next)) {
      updated.push(previous)
      continue
    }
    const callIDs = next.callIDs[0] === undefined ? previous.callIDs : [...previous.callIDs, next.callIDs[0]]
    updated.push({ ...previous, callIDs, count: previous.count + 1, lastSeen: next.lastSeen })
    merged = true
  }
  return merged ? updated : [...updated, next]
}

export function appendRoleBoundaryObservation(projectDir: string, input: RoleBoundaryObservationInput): void {
  const outputPath = roleBoundaryEvidencePath(projectDir, input.sessionID)
  const now = new Date().toISOString()
  const previous = readEvidence(outputPath)
  const observation: RoleBoundaryObservation = {
    callIDs: input.callID === undefined ? [] : [input.callID],
    count: 1,
    currentTicketId: input.currentTicketId,
    firstSeen: now,
    lastSeen: now,
    limitation: HEURISTIC_LIMITATION,
    path: input.path,
    policy: input.policy,
    role: input.role,
    severity: "warning",
  }
  const observations = updateObservation(previous?.observations ?? [], observation)
  const payload: RoleBoundaryEvidencePayload = {
    count: observations.reduce((sum, item) => sum + item.count, 0),
    enforcement: false,
    evidenceKind: "role-boundary-heuristic",
    firstSeen: previous?.firstSeen ?? now,
    lastSeen: now,
    limitations: ROLE_BOUNDARY_LIMITATIONS,
    observations,
    reportOnly: true,
    schemaVersion: "role-boundary-heuristic.1",
    sessionID: input.sessionID,
  }

  try {
    mkdirSync(dirname(outputPath), { recursive: true })
    writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`)
  } catch (error) {
    if (error instanceof Error) {
      warnRuntimeFailure("evidence-write", "role-boundary-heuristic-write", outputPath, error)
      return
    }
    warnRuntimeFailure("evidence-write", "role-boundary-heuristic-write", outputPath, new Error(String(error)))
  }
}

export function readRoleBoundaryHeuristicFindings(projectDir: string): readonly RoleBoundaryHeuristicFinding[] {
  const evidenceDir = roleBoundaryEvidenceDir(projectDir)
  if (!existsSync(evidenceDir)) {
    return []
  }
  const findings: RoleBoundaryHeuristicFinding[] = []
  for (const fileName of readdirSync(evidenceDir).filter((entry) => entry.endsWith(".json")).sort()) {
    const evidence = readEvidence(join(evidenceDir, fileName))
    if (evidence === undefined) {
      continue
    }
    for (const observation of evidence.observations) {
      findings.push({
        count: observation.count,
        currentTicketId: observation.currentTicketId,
        heuristic: true,
        id: "role-boundary-heuristic-write-outside-role",
        limitation: observation.limitation,
        message: `${observation.role} wrote ${observation.path} outside the heuristic role path policy: ${observation.policy}.`,
        path: observation.path,
        role: observation.role,
        sessionID: evidence.sessionID,
        severity: "warning",
        source: "runtime-write-observation",
      })
    }
  }
  return findings
}
