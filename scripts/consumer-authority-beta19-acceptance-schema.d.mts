export const BETA19_ACCEPTANCE_SCHEMA_VERSION: "consumer-authority-beta19-acceptance.1"

export class Beta19AcceptanceManifestError extends Error {
  readonly code: string
}

export function canonicalBeta19AcceptanceManifest(): Readonly<Record<string, unknown>>
export function readBeta19AcceptanceManifest(packageRoot: string): Readonly<Record<string, unknown>>
export function parseBeta19AcceptanceManifest(value: unknown, packageVersion: string): Readonly<Record<string, unknown>>
