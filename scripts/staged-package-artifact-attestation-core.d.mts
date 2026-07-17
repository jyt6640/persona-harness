export const STAGED_PACKAGE_ARTIFACT_SCHEMA: "staged-package-artifact-binding.1"
export const STAGED_PACKAGE_ARTIFACT_PREDICATE_TYPE: "https://github.com/jyt6640/persona-harness/attestations/staged-package-artifact-binding.1"
export const STAGED_PACKAGE_ARTIFACT_COMMAND_CATALOG_ID: "persona-harness-staged-package-artifact-producer.1"
export const STAGED_PACKAGE_ARTIFACT_REPOSITORY: "jyt6640/persona-harness"
export const STAGED_PACKAGE_ARTIFACT_REPOSITORY_ID: 1272008570
export const STAGED_PACKAGE_ARTIFACT_PACKAGE: "persona-harness"
export const STAGED_PACKAGE_ARTIFACT_REGISTRY_ORIGIN: "https://registry.npmjs.org"
export const STAGED_PACKAGE_ARTIFACT_WORKFLOW_PATH: ".github/workflows/staged-package-artifact-attestation.yml"
export const STAGED_PACKAGE_ARTIFACT_WORKFLOW_REF: "jyt6640/persona-harness/.github/workflows/staged-package-artifact-attestation.yml@refs/heads/main"
export const STAGED_PACKAGE_ARTIFACT_RUNNER_LABEL: "ubuntu-latest"
export const STAGED_PACKAGE_ARTIFACT_CHANNELS: readonly ["staging", "next"]
export const STAGED_PACKAGE_ARTIFACT_CONTEXT_REQUIREMENTS: readonly {
  readonly code: string
  readonly expected: string
  readonly key: string
}[]
export const FIXED_STAGED_PACKAGE_ARTIFACT_COMMAND_PLAN: readonly Readonly<Record<string, string>>[]

export class StagedPackageArtifactProducerError extends Error {
  readonly code: string
}

export function stagedPackageTarballUrl(version: unknown): string
export function validateStagedPackageArtifactContext(value: unknown): Readonly<Record<string, unknown>>
export function createStagedPackageArtifactPredicate(input: unknown): {
  readonly predicate: Readonly<Record<string, unknown>>
  readonly tarballBytes: Buffer
}
