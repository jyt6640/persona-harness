export const BETA15_ACCEPTANCE_SCHEMA_VERSION: "consumer-authority-beta15-acceptance.2"

export interface Beta15AcceptanceManifest {
  readonly [key: string]: unknown
  readonly schemaVersion: "consumer-authority-beta15-acceptance.2"
  readonly package: {
    readonly channel: "staging"
    readonly scope: "staging-only"
    readonly version: "0.8.0-beta.15"
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

export class Beta15AcceptanceManifestError extends Error {
  readonly code: "beta15-acceptance-schema"
}

export function readBeta15AcceptanceManifest(packageRoot: string): Beta15AcceptanceManifest
export function parseBeta15AcceptanceManifest(value: unknown, packageVersion: string): Beta15AcceptanceManifest
