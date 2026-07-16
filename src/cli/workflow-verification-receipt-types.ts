import type { VerificationDecision } from "./workflow-verification-decision.js"
import type { SourceIdentity } from "./source-identity.js"

export const VERIFICATION_RECEIPT_SCHEMA = "verification-receipt.1" as const
export const VERIFICATION_ATTEMPT_SCHEMA = "verification-attempt.1" as const

export const VERIFICATION_AUTHORITY_CLASSES = ["local-fresh-cooperative", "external-attested"] as const
export const VERIFICATION_ATTEMPT_STATUSES = [
  "started",
  "completed",
  "failed",
  "interrupted",
  "stale",
  "expired",
  "replayed",
] as const

export type ReceiptDiagnosticCode =
  | "invalid-json"
  | "invalid-shape"
  | "missing-field"
  | "unknown-field"
  | "invalid-field"
  | "unsupported-schema"
  | "authority-issuer-mismatch"
  | "invalid-lifecycle"
  | "binding-mismatch"
  | "duplicate-receipt-id"
  | "duplicate-attempt-id"
  | "replayed-receipt"
  | "attempt-not-completed"
  | "receipt-expired"
  | "receipt-clock-skew"
  | "legacy-evidence-only"
  | "receipt-directory-invalid"
  | "receipt-entry-invalid"
  | "receipt-read-failed"

export type ReceiptDiagnostic = {
  readonly code: ReceiptDiagnosticCode
  readonly message: string
  readonly path: string
}

export type ReceiptParseResult<T> =
  | { readonly diagnostics: readonly []; readonly ok: true; readonly value: T }
  | { readonly diagnostics: readonly ReceiptDiagnostic[]; readonly ok: false }

export type VerificationDigest = string
export type VerificationAuthorityClass = (typeof VERIFICATION_AUTHORITY_CLASSES)[number]
export type VerificationAttemptStatus = (typeof VERIFICATION_ATTEMPT_STATUSES)[number]
export type VerificationIssuerKind = "persona-harness" | "external-attestor"
export type VerificationIssuerState = "cooperative-unverified" | "external-attested-unverified"
export type VerificationResultStatus = "pass" | "fail"
export type VerificationPlatform = "darwin" | "linux" | "win32" | "unknown"

export type VerificationWorkspaceIdentity = {
  readonly deviceIdentity: string
  readonly platform: VerificationPlatform
  readonly rootDigest: VerificationDigest
}

export type VerificationCommandIdentity = {
  readonly argvDigest: VerificationDigest
  readonly catalogId: string
}

export type VerificationIssuer = {
  readonly id: string
  readonly kind: VerificationIssuerKind
}

export type VerificationResult = {
  readonly artifactDigests: readonly VerificationDigest[]
  readonly status: VerificationResultStatus
  readonly testCount: number
}

export type VerificationReceipt = {
  readonly attemptId: string
  readonly authorityClass: VerificationAuthorityClass
  readonly command: VerificationCommandIdentity
  readonly dirtyWorktreeDigest: VerificationDigest
  readonly expiresAt: string
  readonly finishId: string
  readonly issuedAt: string
  readonly issuer: VerificationIssuer
  readonly issuerVerificationState: VerificationIssuerState
  readonly phVersion: string
  readonly provenanceDigest: VerificationDigest
  readonly receiptId: string
  readonly result: VerificationResult
  readonly schemaVersion: typeof VERIFICATION_RECEIPT_SCHEMA
  readonly sessionId: string
  readonly sourceHead: string
  readonly sourceIdentity: SourceIdentity
  readonly workspaceIdentity: VerificationWorkspaceIdentity
}

export type VerificationAttempt = {
  readonly attemptId: string
  readonly command: VerificationCommandIdentity
  readonly completedAt: string | null
  readonly dirtyWorktreeDigest: VerificationDigest
  readonly finishId: string
  readonly phVersion: string
  readonly provenanceDigest: VerificationDigest
  readonly receiptId: string | null
  readonly schemaVersion: typeof VERIFICATION_ATTEMPT_SCHEMA
  readonly sessionId: string
  readonly sourceHead: string
  readonly sourceIdentity: SourceIdentity
  readonly startedAt: string
  readonly status: VerificationAttemptStatus
  readonly workspaceIdentity: VerificationWorkspaceIdentity
}

export const RECEIPT_KEYS = [
  "schemaVersion",
  "receiptId",
  "authorityClass",
  "issuer",
  "issuerVerificationState",
  "attemptId",
  "sessionId",
  "finishId",
  "sourceHead",
  "sourceIdentity",
  "dirtyWorktreeDigest",
  "workspaceIdentity",
  "command",
  "phVersion",
  "result",
  "issuedAt",
  "expiresAt",
  "provenanceDigest",
] as const

export const ATTEMPT_KEYS = [
  "schemaVersion",
  "attemptId",
  "sessionId",
  "finishId",
  "sourceHead",
  "sourceIdentity",
  "dirtyWorktreeDigest",
  "workspaceIdentity",
  "command",
  "phVersion",
  "status",
  "startedAt",
  "completedAt",
  "receiptId",
  "provenanceDigest",
] as const

export const ISSUER_KEYS = ["kind", "id"] as const
export const WORKSPACE_KEYS = ["rootDigest", "deviceIdentity", "platform"] as const
export const COMMAND_KEYS = ["catalogId", "argvDigest"] as const
export const RESULT_KEYS = ["status", "testCount", "artifactDigests"] as const

export const VERIFICATION_RECEIPT_DIR = ".persona/evidence/verification-receipts"
export const VERIFICATION_ATTEMPT_DIR = ".persona/evidence/verification-attempts"

export type VerificationAuthorityState =
  | "duplicate"
  | "expired"
  | "failed"
  | "interrupted"
  | "malformed"
  | "mismatch"
  | "missing"
  | "replayed"
  | "stale"
  | "untrusted"

export type LegacyEvidenceSummary = {
  readonly diagnosticOnly: true
  readonly diagnostics?: readonly ReceiptDiagnostic[]
  readonly files: readonly string[]
}

export type VerificationAuthorityAssessment = {
  readonly attempt?: VerificationAttempt
  readonly authorityEligible: false
  readonly decision: VerificationDecision
  readonly diagnostics: readonly ReceiptDiagnostic[]
  readonly legacyEvidence: LegacyEvidenceSummary
  readonly receipt?: VerificationReceipt
  readonly state: VerificationAuthorityState
  readonly summary: string
}
