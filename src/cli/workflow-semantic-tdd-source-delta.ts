import { createHash } from "node:crypto"

import { sameSourceIdentity } from "./source-identity.js"
import type {
  SemanticTddSourceSnapshot,
  SemanticTddTransitionEnvelope,
  SemanticTddTransitionDiagnosticCode,
  SemanticTddTransitionPhase,
} from "./workflow-semantic-tdd-transition-types.js"

export type SourceDeltaResult =
  | { readonly kind: "none" | "structural" | "unrelated" }
  | { readonly delta: SemanticTddTransitionEnvelope["sourceDelta"]; readonly kind: "valid" }

export function compareSnapshots(
  red: SemanticTddSourceSnapshot,
  green: SemanticTddSourceSnapshot,
  redPhase: SemanticTddTransitionPhase,
  greenPhase: SemanticTddTransitionPhase,
): readonly SemanticTddTransitionDiagnosticCode[] {
  const codes: SemanticTddTransitionDiagnosticCode[] = []
  if (
    red.attemptId !== redPhase.attemptId
    || green.attemptId !== greenPhase.attemptId
    || red.sourceHead !== redPhase.sourceHead
    || green.sourceHead !== greenPhase.sourceHead
    || red.dirtyWorktreeDigest !== redPhase.dirtyWorktreeDigest
    || green.dirtyWorktreeDigest !== greenPhase.dirtyWorktreeDigest
    || !sameSourceIdentity(red.sourceIdentity, redPhase.sourceIdentity)
    || !sameSourceIdentity(green.sourceIdentity, greenPhase.sourceIdentity)
    || JSON.stringify(red.workspaceIdentity) !== JSON.stringify(redPhase.workspaceIdentity)
    || JSON.stringify(green.workspaceIdentity) !== JSON.stringify(greenPhase.workspaceIdentity)
    || Date.parse(red.capturedAt) > Date.parse(redPhase.startedAt)
    || Date.parse(green.capturedAt) > Date.parse(greenPhase.startedAt)
  ) codes.push("source-snapshot-stale")
  return codes
}

export function sourceDelta(
  red: SemanticTddSourceSnapshot,
  green: SemanticTddSourceSnapshot,
): SourceDeltaResult {
  const before = new Map(red.entries.map((entry) => [entry.pathDigest, entry]))
  const after = new Map(green.entries.map((entry) => [entry.pathDigest, entry]))
  if (before.size !== red.entries.length || after.size !== green.entries.length) return { kind: "structural" }
  const changed: string[] = []
  const unchanged: string[] = []
  const keys = [...new Set([...before.keys(), ...after.keys()])].sort()
  const changes: { readonly pathDigest: string; readonly before?: unknown; readonly after?: unknown }[] = []
  for (const key of keys) {
    const left = before.get(key)
    const right = after.get(key)
    if (left !== undefined && right !== undefined && sameEntry(left, right)) unchanged.push(key)
    else {
      changed.push(key)
      changes.push({ pathDigest: key, ...(left === undefined ? {} : { before: left }), ...(right === undefined ? {} : { after: right }) })
    }
  }
  if (changed.length === 0) return { kind: "none" }
  const changedEntry = changed.length === 1 ? after.get(changed[0] ?? "") : undefined
  if (
    changed.length !== 1
    || changedEntry === undefined
    || changedEntry.kind !== "file"
    || changedEntry.anchor !== "java-source"
    || changes.some((change) => {
      const left = change.before as { readonly kind?: string; readonly mode?: string } | undefined
      const right = change.after as { readonly kind?: string; readonly mode?: string } | undefined
      return left?.kind !== undefined && right?.kind !== undefined && (left.kind !== "file" || right.kind !== "file")
        || left?.mode !== undefined && right?.mode !== undefined && left.mode !== right.mode
        || right === undefined
    })
  ) return { kind: changed.length === 1 ? "structural" : "unrelated" }
  return {
    kind: "valid",
    delta: {
      changedEntryCount: 1,
      changedEntryDigest: digest(changes),
      targetAnchorDigest: changedEntry.pathDigest,
      unchangedEntryCount: unchanged.length,
      unchangedEntryDigest: digest(unchanged),
    },
  }
}

export function buildEnvelope(
  red: SemanticTddTransitionPhase,
  green: SemanticTddTransitionPhase,
  greenSnapshot: SemanticTddSourceSnapshot,
  delta: { readonly delta?: SemanticTddTransitionEnvelope["sourceDelta"] },
): SemanticTddTransitionEnvelope {
  const sourceDeltaValue = delta.delta
  if (sourceDeltaValue === undefined) throw new TypeError("valid source delta is required")
  const preGreenSnapshot = {
    attemptId: greenSnapshot.attemptId,
    capturedAt: greenSnapshot.capturedAt,
    entriesDigest: greenSnapshot.entriesDigest,
    sourceIdentity: greenSnapshot.sourceIdentity,
  }
  return {
    green,
    preGreenSnapshot,
    provenanceDigest: digest({ green, preGreenSnapshot, red, sourceDelta: sourceDeltaValue }),
    red,
    schemaVersion: "semantic-tdd-transition.1",
    sourceDelta: sourceDeltaValue,
  }
}

function sameEntry(
  left: SemanticTddSourceSnapshot["entries"][number],
  right: SemanticTddSourceSnapshot["entries"][number],
): boolean {
  return left.anchor === right.anchor
    && left.classification === right.classification
    && left.contentDigest === right.contentDigest
    && left.kind === right.kind
    && left.mode === right.mode
}

function digest(value: unknown): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`
}
