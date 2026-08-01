export const EXTERNAL_ATTESTATION_COMMAND_PLAN_SCHEMA_VERSION: "consumer-authority-external-attestation-command-plan.1"
export const EXTERNAL_ATTESTATION_PREFLIGHT_SCHEMA_VERSION: "consumer-authority-external-attestation-preflight.1"

export interface ExternalAttestationCommandPlan {
  readonly certificateOidcIssuer: "https://token.actions.githubusercontent.com"
  readonly command: readonly ["attestation", "verify"]
  readonly denySelfHostedRunners: true
  readonly exitClassification: {
    readonly authenticationRequired: 4
    readonly normalVerificationFailure: 1
    readonly verified: 0
  }
  readonly format: "json"
  readonly predicateType: "https://github.com/jyt6640/persona-harness/attestations/project-finish-attestation.1"
  readonly repositorySelector: {
    readonly flag: "--repo"
    readonly source: "caller-enrollment.repositorySlug"
  }
  readonly schemaVersion: "consumer-authority-external-attestation-command-plan.1"
  readonly signerDigest: {
    readonly flag: "--signer-digest"
    readonly source: "reusable-signer.workflowSha"
  }
  readonly signerSelector: {
    readonly flag: "--signer-workflow"
    readonly source: "reusable-signer.workflowPath"
  }
  readonly sourceDigest: {
    readonly flag: "--source-digest"
    readonly source: "caller-source.sourceSha"
  }
  readonly sourceRef: {
    readonly flag: "--source-ref"
    readonly source: "caller-source.ref"
  }
  readonly tokenIsolation: {
    readonly artifactAccess: "forbidden-during-preflight"
    readonly credential: "absent"
    readonly output: "bounded-classification-only"
  }
}

export interface ExternalAttestationTopology {
  readonly callerEnrollment: {
    readonly repositoryId: 1304576182
    readonly repositorySlug: "jyt6640/persona-harness-attestation-claim-fixture"
    readonly workflowPath: ".github/workflows/research-attestation.yml"
    readonly workflowRef: "refs/heads/main"
    readonly workflowSha: string
  }
  readonly callerSource: {
    readonly ref: "refs/heads/main"
    readonly sourceSha: string
  }
  readonly reusableSigner: {
    readonly repositorySlug: "jyt6640/persona-harness"
    readonly workflowPath: ".github/workflows/persona-harness-project-finish.yml"
    readonly workflowSha: string
  }
}

export interface ExternalAttestationPreflightResult {
  readonly artifactAccess: false
  readonly authorityEligible: false
  readonly code: string
  readonly credential: "absent"
  readonly exit: "verified" | "verification-failed" | "authentication-required" | "execution-failed"
  readonly networkAccess: false
  readonly schemaVersion: "consumer-authority-external-attestation-preflight.1"
  readonly state: "ready" | "blocked"
}

export interface ExternalAttestationPreflightExecutionOptions {
  readonly encoding: "utf8"
  readonly env: Readonly<Record<string, string | undefined>>
  readonly maxBuffer: number
  readonly shell: false
  readonly stdio: readonly ["ignore", "pipe", "pipe"]
  readonly timeout: number
}

export interface ExternalAttestationPreflightExecutionResult {
  readonly error?: unknown
  readonly status?: number | null
  readonly stderr?: string
  readonly stdout?: string
}

export class ExternalAttestationCommandPlanError extends Error {
  readonly code: "external-attestation-command-plan"
}

export function canonicalExternalAttestationCommandPlan(): ExternalAttestationCommandPlan
export function parseExternalAttestationCommandPlan(value: unknown): ExternalAttestationCommandPlan
export function renderExternalAttestationVerifyArguments(
  plan: ExternalAttestationCommandPlan,
  topology: ExternalAttestationTopology,
  inputs: { readonly bundlePath: string; readonly subjectPath: string },
): readonly string[]
export function classifyGhAttestationExit(status: unknown): "verified" | "verification-failed" | "authentication-required" | "execution-failed"
export function runExternalAttestationGrammarPreflight(
  plan: ExternalAttestationCommandPlan,
  topology: ExternalAttestationTopology,
  options?: {
    readonly ghPath?: string
    readonly execute?: (
      command: string,
      argumentsList: readonly string[],
      options: ExternalAttestationPreflightExecutionOptions,
    ) => ExternalAttestationPreflightExecutionResult
  },
): ExternalAttestationPreflightResult
