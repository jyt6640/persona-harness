export const BETA16_ACCEPTANCE_SCHEMA_VERSION: "consumer-authority-beta16-acceptance.1"

export interface Beta16AcceptanceManifest {
  readonly [key: string]: unknown
  readonly schemaVersion: "consumer-authority-beta16-acceptance.1"
  readonly package: {
    readonly channel: "staging"
    readonly scope: "staging-only"
    readonly version: "0.8.0-beta.16"
  }
  readonly packageBoundary: {
    readonly bundle: {
      readonly requiredRefs: readonly [
        "explicit-single-refs-heads-candidate-must-match-expected-head",
        "refs/remotes/origin/main",
      ]
    }
    readonly authoritativeBundleContract: {
      readonly candidateRef: "explicit-single-refs-heads-candidate-must-match-expected-head"
      readonly headAlias: "optional-head-mapping-must-match-the-same-expected-head"
      readonly sourceCandidateRef: "refs/heads/clean-package-source"
    }
  }
}

export class Beta16AcceptanceManifestError extends Error {
  readonly code: "beta16-acceptance-schema"
}

export function canonicalBeta16AcceptanceManifest(): Beta16AcceptanceManifest
export function readBeta16AcceptanceManifest(packageRoot: string): Beta16AcceptanceManifest
export function parseBeta16AcceptanceManifest(value: unknown, packageVersion: string): Beta16AcceptanceManifest
