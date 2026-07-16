import { createHash } from "node:crypto"

import { isRecord } from "../config/jsonc.js"
import { parseSourceIdentity } from "./source-identity.js"
import type { SemanticTddSourceSnapshot, SourceSnapshotEntry } from "./workflow-semantic-tdd-transition-types.js"
import type { VerificationWorkspaceIdentity } from "./workflow-verification-receipt-types.js"

export function parseSemanticTddSourceSnapshot(
  source: string,
): { readonly ok: true; readonly value: SemanticTddSourceSnapshot } | { readonly ok: false } {
  let parsed: unknown
  try {
    parsed = JSON.parse(source)
  } catch {
    return { ok: false }
  }
  if (!isRecord(parsed) || !hasExactKeys(parsed, [
    "attemptId", "capturedAt", "dirtyWorktreeDigest", "entries", "entriesDigest", "phase",
    "schemaVersion", "sourceHead", "sourceIdentity", "workspaceIdentity",
  ])) return { ok: false }
  const sourceIdentity = parseSourceIdentity(parsed.sourceIdentity)
  const entries = parseEntries(parsed.entries)
  const workspaceIdentity = parseWorkspaceIdentity(parsed.workspaceIdentity)
  if (
    sourceIdentity === undefined
    || entries === undefined
    || workspaceIdentity === undefined
    || typeof parsed.attemptId !== "string"
    || !isTimestamp(parsed.capturedAt)
    || !isDigest(parsed.dirtyWorktreeDigest)
    || !isDigest(parsed.entriesDigest)
    || parsed.entriesDigest !== digest(JSON.stringify(entries))
    || (parsed.phase !== "red" && parsed.phase !== "green")
    || parsed.schemaVersion !== "semantic-tdd-source-snapshot.1"
    || !/^[a-f0-9]{40,64}$/u.test(String(parsed.sourceHead))
  ) return { ok: false }
  return {
    ok: true,
    value: {
      attemptId: parsed.attemptId,
      capturedAt: parsed.capturedAt,
      dirtyWorktreeDigest: parsed.dirtyWorktreeDigest,
      entries,
      entriesDigest: parsed.entriesDigest,
      phase: parsed.phase,
      schemaVersion: "semantic-tdd-source-snapshot.1",
      sourceHead: String(parsed.sourceHead).toLowerCase(),
      sourceIdentity,
      workspaceIdentity,
    },
  }
}

function parseEntries(value: unknown): readonly SourceSnapshotEntry[] | undefined {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20_000) return undefined
  const entries: SourceSnapshotEntry[] = []
  for (const entry of value) {
    if (!isRecord(entry) || !hasAllowedKeys(entry, ["anchor", "classification", "contentDigest", "kind", "mode", "pathDigest"])) {
      return undefined
    }
    if (
      (entry.anchor !== "java-source" && entry.anchor !== "other")
      || (entry.kind !== "directory" && entry.kind !== "file" && entry.kind !== "missing-tracked")
      || typeof entry.mode !== "string"
      || !/^[0-7]{4}$/u.test(entry.mode)
      || !isDigest(entry.pathDigest)
      || (entry.classification !== undefined && entry.classification !== "tracked" && entry.classification !== "untracked")
      || (entry.contentDigest !== undefined && !isDigest(entry.contentDigest))
      || (entry.kind === "file" && (entry.classification === undefined || entry.contentDigest === undefined))
      || (entry.kind !== "file" && (entry.classification !== undefined || entry.contentDigest !== undefined))
    ) return undefined
    entries.push({
      anchor: entry.anchor,
      ...(entry.classification === undefined ? {} : { classification: entry.classification }),
      ...(entry.contentDigest === undefined ? {} : { contentDigest: entry.contentDigest }),
      kind: entry.kind,
      mode: entry.mode,
      pathDigest: entry.pathDigest,
    })
  }
  return entries
}

function parseWorkspaceIdentity(value: unknown): VerificationWorkspaceIdentity | undefined {
  if (!isRecord(value) || !hasExactKeys(value, ["deviceIdentity", "platform", "rootDigest"])) return undefined
  if (
    typeof value.deviceIdentity !== "string"
    || !/^\d+:\d+$/u.test(value.deviceIdentity)
    || (value.platform !== "darwin" && value.platform !== "linux" && value.platform !== "win32" && value.platform !== "unknown")
    || !isDigest(value.rootDigest)
  ) return undefined
  return {
    deviceIdentity: value.deviceIdentity,
    platform: value.platform,
    rootDigest: value.rootDigest,
  }
}

function hasExactKeys(value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => key in value)
}

function hasAllowedKeys(value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key))
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/u.test(value)
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value))
}

function digest(value: string | Buffer): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`
}
