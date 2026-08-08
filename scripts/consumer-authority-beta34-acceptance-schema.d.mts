export const BETA34_ACCEPTANCE_SCHEMA_VERSION: "consumer-authority-beta34-acceptance.1"

export class Beta34AcceptanceManifestError extends Error {
  readonly code: "beta34-acceptance-schema"
}

export type Beta34AcceptanceManifest = Readonly<Record<string, unknown>> & Readonly<{
  package: Readonly<{
    version: string
  }>
}>

export function canonicalBeta34AcceptanceManifest(): Beta34AcceptanceManifest
export function readBeta34AcceptanceManifest(packageRoot: string): Beta34AcceptanceManifest
export function parseBeta34AcceptanceManifest(value: unknown, packageVersion: string): Beta34AcceptanceManifest
