import type { SourceIdentity } from "./source-identity-types.js"

export const FINISH_ATTESTATION_SCHEMA = "finish-attestation.1" as const
export const FINISH_ATTESTATION_TERMINAL_SCHEMA = "finish-attestation-terminal.1" as const
export const FINISH_ATTESTATION_PREDICATE_TYPE =
  "https://github.com/jyt6640/persona-harness/attestations/finish-attestation.1" as const
export const FINISH_ATTESTATION_BUNDLE_PATH = ".persona/evidence/finish-attestation/bundle.json" as const
export const FINISH_ATTESTATION_CONSUMPTION_PATH = ".persona/evidence/finish-attestation/consumption.json" as const
export const FINISH_ATTESTATION_MAX_FRESHNESS_MS = 2 * 60 * 60 * 1000

export const FINISH_ATTESTATION_COMMAND_CATALOG = [
  { id: "scope", executable: "npm", args: ["run", "check:scope:strict"] },
  { id: "docs", executable: "npm", args: ["run", "check:docs"] },
  { id: "release-workflow", executable: "npm", args: ["run", "check:release-workflows"] },
  { id: "injection", executable: "npm", args: ["run", "check:injection-value"] },
  { id: "typecheck", executable: "npm", args: ["run", "typecheck"] },
  {
    id: "tests",
    executable: "node",
    args: [
      "node_modules/vitest/vitest.mjs",
      "run",
      "--reporter=json",
      "--outputFile=.ci/canonical-clean-ci-attestation-builder/test-results.json",
      "--testTimeout=15000",
    ],
  },
  { id: "build", executable: "npm", args: ["run", "build"] },
  { id: "pack", executable: "npm", args: ["pack", "--dry-run", "--json"] },
] as const

export const FINISH_ATTESTATION_POLICY = {
  certificateIdentityURI:
    "https://github.com/jyt6640/persona-harness/.github/workflows/canonical-clean-ci-attestation-builder.yml@refs/heads/main",
  certificateIssuer: "https://token.actions.githubusercontent.com",
  event: "push",
  maxFreshnessMs: FINISH_ATTESTATION_MAX_FRESHNESS_MS,
  predicateType: FINISH_ATTESTATION_PREDICATE_TYPE,
  ref: "refs/heads/main",
  repository: "jyt6640/persona-harness",
  repositoryId: 1272008570,
  runnerEnvironment: "github-hosted",
  runnerLabel: "ubuntu-latest",
  runnerOs: "Linux",
  workflowPath: ".github/workflows/canonical-clean-ci-attestation-builder.yml",
  workflowRef:
    "jyt6640/persona-harness/.github/workflows/canonical-clean-ci-attestation-builder.yml@refs/heads/main",
} as const

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
  readonly pack: {
    readonly fileCount: number
    readonly name: string
    readonly version: string
  }
  readonly phVersion: string
  readonly predicateType: typeof FINISH_ATTESTATION_PREDICATE_TYPE
  readonly ref: "refs/heads/main"
  readonly repository: typeof FINISH_ATTESTATION_POLICY.repository
  readonly repositoryId: typeof FINISH_ATTESTATION_POLICY.repositoryId
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
    readonly failed: 0
    readonly identity: string
    readonly passed: number
    readonly skipped: number
  }
  readonly workflow: {
    readonly path: typeof FINISH_ATTESTATION_POLICY.workflowPath
    readonly ref: typeof FINISH_ATTESTATION_POLICY.workflowRef
    readonly sha: string
  }
  readonly runner: {
    readonly environment: typeof FINISH_ATTESTATION_POLICY.runnerEnvironment
    readonly label: typeof FINISH_ATTESTATION_POLICY.runnerLabel
    readonly os: typeof FINISH_ATTESTATION_POLICY.runnerOs
  }
}

export type FinishAttestationStatement = {
  readonly predicate: {
    readonly authorityBoundary: "external-attested"
    readonly authorityEligible: true
    readonly predicateType: typeof FINISH_ATTESTATION_PREDICATE_TYPE
    readonly receipt: FinishAttestationReceipt
    readonly receiptDigest: string
  }
  readonly predicateType: typeof FINISH_ATTESTATION_PREDICATE_TYPE
  readonly subject: readonly [{
    readonly digest: { readonly sha256: string }
    readonly name: "receipt.json"
  }]
}

export type FinishAttestationDiagnostic = {
  readonly code: string
  readonly message: string
  readonly path: string
}

export type FinishAttestationState =
  | "binding-mismatch"
  | "crypto-failed"
  | "malformed"
  | "missing"
  | "replayed"
  | "runtime-unsupported"
  | "source-drift"
  | "stale"
  | "trusted"
  | "wrong-policy"

export type FinishAttestationAssessment = {
  readonly authorityEligible: boolean
  readonly consumptionState: "not-applicable" | "unconsumed" | "consumed"
  readonly decision: "blocked" | "trusted"
  readonly diagnostics: readonly FinishAttestationDiagnostic[]
  readonly receipt?: FinishAttestationReceipt
  readonly state: FinishAttestationState
  readonly summary: string
}

export type FinishAttestationWorkerResult =
  | { readonly bundleDigest: string; readonly ok: true; readonly statement: unknown }
  | {
      readonly message: string
      readonly ok: false
      readonly state: "crypto-failed" | "malformed" | "runtime-unsupported"
    }
