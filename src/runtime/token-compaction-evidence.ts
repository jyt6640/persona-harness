import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { EVIDENCE_PRIVACY_CLASS } from "../config/evidence-privacy.js"
import { isRecord } from "../config/jsonc.js"
import { opaqueEvidenceKey, writePrivateEvidenceJson } from "./evidence-file.js"
import type { TokenUsage } from "./token-telemetry.js"

export type TokenCompactionSummarizeOptions = {
  readonly body: {
    readonly modelID: string
    readonly providerID: string
  }
  readonly path: {
    readonly id: string
  }
  readonly query: {
    readonly directory: string
  }
}

export type CompactionMeasurement =
  | {
      readonly aggregate: TokenUsage
      readonly measured: true
      readonly ratio: number
    }
  | {
      readonly aggregate: TokenUsage
      readonly measured: false
      readonly reason: string
    }

export type CompactionAttempt = {
  readonly afterMeasurement: {
    readonly measured: false
    readonly reason: string
  }
  readonly beforeMeasurement: CompactionMeasurement
  readonly request?: TokenCompactionSummarizeOptions
  readonly reason?: string
  readonly status: "failed" | "skipped" | "triggered"
  readonly timestamp: string
}

type CompactionEvidence = {
  readonly attempts: readonly CompactionAttempt[]
  readonly createdAt: string
  readonly privacyClass: "metadata-safe"
  readonly schemaVersion: "token-compaction.1"
  readonly sessionID: string
  readonly source: "opencode-plugin-event:message.updated"
  readonly updatedAt: string
}

function compactionEvidencePath(evidenceDir: string, sessionID: string): string {
  return join(evidenceDir, "compaction", `${opaqueEvidenceKey(sessionID)}.json`)
}

function isCompactionAttempt(value: unknown): value is CompactionAttempt {
  return (
    isRecord(value) &&
    typeof value.timestamp === "string" &&
    (value.status === "failed" || value.status === "skipped" || value.status === "triggered") &&
    isRecord(value.beforeMeasurement) &&
    typeof value.beforeMeasurement.measured === "boolean" &&
    isRecord(value.afterMeasurement) &&
    value.afterMeasurement.measured === false &&
    typeof value.afterMeasurement.reason === "string"
  )
}

function readExistingEvidence(path: string): CompactionEvidence | undefined {
  if (!existsSync(path)) {
    return undefined
  }
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"))
    if (
      !isRecord(parsed) ||
      parsed.schemaVersion !== "token-compaction.1" ||
      typeof parsed.sessionID !== "string" ||
      typeof parsed.createdAt !== "string" ||
      !Array.isArray(parsed.attempts)
    ) {
      return undefined
    }
    return {
      attempts: parsed.attempts.filter(isCompactionAttempt),
      createdAt: parsed.createdAt,
      privacyClass: EVIDENCE_PRIVACY_CLASS.metadataSafe,
      schemaVersion: "token-compaction.1",
      sessionID: parsed.sessionID,
      source: "opencode-plugin-event:message.updated",
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : parsed.createdAt,
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      return undefined
    }
    throw error
  }
}

export function writeCompactionAttempt(
  evidenceDir: string,
  sessionID: string,
  attempt: CompactionAttempt,
): string {
  const outputPath = compactionEvidencePath(evidenceDir, sessionID)
  const previous = readExistingEvidence(outputPath)
  const payload: CompactionEvidence = {
    attempts: [...(previous?.attempts ?? []), attempt],
    createdAt: previous?.createdAt ?? attempt.timestamp,
    privacyClass: EVIDENCE_PRIVACY_CLASS.metadataSafe,
    schemaVersion: "token-compaction.1",
    sessionID,
    source: "opencode-plugin-event:message.updated",
    updatedAt: attempt.timestamp,
  }
  writePrivateEvidenceJson(evidenceDir, outputPath, payload)
  return outputPath
}

export function compactionEvidenceCooldownUntil(
  evidenceDir: string,
  sessionID: string,
  cooldownMs: number,
): number {
  const previous = readExistingEvidence(compactionEvidencePath(evidenceDir, sessionID))
  const latestAttemptMs = previous?.attempts.reduce((latest, attempt) => {
    if (attempt.status !== "failed" && attempt.status !== "triggered") {
      return latest
    }
    const attemptMs = Date.parse(attempt.timestamp)
    return Number.isFinite(attemptMs) && attemptMs > latest ? attemptMs : latest
  }, 0)
  return latestAttemptMs === undefined ? 0 : latestAttemptMs + cooldownMs
}
