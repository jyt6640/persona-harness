export const BETA27_ACCEPTANCE_SCHEMA_VERSION: "consumer-authority-beta27-acceptance.1"

export class Beta27AcceptanceManifestError extends Error {
  readonly code: string
}

export function canonicalBeta27AcceptanceManifest(): Readonly<Record<string, unknown>>
export function readBeta27AcceptanceManifest(packageRoot: string): Readonly<Record<string, unknown>>
export function parseBeta27AcceptanceManifest(value: unknown, packageVersion: string): Readonly<Record<string, unknown>>
