import type { ProjectFinishAttestationEnrolledPolicy } from "./project-finish-attestation-verifier.js"

const AUTHORITY_AUDIT_SCHEMA = "consumer-authority-audit.1" as const
const AUTHORITY_ENROLLMENT_SCHEMA = "consumer-authority-enrollment.1" as const
export const AUTHORITY_STORE_SCHEMA = "consumer-authority-store.1" as const
export const MAX_AUTHORITY_AUDIT_RECORDS = 512

export type AuthorityEnrollment = ProjectFinishAttestationEnrolledPolicy & {
  readonly enrolledAt: string
  readonly event: "push"
  readonly policyMarker: "user-scoped-enrollment-v1"
  readonly protectionPolicy: "branch-protection-not-proven"
  readonly ref: "refs/heads/main"
  readonly schemaVersion: typeof AUTHORITY_ENROLLMENT_SCHEMA
}

export type AuthorityEnrollmentReadback = {
  readonly callerWorkflowPath: string
  readonly repositoryId: number
  readonly repositorySlug: string
  readonly reusableWorkflowSha: string
}

export type AuthorityAuditRecord = {
  readonly action: "enrolled" | "updated"
  readonly callerWorkflowPath: string
  readonly event: AuthorityEnrollment["event"]
  readonly occurredAt: string
  readonly protectionPolicy: AuthorityEnrollment["protectionPolicy"]
  readonly ref: AuthorityEnrollment["ref"]
  readonly repositoryId: number
  readonly repositorySlug: string
  readonly reusableWorkflowSha: string
  readonly schemaVersion: typeof AUTHORITY_AUDIT_SCHEMA
}

export type AuthorityStore = {
  readonly audit: readonly AuthorityAuditRecord[]
  readonly entries: readonly AuthorityEnrollment[]
  readonly schemaVersion: typeof AUTHORITY_STORE_SCHEMA
}

export function authorityEnrollmentFromReadback(
  readback: AuthorityEnrollmentReadback,
  now = new Date(),
): AuthorityEnrollment | undefined {
  const callerWorkflowPath = normalizeCallerWorkflowPath(readback.callerWorkflowPath)
  if (
    callerWorkflowPath === undefined
    || !isPositiveInteger(readback.repositoryId)
    || !isPublicRepositorySlug(readback.repositorySlug)
    || !isCommit(readback.reusableWorkflowSha)
    || !Number.isFinite(now.getTime())
  ) {
    return undefined
  }
  return {
    callerWorkflowPath,
    enrolledAt: now.toISOString(),
    event: "push",
    policyMarker: "user-scoped-enrollment-v1",
    protectionPolicy: "branch-protection-not-proven",
    ref: "refs/heads/main",
    repositoryId: readback.repositoryId,
    repositorySlug: readback.repositorySlug,
    reusableWorkflowSha: readback.reusableWorkflowSha.toLowerCase(),
    schemaVersion: AUTHORITY_ENROLLMENT_SCHEMA,
  }
}

export function authorityAuditRecord(
  enrollment: AuthorityEnrollment,
  action: AuthorityAuditRecord["action"],
): AuthorityAuditRecord {
  return {
    action,
    callerWorkflowPath: enrollment.callerWorkflowPath,
    event: enrollment.event,
    occurredAt: enrollment.enrolledAt,
    protectionPolicy: enrollment.protectionPolicy,
    ref: enrollment.ref,
    repositoryId: enrollment.repositoryId,
    repositorySlug: enrollment.repositorySlug,
    reusableWorkflowSha: enrollment.reusableWorkflowSha,
    schemaVersion: AUTHORITY_AUDIT_SCHEMA,
  }
}

