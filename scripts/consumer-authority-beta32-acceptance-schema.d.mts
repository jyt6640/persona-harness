export const BETA32_ACCEPTANCE_SCHEMA_VERSION: "consumer-authority-beta32-acceptance.1"

export class Beta32AcceptanceManifestError extends Error {
  readonly code: "beta32-acceptance-schema"
}

export type Beta32AcceptanceManifest = Readonly<Record<string, unknown>> & Readonly<{
  package: Readonly<{
    version: string
  }>
}>

export function canonicalBeta32AcceptanceManifest(): Beta32AcceptanceManifest
export function readBeta32AcceptanceManifest(packageRoot: string): Beta32AcceptanceManifest
export function parseBeta32AcceptanceManifest(value: unknown, packageVersion: string): Beta32AcceptanceManifest
