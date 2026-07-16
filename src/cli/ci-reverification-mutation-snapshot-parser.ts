import { isRecord } from "../config/jsonc.js"
import { parseSourceIdentity } from "./source-identity.js"
import {
  MUTATION_SNAPSHOT_SCHEMA,
  isSafeMutationSnapshotReference,
  type CompleteMutationSnapshot,
  type MutationDigest,
  type MutationSnapshot,
  type OverflowMutationSnapshot,
  type PersistedPathIdentity,
} from "./ci-reverification-mutation-snapshot.js"

const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/u
const GIT_COMMIT_PATTERN = /^[a-f0-9]{40,64}$/u
const SAFE_DIAGNOSTIC_CODE = /^[a-z][a-z0-9-]{0,95}$/u

export function parseMutationSnapshot(value: unknown): MutationSnapshot | undefined {
  if (!isRecord(value) || value.schemaVersion !== MUTATION_SNAPSHOT_SCHEMA || typeof value.kind !== "string") {
    return undefined
  }
  if (value.kind === "overflow") return parseOverflowSnapshot(value)
  return value.kind === "complete" ? parseCompleteSnapshot(value) : undefined
}

function parseCompleteSnapshot(value: Readonly<Record<string, unknown>>): CompleteMutationSnapshot | undefined {
  if (!hasExactKeys(value, [
    "allowlist", "artifactParent", "decision", "disallowedTracked", "git", "kind", "observed",
    "post", "pre", "schemaVersion", "sourceIdentity", "untracked", "workspaceRoot",
  ])) return undefined
  const allowlist = parseAllowlist(value.allowlist)
  const artifactParent = parseArtifactParent(value.artifactParent)
  const disallowedTracked = parseDigestSummary(value.disallowedTracked)
  const git = parseGit(value.git)
  const observed = parseDigestSummary(value.observed)
  const post = parseStatusSummary(value.post)
  const pre = parseStatusSummary(value.pre)
  const sourceIdentity = parseSourceIdentityBinding(value.sourceIdentity)
  const untracked = parseDigestSummary(value.untracked)
  const workspaceRoot = parseWorkspaceRoot(value.workspaceRoot)
  if (
    allowlist === undefined || artifactParent === undefined || disallowedTracked === undefined
    || git === undefined || observed === undefined || post === undefined || pre === undefined
    || sourceIdentity === undefined || untracked === undefined || workspaceRoot === undefined
    || !isDecision(value.decision)
  ) return undefined
  return {
    allowlist, artifactParent, decision: value.decision, disallowedTracked, git, kind: "complete",
    observed, post, pre, schemaVersion: MUTATION_SNAPSHOT_SCHEMA, sourceIdentity, untracked, workspaceRoot,
  }
}

function parseOverflowSnapshot(value: Readonly<Record<string, unknown>>): OverflowMutationSnapshot | undefined {
  if (!hasExactKeys(value, ["kind", "overflowSummary", "schemaVersion"]) || !isRecord(value.overflowSummary)) {
    return undefined
  }
  const summary = value.overflowSummary
  if (
    !isNonNegativeInteger(summary.byteCount) || !isNonNegativeInteger(summary.entryCount)
    || !isDigest(summary.entryDigest) || !hasExactKeys(summary, ["byteCount", "entryCount", "entryDigest"])
  ) return undefined
  return {
    kind: "overflow",
    overflowSummary: {
      byteCount: summary.byteCount,
      entryCount: summary.entryCount,
      entryDigest: summary.entryDigest,
    },
    schemaVersion: MUTATION_SNAPSHOT_SCHEMA,
  }
}

function parseAllowlist(value: unknown): CompleteMutationSnapshot["allowlist"] | undefined {
  if (!isRecord(value) || !hasExactKeys(value, ["allowedTracked", "id", "roots"])) return undefined
  const allowedTracked = parseDigestSummary(value.allowedTracked)
  if (
    allowedTracked === undefined || value.id !== "java-spring-gradle-wrapper.1" || !Array.isArray(value.roots)
    || value.roots.length !== 2 || value.roots[0] !== "build/**" || value.roots[1] !== ".gradle/**"
  ) return undefined
  return { allowedTracked, id: value.id, roots: ["build/**", ".gradle/**"] }
}

function parseArtifactParent(value: unknown): CompleteMutationSnapshot["artifactParent"] | undefined {
  if (!isRecord(value) || !hasAllowedKeys(value, ["equal", "post", "pre", "relativePath"])) return undefined
  const pre = parsePathIdentity(value.pre)
  const post = value.post === undefined ? undefined : parsePathIdentity(value.post)
  if (
    pre === undefined || (value.post !== undefined && post === undefined) || typeof value.equal !== "boolean"
    || typeof value.relativePath !== "string" || value.relativePath !== pre.relativePath
  ) return undefined
  return { equal: value.equal, ...(post === undefined ? {} : { post }), pre, relativePath: pre.relativePath }
}

