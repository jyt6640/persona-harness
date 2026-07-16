import type { SourceIdentity } from "./source-identity.js"
import type {
  VerificationCommandIdentity,
  VerificationDigest,
  VerificationWorkspaceIdentity,
} from "./workflow-verification-receipt-types.js"

export const SEMANTIC_TDD_TRANSITION_SCHEMA = "semantic-tdd-transition.1" as const
export const SEMANTIC_TDD_SOURCE_SNAPSHOT_SCHEMA = "semantic-tdd-source-snapshot.1" as const

export type SourceSnapshotEntry = {
  readonly anchor: "java-source" | "other"
  readonly classification?: "tracked" | "untracked"
  readonly contentDigest?: string
  readonly kind: "directory" | "file" | "missing-tracked"
  readonly mode: string
  readonly pathDigest: string
}

export type SourceSnapshot = {
  readonly entries: readonly SourceSnapshotEntry[]
  readonly entriesDigest: string
  readonly schemaVersion: typeof SEMANTIC_TDD_SOURCE_SNAPSHOT_SCHEMA
  readonly sourceIdentity: SourceIdentity
}

export type SemanticTddTransitionDiagnosticCode =
  | "semantic-transition-artifact-invalid"
  | "semantic-transition-binding-mismatch"
  | "semantic-transition-green-required"
  | "semantic-transition-red-required"
  | "semantic-transition-replayed"
  | "semantic-transition-testcase-mismatch"
  | "semantic-transition-time-invalid"
  | "source-delta-structural"
  | "source-delta-unrelated"
  | "source-snapshot-invalid"
  | "source-snapshot-stale"
  | "source-transition-required"

export type SemanticTddTransitionState =
  | "invalid"
  | "missing-green"
  | "missing-red"
  | "replayed"
  | "valid-untrusted"

export type SemanticTddTransitionPhase = {
  readonly artifactDigest: VerificationDigest
  readonly completedAt: string | null
  readonly dirtyWorktreeDigest: VerificationDigest
  readonly finishId: string
  readonly junitArtifactDigests: readonly VerificationDigest[]
  readonly phVersion: string
  readonly provenanceDigest: VerificationDigest
  readonly receiptId: string | null
  readonly sessionId: string
  readonly sourceHead: string
  readonly sourceIdentity: SourceIdentity
  readonly startedAt: string
  readonly testcaseId: string
  readonly attemptId: string
  readonly command: VerificationCommandIdentity
  readonly workspaceIdentity: VerificationWorkspaceIdentity
}

export type SemanticTddSourceSnapshot = {
  readonly attemptId: string
  readonly capturedAt: string
  readonly dirtyWorktreeDigest: VerificationDigest
  readonly entries: readonly SourceSnapshotEntry[]
  readonly entriesDigest: VerificationDigest
  readonly phase: "green" | "red"
  readonly schemaVersion: typeof SEMANTIC_TDD_SOURCE_SNAPSHOT_SCHEMA
  readonly sourceHead: string
  readonly sourceIdentity: SourceIdentity
  readonly workspaceIdentity: VerificationWorkspaceIdentity
}

export type SemanticTddSourceDelta = {
  readonly changedEntryCount: number
  readonly changedEntryDigest: VerificationDigest
  readonly unchangedEntryCount: number
  readonly unchangedEntryDigest: VerificationDigest
  readonly targetAnchorDigest: VerificationDigest
}

export type SemanticTddTransitionEnvelope = {
  readonly green: SemanticTddTransitionPhase
  readonly preGreenSnapshot: {
    readonly attemptId: string
    readonly capturedAt: string
    readonly entriesDigest: VerificationDigest
    readonly sourceIdentity: SourceIdentity
  }
  readonly provenanceDigest: VerificationDigest
  readonly red: SemanticTddTransitionPhase
  readonly schemaVersion: typeof SEMANTIC_TDD_TRANSITION_SCHEMA
  readonly sourceDelta: SemanticTddSourceDelta
}

export type SemanticTddTransitionAssessment = {
  readonly authorityEligible: false
  readonly decision: {
    readonly code: string
    readonly status: "diagnostic-only"
    readonly summary: string
  }
  readonly diagnosticCodes: readonly SemanticTddTransitionDiagnosticCode[]
  readonly envelope?: SemanticTddTransitionEnvelope
  readonly state: SemanticTddTransitionState
  readonly summary: string
}

export type SemanticTddSourceSnapshotCapture =
  | { readonly diagnosticCode: string; readonly status: "unavailable" }
  | {
      readonly status: "available"
      readonly value: {
        readonly snapshot: SourceSnapshot
        readonly sourceHead: string
        readonly dirtyWorktreeDigest: VerificationDigest
        readonly workspaceIdentity: VerificationWorkspaceIdentity
      }
    }
