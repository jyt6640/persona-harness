export const FINISH_ATTESTATION_SCHEMA = "finish-attestation.1" as const
export const FINISH_ATTESTATION_PREDICATE_TYPE =
  "https://github.com/jyt6640/persona-harness/attestations/finish-attestation.1" as const

export type FinishAttestation = {
  readonly schemaVersion: typeof FINISH_ATTESTATION_SCHEMA
  readonly sourceMode: "clean-ci"
  readonly repository: string
  readonly ref: string
  readonly workflow: string
  readonly workflowRef: string
  readonly workflowSha: string
  readonly runId: string
  readonly runAttempt: number
  readonly sourceHead: string
  readonly dirtyWorktreeDigest: string
  readonly workspaceIdentity: {
    readonly kind: "github-hosted-runner"
    readonly runnerEnvironment: "github-hosted"
    readonly identity: string
  }
  readonly command: {
    readonly catalogId: string
    readonly argv: readonly string[]
    readonly argvDigest: string
  }
  readonly phVersion: string
  readonly attemptId: string
  readonly sessionId: string
  readonly finishId: string
  readonly artifactDigests: readonly { readonly name: string; readonly digest: string }[]
  readonly test: { readonly identity: string; readonly count: number; readonly passed: true }
  readonly result: { readonly status: "pass"; readonly testCount: number }
  readonly issuedAt: string
  readonly expiresAt: string
  readonly nonce: string
  readonly replayState: "unconsumed"
}

export type FinishAttestationDiagnostic = {
  readonly code: string
  readonly message: string
  readonly path: string
}

export type FinishAttestationParseResult =
  | { readonly ok: true; readonly value: FinishAttestation; readonly diagnostics: readonly [] }
  | { readonly ok: false; readonly diagnostics: readonly FinishAttestationDiagnostic[] }

export type ExternalFinishAttestationAssessment = {
  readonly status: "blocked" | "trusted"
  readonly authorityEligible: boolean
  readonly reason: string
  readonly diagnostics: readonly FinishAttestationDiagnostic[]
  readonly receipt?: FinishAttestation
}
