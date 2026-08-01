export const BETA17_ACCEPTANCE_SCHEMA_VERSION: "consumer-authority-beta17-acceptance.1"

export interface Beta17AcceptanceManifest {
  readonly [key: string]: unknown
  readonly schemaVersion: "consumer-authority-beta17-acceptance.1"
  readonly package: {
    readonly channel: "staging"
    readonly scope: "staging-only"
    readonly version: "0.8.0-beta.17"
  }
}

export class Beta17AcceptanceManifestError extends Error {
  readonly code: "beta17-acceptance-schema"
}

export function canonicalBeta17AcceptanceManifest(): Beta17AcceptanceManifest
export function readBeta17AcceptanceManifest(packageRoot: string): Beta17AcceptanceManifest
export function parseBeta17AcceptanceManifest(value: unknown, packageVersion: string): Beta17AcceptanceManifest
