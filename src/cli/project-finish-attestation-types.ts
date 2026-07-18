import type { SourceIdentity } from "./source-identity-types.js"

export const PROJECT_FINISH_ATTESTATION_SCHEMA = "project-finish-attestation.1" as const
export const PROJECT_FINISH_ATTESTATION_PREDICATE_TYPE =
  "https://github.com/jyt6640/persona-harness/attestations/project-finish-attestation.1" as const
export const PROJECT_FINISH_ATTESTATION_MAX_FRESHNESS_MS = 2 * 60 * 60 * 1000

export const PROJECT_FINISH_ATTESTATION_POLICY = {
  catalogId: "persona-harness-project-gradle.1",
  event: "push",
  policyMarker: "project-finish-attestation-v1-public-push-main",
  producerRepository: "jyt6640/persona-harness",
  projectScope: "repository-root-gradle-project",
  ref: "refs/heads/main",
  subjectName: "project-finish-attestation-receipt.json",
  workflowPath: ".github/workflows/persona-harness-project-finish.yml",
} as const

export const PROJECT_FINISH_ATTESTATION_COMMAND_CATALOG = [
  {
    argv: ["./gradlew", "--no-daemon", "--no-build-cache", "cleanTest", "test", "--console=plain"],
    id: "test",
  },
  {
    argv: ["./gradlew", "--no-daemon", "--no-build-cache", "build", "--console=plain"],
    id: "build",
  },
] as const

export type ProjectFinishAttestationCommand = {
  readonly argv: readonly string[]
  readonly id: "test" | "build"
}

export type ProjectFinishAttestationReceipt = {
  readonly build: {
    readonly artifactDigest: string
    readonly commandId: "build"
    readonly outcome: "passed"
  }
  readonly event: typeof PROJECT_FINISH_ATTESTATION_POLICY.event
  readonly gradle: {
    readonly catalog: readonly ProjectFinishAttestationCommand[]
    readonly catalogDigest: string
    readonly catalogId: typeof PROJECT_FINISH_ATTESTATION_POLICY.catalogId
    readonly console: "plain"
    readonly noBuildCache: true
    readonly noDaemon: true
    readonly wrapperPath: "./gradlew"
  }
  readonly lifecycle: {
    readonly attemptId: string
    readonly expiresAt: string
    readonly finishId: string
    readonly issuedAt: string
    readonly nonce: string
    readonly runAttempt: number
    readonly runId: string
    readonly sessionId: string
  }
  readonly phVersion: string
  readonly policyMarker: typeof PROJECT_FINISH_ATTESTATION_POLICY.policyMarker
  readonly project: {
    readonly root: "."
    readonly scope: typeof PROJECT_FINISH_ATTESTATION_POLICY.projectScope
  }
  readonly ref: typeof PROJECT_FINISH_ATTESTATION_POLICY.ref
  readonly repository: {
    readonly id: number
    readonly slug: string
    readonly visibility: "public"
  }
  readonly schemaVersion: typeof PROJECT_FINISH_ATTESTATION_SCHEMA
  readonly source: {
    readonly head: string
    readonly identity: SourceIdentity
    readonly root: "."
  }
  readonly test: {
    readonly commandId: "test"
    readonly count: number
    readonly failed: 0
    readonly junitDigest: string
    readonly passed: number
    readonly skipped: number
  }
  readonly workflow: {
    readonly caller: {
      readonly ref: string
      readonly sha: string
    }
    readonly certificateSan: string
    readonly reusable: {
      readonly path: typeof PROJECT_FINISH_ATTESTATION_POLICY.workflowPath
      readonly ref: string
      readonly sha: string
    }
    readonly runAttempt: number
    readonly runId: string
  }
}

export type ProjectFinishAttestationStatement = {
  readonly _type: "https://in-toto.io/Statement/v1"
  readonly predicate: {
    readonly policyMarker: typeof PROJECT_FINISH_ATTESTATION_POLICY.policyMarker
    readonly receipt: ProjectFinishAttestationReceipt
    readonly receiptDigest: string
    readonly schemaVersion: typeof PROJECT_FINISH_ATTESTATION_SCHEMA
  }
  readonly predicateType: typeof PROJECT_FINISH_ATTESTATION_PREDICATE_TYPE
  readonly subject: readonly [{
    readonly digest: { readonly sha256: string }
    readonly name: typeof PROJECT_FINISH_ATTESTATION_POLICY.subjectName
  }]
}

export type ProjectFinishAttestationDiagnostic = {
  readonly code: "binding-mismatch" | "invalid-field" | "signature-unverified" | "wrong-policy"
  readonly path: string
}

export type ProjectFinishAttestationParseResult =
  | { readonly diagnostics: readonly ProjectFinishAttestationDiagnostic[]; readonly ok: false }
  | { readonly ok: true; readonly value: ProjectFinishAttestationStatement }

export type ProjectFinishAttestationAssessment = {
  readonly authorityEligible: false
  readonly decision: "blocked"
  readonly diagnostics: readonly ProjectFinishAttestationDiagnostic[]
  readonly receipt?: ProjectFinishAttestationReceipt
  readonly state: "binding-mismatch" | "malformed" | "signature-unverified" | "wrong-policy"
}
