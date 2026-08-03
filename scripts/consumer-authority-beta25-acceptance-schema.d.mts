export const BETA25_ACCEPTANCE_SCHEMA_VERSION: "consumer-authority-beta25-acceptance.1"

export class Beta25AcceptanceManifestError extends Error {
  readonly code: string
}

export function canonicalBeta25AcceptanceManifest(): Readonly<Record<string, unknown>>
export function readBeta25AcceptanceManifest(packageRoot: string): Readonly<Record<string, unknown>>
export function parseBeta25AcceptanceManifest(value: unknown, packageVersion: string): Readonly<Record<string, unknown>>