export function parseAuthorityStore(value: unknown): AuthorityStore | undefined {
  if (
    !isRecord(value)
    || !exactKeys(value, ["audit", "entries", "schemaVersion"])
    || value.schemaVersion !== AUTHORITY_STORE_SCHEMA
    || !Array.isArray(value.audit)
    || !Array.isArray(value.entries)
    || value.audit.length > MAX_AUTHORITY_AUDIT_RECORDS
    || value.entries.length > 128
  ) {
    return undefined
  }
  const audit: AuthorityAuditRecord[] = []
  for (const candidate of value.audit) {
    const record = parseAuthorityAuditRecord(candidate)
    if (record === undefined) return undefined
    audit.push(record)
  }
  const entries: AuthorityEnrollment[] = []
  for (const candidate of value.entries) {
    const enrollment = parseAuthorityEnrollment(candidate)
    if (enrollment === undefined) return undefined
    entries.push(enrollment)
  }
  const ids = new Set(entries.map((entry) => entry.repositoryId))
  return ids.size === entries.length
    ? { audit, entries, schemaVersion: AUTHORITY_STORE_SCHEMA }
    : undefined
}

export function isAuthorityEnrollment(value: unknown): value is AuthorityEnrollment {
  return isRecord(value)
    && normalizeCallerWorkflowPath(value.callerWorkflowPath) === value.callerWorkflowPath
    && isTimestamp(value.enrolledAt)
    && value.event === "push"
    && value.policyMarker === "user-scoped-enrollment-v1"
    && value.protectionPolicy === "branch-protection-not-proven"
    && value.ref === "refs/heads/main"
    && isPositiveInteger(value.repositoryId)
    && isPublicRepositorySlug(value.repositorySlug)
    && isCommit(value.reusableWorkflowSha)
    && value.schemaVersion === AUTHORITY_ENROLLMENT_SCHEMA
}

function parseAuthorityEnrollment(value: unknown): AuthorityEnrollment | undefined {
  if (!isRecord(value) || !exactKeys(value, [
    "callerWorkflowPath",
    "enrolledAt",
    "event",
    "policyMarker",
    "protectionPolicy",
    "ref",
    "repositoryId",
    "repositorySlug",
    "reusableWorkflowSha",
    "schemaVersion",
  ])) {
    return undefined
  }
  return isAuthorityEnrollment(value) ? value : undefined
}

function parseAuthorityAuditRecord(value: unknown): AuthorityAuditRecord | undefined {
  if (!isRecord(value) || !exactKeys(value, [
    "action",
    "callerWorkflowPath",
    "event",
    "occurredAt",
    "protectionPolicy",
    "ref",
    "repositoryId",
    "repositorySlug",
    "reusableWorkflowSha",
    "schemaVersion",
  ])) {
    return undefined
  }
  const callerWorkflowPath = normalizeCallerWorkflowPath(value.callerWorkflowPath)
  return (value.action === "enrolled" || value.action === "updated")
    && callerWorkflowPath !== undefined
    && callerWorkflowPath === value.callerWorkflowPath
    && value.event === "push"
    && isTimestamp(value.occurredAt)
    && value.protectionPolicy === "branch-protection-not-proven"
    && value.ref === "refs/heads/main"
    && isPositiveInteger(value.repositoryId)
    && isPublicRepositorySlug(value.repositorySlug)
    && isCommit(value.reusableWorkflowSha)
    && value.schemaVersion === AUTHORITY_AUDIT_SCHEMA
    ? {
        action: value.action,
        callerWorkflowPath,
        event: value.event,
        occurredAt: value.occurredAt,
        protectionPolicy: value.protectionPolicy,
        ref: value.ref,
        repositoryId: value.repositoryId,
        repositorySlug: value.repositorySlug,
        reusableWorkflowSha: value.reusableWorkflowSha,
        schemaVersion: value.schemaVersion,
      }
    : undefined
}

function normalizeCallerWorkflowPath(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const prefix = ".github/workflows/"
  const path = value.startsWith(prefix) ? value.slice(prefix.length) : value
  if (
    path.length === 0
    || path.length > 256
    || path.includes("\\")
    || !path.endsWith(".yml")
    || path.split("/").some((part) => part === "" || part === "." || part === "..")
  ) {
    return undefined
  }
  return path
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort()
  return actual.length === keys.length && actual.every((key, index) => key === keys[index])
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
}

function isPublicRepositorySlug(value: unknown): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= 256
    && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(value)
    && !value.split("/").some((part) => part === "." || part === "..")
}

function isCommit(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{40}$/u.test(value)
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value))
}