function parseWorkspaceRoot(value: unknown): CompleteMutationSnapshot["workspaceRoot"] | undefined {
  if (!isRecord(value) || !hasAllowedKeys(value, ["equal", "post", "pre"])) return undefined
  const pre = parsePathIdentity(value.pre)
  const post = value.post === undefined ? undefined : parsePathIdentity(value.post)
  if (
    pre === undefined || pre.relativePath !== "." || typeof value.equal !== "boolean"
    || (value.post !== undefined && (post === undefined || post.relativePath !== "."))
  ) return undefined
  return { equal: value.equal, ...(post === undefined ? {} : { post }), pre }
}

function parseSourceIdentityBinding(value: unknown): CompleteMutationSnapshot["sourceIdentity"] | undefined {
  if (!isRecord(value) || !hasAllowedKeys(value, ["equal", "post", "pre"])) return undefined
  const pre = parseSourceIdentity(value.pre)
  const post = value.post === undefined ? undefined : parseSourceIdentity(value.post)
  if (pre === undefined || (value.post !== undefined && post === undefined) || typeof value.equal !== "boolean") {
    return undefined
  }
  return { equal: value.equal, ...(post === undefined ? {} : { post }), pre }
}

function parseGit(value: unknown): CompleteMutationSnapshot["git"] | undefined {
  if (!isRecord(value) || !hasAllowedKeys(value, ["available", "diagnosticCode", "headEqual", "postHead", "preHead"])) {
    return undefined
  }
  if (
    typeof value.available !== "boolean" || typeof value.diagnosticCode !== "string"
    || !SAFE_DIAGNOSTIC_CODE.test(value.diagnosticCode) || typeof value.headEqual !== "boolean"
    || (value.preHead !== undefined && !isCommitId(value.preHead))
    || (value.postHead !== undefined && !isCommitId(value.postHead))
  ) return undefined
  return {
    available: value.available,
    diagnosticCode: value.diagnosticCode,
    headEqual: value.headEqual,
    ...(value.postHead === undefined ? {} : { postHead: value.postHead.toLowerCase() }),
    ...(value.preHead === undefined ? {} : { preHead: value.preHead.toLowerCase() }),
  }
}

function parsePathIdentity(value: unknown): PersistedPathIdentity | undefined {
  if (!isRecord(value) || !hasExactKeys(value, ["deviceIdentity", "identityDigest", "relativePath"])) return undefined
  if (
    typeof value.deviceIdentity !== "string" || !/^\d+:\d+$/u.test(value.deviceIdentity)
    || !isDigest(value.identityDigest) || typeof value.relativePath !== "string"
    || !isSafeMutationSnapshotReference(value.relativePath)
  ) return undefined
  return {
    deviceIdentity: value.deviceIdentity,
    identityDigest: value.identityDigest,
    relativePath: value.relativePath,
  }
}

function parseStatusSummary(value: unknown): CompleteMutationSnapshot["pre"] | undefined {
  if (!isRecord(value) || !hasExactKeys(value, ["entryCount", "normalizedPorcelainNameStatusNulSha256"])) return undefined
  if (!isNonNegativeInteger(value.entryCount) || typeof value.normalizedPorcelainNameStatusNulSha256 !== "string") {
    return undefined
  }
  if (!/^[a-f0-9]{64}$/u.test(value.normalizedPorcelainNameStatusNulSha256)) return undefined
  return {
    entryCount: value.entryCount,
    normalizedPorcelainNameStatusNulSha256: value.normalizedPorcelainNameStatusNulSha256,
  }
}

function parseDigestSummary(value: unknown): MutationDigest | undefined {
  if (!isRecord(value) || !hasExactKeys(value, ["count", "digest"])) return undefined
  if (!isNonNegativeInteger(value.count) || !isDigest(value.digest)) return undefined
  return { count: value.count, digest: value.digest }
}

function isDecision(value: unknown): value is CompleteMutationSnapshot["decision"] {
  return value === "allowed" || value === "partial" || value === "report-only" || value === "snapshot-unavailable"
}

function hasExactKeys(value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => key in value)
}

function hasAllowedKeys(value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key))
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && DIGEST_PATTERN.test(value)
}

function isCommitId(value: unknown): value is string {
  return typeof value === "string" && GIT_COMMIT_PATTERN.test(value)
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
}
