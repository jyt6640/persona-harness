import { createHash } from "node:crypto"

import { isRecord } from "../config/jsonc.js"
import { redactEvidenceText } from "../runtime/evidence-redaction.js"
import type {
  EvidenceParentIdentity,
  GitIdentity,
  PosixPathIdentity,
} from "./ci-reverification-identity.js"
import type {
  GitStatusSnapshot,
  MutationClassification,
} from "./ci-reverification-mutation.js"
import {
  sameSourceIdentity,
  type SourceIdentity,
} from "./source-identity.js"

export const MUTATION_SNAPSHOT_SCHEMA = "mutationSnapshot.2" as const

const SAFE_DIAGNOSTIC_CODE = /^[a-z][a-z0-9-]{0,95}$/u
const SAFE_RELATIVE_PATH = /^[A-Za-z0-9._@+/-]{1,240}$/u
const UNAVAILABLE_REFERENCE = "[UNAVAILABLE]" as const

export type MutationDigest = {
  readonly count: number
  readonly digest: string
}

export type PersistedPathIdentity = {
  readonly deviceIdentity: string
  readonly identityDigest: string
  readonly relativePath: string
}

export type CompleteMutationSnapshot = {
  readonly allowlist: {
    readonly allowedTracked: MutationDigest
    readonly id: "java-spring-gradle-wrapper.1"
    readonly roots: readonly ["build/**", ".gradle/**"]
  }
  readonly artifactParent: {
    readonly equal: boolean
    readonly post?: PersistedPathIdentity
    readonly pre: PersistedPathIdentity
    readonly relativePath: string
  }
  readonly decision: "allowed" | "partial" | "report-only" | "snapshot-unavailable"
  readonly disallowedTracked: MutationDigest
  readonly git: {
    readonly available: boolean
    readonly diagnosticCode: string
    readonly headEqual: boolean
    readonly postHead?: string
    readonly preHead?: string
  }
  readonly kind: "complete"
  readonly observed: MutationDigest
  readonly post: {
    readonly entryCount: number
    readonly normalizedPorcelainNameStatusNulSha256: string
  }
  readonly pre: {
    readonly entryCount: number
    readonly normalizedPorcelainNameStatusNulSha256: string
  }
  readonly schemaVersion: typeof MUTATION_SNAPSHOT_SCHEMA
  readonly sourceIdentity: {
    readonly equal: boolean
    readonly post?: SourceIdentity
    readonly pre: SourceIdentity
  }
  readonly untracked: MutationDigest
  readonly workspaceRoot: {
    readonly equal: boolean
    readonly post?: PersistedPathIdentity
    readonly pre: PersistedPathIdentity
  }
}

export type OverflowMutationSnapshot = {
  readonly kind: "overflow"
  readonly overflowSummary: {
    readonly byteCount: number
    readonly entryCount: number
    readonly entryDigest: string
  }
  readonly schemaVersion: typeof MUTATION_SNAPSHOT_SCHEMA
}

export type MutationSnapshot = CompleteMutationSnapshot | OverflowMutationSnapshot

export type MutationSnapshotInput = {
  readonly classified: MutationClassification
  readonly postGit: GitIdentity
  readonly postParent: EvidenceParentIdentity | undefined
  readonly postRoot: PosixPathIdentity | undefined
  readonly postSourceIdentity: SourceIdentity | undefined
  readonly postStatus: GitStatusSnapshot
  readonly preGit: GitIdentity
  readonly preParent: EvidenceParentIdentity
  readonly preRoot: PosixPathIdentity
  readonly preSourceIdentity: SourceIdentity
  readonly preStatus: GitStatusSnapshot
}

