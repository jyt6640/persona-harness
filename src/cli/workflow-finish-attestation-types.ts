import type { SourceIdentity } from "./source-identity-types.js"

export const FINISH_ATTESTATION_SCHEMA = "finish-attestation.1" as const
export const FINISH_ATTESTATION_PREDICATE_TYPE = "https://github.com/jyt6640/persona-harness/attestations/finish-attestation.1" as const
export const FINISH_ATTESTATION_BUNDLE_PATH = ".persona/evidence/finish-attestation/bundle.json" as const
export const FINISH_ATTESTATION_CONSUMPTION_PATH = ".persona/evidence/finish-attestation/consumption.json" as const
export const FINISH_ATTESTATION_WORKFLOW_PATH = ".github/workflows/canonical-clean-ci-attestation-builder.yml" as const
export const FINISH_ATTESTATION_WORKFLOW_REF = "jyt6640/persona-harness/.github/workflows/canonical-clean-ci-attestation-builder.yml@refs/heads/main" as const
export const FINISH_ATTESTATION_COMMAND_CATALOG = [
  { id: "scope", executable: "npm", args: ["run", "check:scope:strict"] },
  { id: "docs", executable: "npm", args: ["run", "check:docs"] },
  { id: "release-workflow", executable: "npm", args: ["run", "check:release-workflows"] },
  { id: "injection", executable: "npm", args: ["run", "check:injection-value"] },
  { id: "typecheck", executable: "npm", args: ["run", "typecheck"] },
  { id: "tests", executable: "node", args: ["node_modules/vitest/vitest.mjs", "run", "--reporter=json", "--outputFile=.ci/canonical-clean-ci-attestation-builder/test-results.json", "--testTimeout=15000"] },
  { id: "build", executable: "npm", args: ["run", "build"] },
  { id: "pack", executable: "npm", args: ["pack", "--dry-run", "--json"] },
] as const

export const FINISH_ATTESTATION_POLICY = Object.freeze({
  certificateIdentityURI: "https://github.com/jyt6640/persona-harness/.github/workflows/canonical-clean-ci-attestation-builder.yml@refs/heads/main",
  certificateIssuer: "https://token.actions.githubusercontent.com",
  event: "push",
  predicateType: FINISH_ATTESTATION_PREDICATE_TYPE,
  ref: "refs/heads/main",
  repository: "jyt6640/persona-harness",
  repositoryId: 1272008570,
  runnerEnvironment: "github-hosted",
  runnerLabel: "ubuntu-latest",
  runnerOs: "Linux",
  workflowPath: FINISH_ATTESTATION_WORKFLOW_PATH,
  workflowRef: FINISH_ATTESTATION_WORKFLOW_REF,
  maxFreshnessMs: 2 * 60 * 60 * 1000,
  tlogThreshold: 1,
  ctLogThreshold: 1,
} as const)

export type FinishAttestationPolicy = typeof FINISH_ATTESTATION_POLICY

export type FinishAttestationCommand = {
  readonly args: readonly string[]
  readonly executable: string
  readonly id: string
}

export type FinishAttestationCommandResult = {
  readonly argv: readonly string[]
  readonly exitCode: number
  readonly id: string
  readonly stderrDigest: string
  readonly stdoutDigest: string
}

export type FinishAttestationReceipt = {
  readonly authorityBoundary: "external-attested"
  readonly authorityEligible: true
  readonly command: {
    readonly argvDigest: string
    readonly catalogId: string
    readonly commands: readonly FinishAttestationCommand[]
    readonly results: readonly FinishAttestationCommandResult[]
  }
  readonly event: "push"
  readonly expiresAt: string
  readonly finishId: string
  readonly issuedAt: string
  readonly nonce: string
  readonly phVersion: string
  readonly predicateType: typeof FINISH_ATTESTATION_PREDICATE_TYPE
  readonly pack: {
    readonly fileCount: number
    readonly name: string
    readonly version: string
  }
  readonly ref: "refs/heads/main"
  readonly repository: "jyt6640/persona-harness"
  readonly repositoryId: 1272008570
  readonly replayState: "unconsumed"
  readonly runAttempt: number
  readonly runId: string
  readonly attemptId: string
  readonly schemaVersion: typeof FINISH_ATTESTATION_SCHEMA
  readonly sessionId: string
  readonly source: {
    readonly clean: true
    readonly dirtyWorktreeDigest: string
    readonly head: string
    readonly identity: SourceIdentity
  }
  readonly test: {
    readonly artifactDigest: string
    readonly count: number
    readonly failed: number
    readonly identity: string
    readonly passed: number
    readonly skipped: number
  }
  readonly workflow: {
    readonly path: typeof FINISH_ATTESTATION_WORKFLOW_PATH
    readonly ref: typeof FINISH_ATTESTATION_WORKFLOW_REF
    readonly sha: string
  }
  readonly runner: {
    readonly environment: "github-hosted"
    readonly label: "ubuntu-latest"
    readonly os: "Linux"
  }
}

export type FinishAttestationPredicate = {
  readonly authorityBoundary: "external-attested"
  readonly authorityEligible: true
  readonly predicateType: typeof FINISH_ATTESTATION_PREDICATE_TYPE
  readonly receipt: FinishAttestationReceipt
  readonly receiptDigest: string
}

export type FinishAttestationStatement = {
  readonly _type: "https://in-toto.io/Statement/v1"
  readonly predicate: FinishAttestationPredicate
  readonly predicateType: typeof FINISH_ATTESTATION_PREDICATE_TYPE
  readonly subject: readonly [{
    readonly digest: { readonly sha256: string }
    readonly name: "receipt.json"
  }]
}

export type FinishAttestationDiagnosticCode =
  | "binding-mismatch"
  | "crypto-failed"
  | "freshness-invalid"
  | "invalid-field"
  | "invalid-json"
  | "malformed"
  | "missing"
  | "replayed-attestation"
  | "source-drift"
  | "stale"
  | "wrong-policy"

export type FinishAttestationDiagnostic = {
  readonly code: FinishAttestationDiagnosticCode
  readonly message: string
  readonly path: string
}

export type FinishAttestationParseResult =
  | { readonly diagnostics: readonly []; readonly ok: true; readonly value: FinishAttestationStatement }
  | { readonly diagnostics: readonly FinishAttestationDiagnostic[]; readonly ok: false }

export type FinishAttestationState =
  | "binding-mismatch"
  | "crypto-failed"
  | "freshness-invalid"
  | "malformed"
  | "missing"
  | "replayed"
  | "source-drift"
  | "stale"
  | "trusted"
  | "wrong-policy"

export type FinishAttestationAssessment = {
  readonly authorityEligible: boolean
  readonly decision: "blocked" | "trusted"
  readonly diagnostics: readonly FinishAttestationDiagnostic[]
  readonly receipt?: FinishAttestationReceipt
  readonly state: FinishAttestationState
  readonly summary: string
}
