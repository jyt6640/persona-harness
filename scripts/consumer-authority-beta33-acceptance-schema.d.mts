export const BETA33_ACCEPTANCE_SCHEMA_VERSION: "consumer-authority-beta33-acceptance.1"

export class Beta33AcceptanceManifestError extends Error {
  readonly code: "beta33-acceptance-schema"
}

export type Beta33AcceptanceManifest = Readonly<Record<string, unknown>> & Readonly<{
  package: Readonly<{
    version: string
  }>
}>

export function canonicalBeta33AcceptanceManifest(): Beta33AcceptanceManifest
export function readBeta33AcceptanceManifest(packageRoot: string): Beta33AcceptanceManifest
export function parseBeta33AcceptanceManifest(value: unknown, packageVersion: string): Beta33AcceptanceManifest