export function createMutationSnapshot(input: MutationSnapshotInput): MutationSnapshot {
  const { classified } = input
  return {
    allowlist: {
      allowedTracked: digestSummary(classified.allowedTracked),
      id: "java-spring-gradle-wrapper.1",
      roots: ["build/**", ".gradle/**"],
    },
    artifactParent: {
      equal: input.postParent !== undefined && sameIdentity(input.preParent, input.postParent),
      ...(input.postParent === undefined ? {} : { post: persistedPathIdentity(input.postParent, input.postParent.relativePath) }),
      pre: persistedPathIdentity(input.preParent, input.preParent.relativePath),
      relativePath: safeRelativeReference(input.preParent.relativePath),
    },
    decision: input.preGit.available ? classified.decision : "snapshot-unavailable",
    disallowedTracked: digestSummary(classified.disallowedTracked),
    git: {
      available: input.preGit.available && input.postGit.available,
      diagnosticCode: safeDiagnosticCode(input.postGit.available ? input.preGit.diagnosticCode : input.postGit.diagnosticCode),
      headEqual: input.preGit.head !== undefined && input.preGit.head === input.postGit.head,
      ...(input.postGit.head === undefined ? {} : { postHead: input.postGit.head }),
      ...(input.preGit.head === undefined ? {} : { preHead: input.preGit.head }),
    },
    kind: "complete",
    observed: digestSummary(classified.observed),
    post: statusSummary(input.postStatus),
    pre: statusSummary(input.preStatus),
    schemaVersion: MUTATION_SNAPSHOT_SCHEMA,
    sourceIdentity: {
      equal: input.postSourceIdentity !== undefined && sameSourceIdentity(input.preSourceIdentity, input.postSourceIdentity),
      ...(input.postSourceIdentity === undefined ? {} : { post: input.postSourceIdentity }),
      pre: input.preSourceIdentity,
    },
    untracked: digestSummary(classified.untracked),
    workspaceRoot: {
      equal: input.postRoot !== undefined && sameIdentity(input.preRoot, input.postRoot),
      ...(input.postRoot === undefined ? {} : { post: persistedPathIdentity(input.postRoot, ".") }),
      pre: persistedPathIdentity(input.preRoot, "."),
    },
  }
}

export function createOverflowMutationSnapshot(source: string, entryCount: number): MutationSnapshot {
  return {
    kind: "overflow",
    overflowSummary: {
      byteCount: Buffer.byteLength(source),
      entryCount,
      entryDigest: digest(source),
    },
    schemaVersion: MUTATION_SNAPSHOT_SCHEMA,
  }
}

export function verificationWorkspaceBinding(identity: PosixPathIdentity): {
  readonly deviceIdentity: string
  readonly rootDigest: string
} {
  const persisted = persistedPathIdentity(identity, ".")
  return {
    deviceIdentity: persisted.deviceIdentity,
    rootDigest: persisted.identityDigest,
  }
}

function persistedPathIdentity(identity: PosixPathIdentity, relativePath: string): PersistedPathIdentity {
  return {
    deviceIdentity: `${identity.dev}:${identity.ino}`,
    identityDigest: digest({ device: identity.dev, inode: identity.ino, realpath: identity.realpath }),
    relativePath: safeRelativeReference(relativePath),
  }
}

function statusSummary(status: GitStatusSnapshot): CompleteMutationSnapshot["pre"] {
  return {
    entryCount: status.entryCount,
    normalizedPorcelainNameStatusNulSha256: status.digest,
  }
}

function digestSummary(value: unknown): MutationDigest {
  return { count: collectionCount(value), digest: digest(value) }
}

function collectionCount(value: unknown): number {
  if (Array.isArray(value)) return value.length
  if (isRecord(value)) return Object.values(value).reduce<number>((count, nested) => count + collectionCount(nested), 0)
  return 0
}

function digest(value: unknown): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`
}

function safeRelativeReference(value: string): string {
  const normalized = value.replaceAll("\\", "/").replace(/^\.\//u, "")
  if (
    normalized === "."
    || (
      SAFE_RELATIVE_PATH.test(normalized)
      && !normalized.startsWith("/")
      && !normalized.startsWith("../")
      && !normalized.includes("/../")
      && redactEvidenceText(normalized).text === normalized
    )
  ) {
    return normalized
  }
  return UNAVAILABLE_REFERENCE
}

export function isSafeMutationSnapshotReference(value: string): boolean {
  return value === UNAVAILABLE_REFERENCE || safeRelativeReference(value) === value
}

function safeDiagnosticCode(value: string): string {
  return SAFE_DIAGNOSTIC_CODE.test(value) ? value : "identity-unavailable"
}

function sameIdentity(left: PosixPathIdentity, right: PosixPathIdentity): boolean {
  return left.dev === right.dev && left.ino === right.ino && left.realpath === right.realpath
}
