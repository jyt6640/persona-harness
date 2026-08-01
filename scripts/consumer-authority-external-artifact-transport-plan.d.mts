export const EXTERNAL_ARTIFACT_TRANSPORT_PLAN_SCHEMA_VERSION: "consumer-authority-external-artifact-transport-plan.1"
export const EXTERNAL_ARTIFACT_TRANSPORT_PREFLIGHT_SCHEMA_VERSION: "consumer-authority-external-artifact-transport-preflight.1"

export interface ExternalArtifactTopology {
  readonly callerEnrollment: {
    readonly repositoryId: 1304576182
    readonly repositorySlug: "jyt6640/persona-harness-attestation-claim-fixture"
    readonly workflowPath: ".github/workflows/research-attestation.yml"
    readonly workflowRef: "refs/heads/main"
    readonly workflowSha: string
  }
  readonly callerSource: { readonly ref: "refs/heads/main"; readonly sourceSha: string }
  readonly reusableSigner: {
    readonly repositorySlug: "jyt6640/persona-harness"
    readonly workflowPath: ".github/workflows/persona-harness-project-finish.yml"
    readonly workflowSha: string
  }
}

export interface ExternalArtifactMetadata {
  readonly artifactId: number
  readonly expectedByteLength: number
  readonly expectedSha256: string
  readonly runId: string
}

export class ExternalArtifactTransportPlanError extends Error {
  readonly code: "external-artifact-transport-plan"
}

export function canonicalExternalArtifactTransportPlan(): Record<string, unknown>
export function parseExternalArtifactTransportPlan(value: unknown): Record<string, unknown>
export function renderExternalArtifactTransportRequest(
  plan: unknown,
  topology: ExternalArtifactTopology,
  artifact: ExternalArtifactMetadata,
): {
  readonly artifact: ExternalArtifactMetadata
  readonly headers: Readonly<Record<string, string>>
  readonly topology: ExternalArtifactTopology
  readonly url: URL
}
export function runExternalArtifactTransportPreflight(): Promise<Record<string, unknown>>
