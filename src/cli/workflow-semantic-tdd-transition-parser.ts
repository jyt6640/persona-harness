import { createHash } from "node:crypto"

import { isRecord } from "../config/jsonc.js"
import { parseSourceIdentity } from "./source-identity.js"
import {
  SEMANTIC_TDD_TRANSITION_SCHEMA,
  type SemanticTddTransitionEnvelope,
  type SemanticTddTransitionPhase,
} from "./workflow-semantic-tdd-transition-types.js"
import type {
  VerificationCommandIdentity,
  VerificationWorkspaceIdentity,
} from "./workflow-verification-receipt-types.js"

export type SemanticTddTransitionParseResult =
  | { readonly ok: true; readonly value: SemanticTddTransitionEnvelope }
  | { readonly ok: false }

export function parseSemanticTddTransition(
  source: string,
  _displayPath = ".persona/evidence/semantic-tdd/transition.json",
): SemanticTddTransitionParseResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(source)
  } catch {
    return { ok: false }
  }
  if (!isRecord(parsed) || !hasExactKeys(parsed, ["green", "preGreenSnapshot", "provenanceDigest", "red", "schemaVersion", "sourceDelta"])) {
    return { ok: false }
  }
  const red = parsePhase(parsed.red)
  const green = parsePhase(parsed.green)
  const preGreenSnapshot = parsePreGreenSnapshot(parsed.preGreenSnapshot)
  const sourceDelta = parseSourceDelta(parsed.sourceDelta)
  if (
    red === undefined
    || green === undefined
    || preGreenSnapshot === undefined
    || sourceDelta === undefined
    || parsed.schemaVersion !== SEMANTIC_TDD_TRANSITION_SCHEMA
    || !isDigest(parsed.provenanceDigest)
    || red.receiptId !== null
    || green.receiptId === null
    || sourceDelta.changedEntryCount !== 1
    || parsed.provenanceDigest !== digest({
      green,
      preGreenSnapshot,
      red,
      sourceDelta,
    })
  ) return { ok: false }
  return {
    ok: true,
    value: {
      green,
      preGreenSnapshot,
      provenanceDigest: parsed.provenanceDigest,
      red,
      schemaVersion: SEMANTIC_TDD_TRANSITION_SCHEMA,
      sourceDelta,
    },
  }
}

function parsePhase(value: unknown): SemanticTddTransitionPhase | undefined {
  if (!isRecord(value) || !hasExactKeys(value, [
    "artifactDigest", "attemptId", "command", "completedAt", "dirtyWorktreeDigest",
    "finishId", "junitArtifactDigests", "phVersion", "provenanceDigest", "receiptId",
    "sessionId", "sourceHead", "sourceIdentity", "startedAt", "testcaseId", "workspaceIdentity",
  ])) return undefined
  const command = parseCommand(value.command)
  const sourceIdentity = parseSourceIdentity(value.sourceIdentity)
  const workspaceIdentity = parseWorkspaceIdentity(value.workspaceIdentity)
  if (
    command === undefined
    || sourceIdentity === undefined
    || workspaceIdentity === undefined
    || !isIdentifier(value.attemptId)
    || !isDigest(value.artifactDigest)
    || !isDigest(value.dirtyWorktreeDigest)
    || !isIdentifier(value.finishId)
    || !isDigestArray(value.junitArtifactDigests)
    || !isVersion(value.phVersion)
    || !isDigest(value.provenanceDigest)
    || (value.receiptId !== null && !isIdentifier(value.receiptId))
    || !isIdentifier(value.sessionId)
    || !isCommit(value.sourceHead)
    || !isTimestamp(value.startedAt)
    || (value.completedAt !== null && !isTimestamp(value.completedAt))
    || !isIdentifier(value.testcaseId)
  ) return undefined
  return {
    artifactDigest: value.artifactDigest,
    attemptId: value.attemptId,
    command,
    completedAt: value.completedAt,
    dirtyWorktreeDigest: value.dirtyWorktreeDigest,
    finishId: value.finishId,
    junitArtifactDigests: value.junitArtifactDigests,
    phVersion: value.phVersion,
    provenanceDigest: value.provenanceDigest,
    receiptId: value.receiptId,
    sessionId: value.sessionId,
    sourceHead: value.sourceHead.toLowerCase(),
    sourceIdentity,
    startedAt: value.startedAt,
    testcaseId: value.testcaseId,
    workspaceIdentity,
  }
}

function parseCommand(value: unknown): VerificationCommandIdentity | undefined {
  if (!isRecord(value) || !hasExactKeys(value, ["argvDigest", "catalogId"])) return undefined
  return typeof value.catalogId === "string" && isDigest(value.argvDigest)
    ? { argvDigest: value.argvDigest, catalogId: value.catalogId }
    : undefined
}

function parsePreGreenSnapshot(value: unknown): SemanticTddTransitionEnvelope["preGreenSnapshot"] | undefined {
  if (!isRecord(value) || !hasExactKeys(value, ["attemptId", "capturedAt", "entriesDigest", "sourceIdentity"])) return undefined
  const sourceIdentity = parseSourceIdentity(value.sourceIdentity)
  return sourceIdentity !== undefined
    && isIdentifier(value.attemptId)
    && isTimestamp(value.capturedAt)
    && isDigest(value.entriesDigest)
    ? { attemptId: value.attemptId, capturedAt: value.capturedAt, entriesDigest: value.entriesDigest, sourceIdentity }
    : undefined
}

function parseSourceDelta(value: unknown): SemanticTddTransitionEnvelope["sourceDelta"] | undefined {
  if (!isRecord(value) || !hasExactKeys(value, [
    "changedEntryCount", "changedEntryDigest", "targetAnchorDigest", "unchangedEntryCount", "unchangedEntryDigest",
  ])) return undefined
  return isNonNegativeInteger(value.changedEntryCount)
    && isDigest(value.changedEntryDigest)
    && isDigest(value.targetAnchorDigest)
    && isNonNegativeInteger(value.unchangedEntryCount)
    && isDigest(value.unchangedEntryDigest)
    ? {
        changedEntryCount: value.changedEntryCount,
        changedEntryDigest: value.changedEntryDigest,
        targetAnchorDigest: value.targetAnchorDigest,
        unchangedEntryCount: value.unchangedEntryCount,
        unchangedEntryDigest: value.unchangedEntryDigest,
      }
    : undefined
}

function parseWorkspaceIdentity(value: unknown): VerificationWorkspaceIdentity | undefined {
  if (!isRecord(value) || !hasExactKeys(value, ["deviceIdentity", "platform", "rootDigest"])) return undefined
  return typeof value.deviceIdentity === "string"
    && /^\d+:\d+$/u.test(value.deviceIdentity)
    && isDigest(value.rootDigest)
    && (value.platform === "darwin" || value.platform === "linux" || value.platform === "win32" || value.platform === "unknown")
    ? { deviceIdentity: value.deviceIdentity, platform: value.platform, rootDigest: value.rootDigest }
    : undefined
}

function hasExactKeys(value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => key in value)
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/u.test(value)
}

function isDigestArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.length > 0 && value.every(isDigest)
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9._:#-]{1,240}$/u.test(value)
}

function isCommit(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{40,64}$/iu.test(value)
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value))
}

function isVersion(value: unknown): value is string {
  return typeof value === "string" && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(value)
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
}

function digest(value: unknown): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`
}
