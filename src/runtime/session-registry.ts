import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

import type { Event } from "@opencode-ai/sdk"

import { loadHarnessConfig, resolveConfiguredPath } from "../config/harness-config.js"
import { isRecord } from "../config/jsonc.js"
import { warnRuntimeFailure } from "./error-boundary.js"

type SessionKind = "main" | "subagent" | "unknown"

export type RuntimeInjectionSurface =
  | "idle-continuation"
  | "intent-workflow"
  | "java-role-discovery"
  | "model-input"
  | "system-constitution"
  | "target-file"
  | "text-continuation"

type SessionClassification = {
  readonly kind: SessionKind
  readonly parentID: string | null
  readonly state: "classified" | "unclassified"
}

type SkipEvidencePayload = {
  readonly classification: SessionClassification
  readonly count: number
  readonly firstSeen: string
  readonly lastReason: string
  readonly lastSeen: string
  readonly schemaVersion: "session-injection-skip.1"
  readonly sessionID: string
  readonly skippedSurfaces: Readonly<Partial<Record<RuntimeInjectionSurface, number>>>
}

type RuntimeSessionRegistryOptions = {
  readonly multiAgentEnabled: boolean
  readonly projectDir: string
  readonly runtimeInjectionEnabled: boolean
}

type SkipRecordInput = {
  readonly classification: SessionClassification
  readonly reason: string
  readonly sessionID: string
  readonly surface: RuntimeInjectionSurface
}

const RUNTIME_INJECTION_SURFACES: readonly RuntimeInjectionSurface[] = [
  "idle-continuation",
  "intent-workflow",
  "java-role-discovery",
  "model-input",
  "system-constitution",
  "target-file",
  "text-continuation",
]

function safeSessionKey(sessionID: string): string {
  return sessionID.replace(/[^a-zA-Z0-9._-]+/g, "-").toLowerCase() || "session"
}

function skipEvidencePath(projectDir: string, sessionID: string): string {
  const config = loadHarnessConfig(projectDir)
  return join(
    resolveConfiguredPath(projectDir, config.evidenceDir),
    "session-injection-skips",
    `${safeSessionKey(sessionID)}.json`,
  )
}

function surfaceCounts(value: unknown): Partial<Record<RuntimeInjectionSurface, number>> {
  const counts: Partial<Record<RuntimeInjectionSurface, number>> = {}
  if (!isRecord(value)) {
    return counts
  }

  for (const surface of RUNTIME_INJECTION_SURFACES) {
    const count = value[surface]
    if (typeof count === "number") {
      counts[surface] = count
    }
  }
  return counts
}

function readSkipEvidence(path: string): SkipEvidencePayload | undefined {
  if (!existsSync(path)) {
    return undefined
  }
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"))
    if (!isRecord(parsed) || parsed.schemaVersion !== "session-injection-skip.1") {
      return undefined
    }
    return {
      classification: classificationFromRecord(parsed.classification),
      count: typeof parsed.count === "number" ? parsed.count : 0,
      firstSeen: typeof parsed.firstSeen === "string" ? parsed.firstSeen : new Date().toISOString(),
      lastReason: typeof parsed.lastReason === "string" ? parsed.lastReason : "unknown",
      lastSeen: typeof parsed.lastSeen === "string" ? parsed.lastSeen : new Date().toISOString(),
      schemaVersion: "session-injection-skip.1",
      sessionID: typeof parsed.sessionID === "string" ? parsed.sessionID : "unknown",
      skippedSurfaces: surfaceCounts(parsed.skippedSurfaces),
    }
  } catch (error) {
    if (error instanceof Error) {
      warnRuntimeFailure("evidence-write", "session-injection-skip-read", path, error)
      return undefined
    }
    warnRuntimeFailure("evidence-write", "session-injection-skip-read", path, new Error(String(error)))
    return undefined
  }
}

function classificationFromRecord(value: unknown): SessionClassification {
  if (!isRecord(value)) {
    return { kind: "unknown", parentID: null, state: "unclassified" }
  }
  const kind = value.kind === "main" || value.kind === "subagent" ? value.kind : "unknown"
  return {
    kind,
    parentID: typeof value.parentID === "string" ? value.parentID : null,
    state: value.state === "classified" ? "classified" : "unclassified",
  }
}

export class RuntimeSessionRegistry {
  private readonly sessions = new Map<string, SessionClassification>()

  constructor(private readonly options: RuntimeSessionRegistryOptions) {}

  observeEvent(event: Event): void {
    if (event.type !== "session.created" && event.type !== "session.updated") {
      return
    }
    const parentID = event.properties.info.parentID
    this.sessions.set(event.properties.info.id, {
      kind: parentID === undefined ? "main" : "subagent",
      parentID: parentID ?? null,
      state: "classified",
    })
  }

  classification(sessionID: string): SessionClassification {
    return this.sessions.get(sessionID) ?? { kind: "unknown", parentID: null, state: "unclassified" }
  }

  allowsRuntimeInjection(sessionID: string | undefined, surface: RuntimeInjectionSurface): boolean {
    if (!this.options.runtimeInjectionEnabled || !this.options.multiAgentEnabled) {
      return true
    }
    const resolvedSessionID = sessionID ?? "unknown-session"
    const classification = this.classification(resolvedSessionID)
    if (classification.kind === "main") {
      return true
    }
    const reason = classification.kind === "subagent"
      ? "subagent-session"
      : "classification-unavailable"
    this.recordSkip({ classification, reason, sessionID: resolvedSessionID, surface })
    return false
  }

  private recordSkip(input: SkipRecordInput): void {
    const outputPath = skipEvidencePath(this.options.projectDir, input.sessionID)
    const now = new Date().toISOString()
    const previous = readSkipEvidence(outputPath)
    const skippedSurfaces = {
      ...previous?.skippedSurfaces,
      [input.surface]: (previous?.skippedSurfaces[input.surface] ?? 0) + 1,
    }
    const payload: SkipEvidencePayload = {
      classification: input.classification,
      count: (previous?.count ?? 0) + 1,
      firstSeen: previous?.firstSeen ?? now,
      lastReason: input.reason,
      lastSeen: now,
      schemaVersion: "session-injection-skip.1",
      sessionID: input.sessionID,
      skippedSurfaces,
    }
    try {
      mkdirSync(dirname(outputPath), { recursive: true })
      writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`)
    } catch (error) {
      if (error instanceof Error) {
        warnRuntimeFailure("evidence-write", "session-injection-skip-write", outputPath, error)
        return
      }
      warnRuntimeFailure("evidence-write", "session-injection-skip-write", outputPath, new Error(String(error)))
    }
  }
}
