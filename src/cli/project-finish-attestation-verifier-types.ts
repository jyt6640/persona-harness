import type { ProjectFinishAttestationReceipt } from "./project-finish-attestation-types.js"

export const PROJECT_FINISH_ATTESTATION_EVIDENCE_DIRECTORY =
  ".persona/evidence/project-finish-attestation" as const
export const PROJECT_FINISH_ATTESTATION_EVIDENCE_FILES = [
  "bundle.json",
  "predicate.json",
  "receipt.json",
] as const
export const PROJECT_FINISH_ATTESTATION_MAX_BUNDLE_BYTES = 1024 * 1024
export const PROJECT_FINISH_ATTESTATION_MAX_JSON_BYTES = 512 * 1024

export type ProjectFinishAttestationEnrolledPolicy = {
  readonly callerWorkflowPath: string
  readonly repositoryId: number
  readonly repositorySlug: string
  readonly reusableWorkflowSha: string
}

export type ProjectFinishAttestationVerifierState =
  | "binding-mismatch"
  | "certificate-invalid"
  | "crypto-failed"
  | "dns-unavailable"
  | "malformed"
  | "malformed-bundle"
  | "missing"
  | "network-unavailable"
  | "replayed"
  | "runtime-unsupported"
  | "signature-invalid"
  | "source-drift"
  | "stale"
  | "transparency-invalid"
  | "trusted"
  | "trust-root-unavailable"
  | "verification-timeout"
  | "wrong-policy"

export type ProjectFinishAttestationVerifierDiagnostic = {
  readonly code: Exclude<ProjectFinishAttestationVerifierState, "trusted">
  readonly path: string
}

export type ProjectFinishAttestationVerifierAssessment = {
  readonly authorityEligible: boolean
  readonly consumptionState: "consumed" | "not-applicable" | "unconsumed"
  readonly decision: "blocked" | "trusted"
  readonly diagnostics: readonly ProjectFinishAttestationVerifierDiagnostic[]
  readonly receipt?: ProjectFinishAttestationReceipt
  readonly state: ProjectFinishAttestationVerifierState
  readonly summary: string
}

export type ProjectFinishAttestationWorkerResult =
  | {
      readonly bundleDigest: string
      readonly ok: true
      readonly statement: unknown
    }
  | {
      readonly ok: false
      readonly state: Exclude<ProjectFinishAttestationVerifierState, "binding-mismatch" | "missing" | "replayed" | "source-drift" | "stale" | "trusted" | "wrong-policy">
    }

export type ProjectFinishTrustReadinessWorkerResult =
  | {
      readonly ok: true
    }
  | {
      readonly ok: false
      readonly state:
        | "dns-unavailable"
        | "network-unavailable"
        | "runtime-unsupported"
        | "trust-root-unavailable"
        | "verification-timeout"
    }
