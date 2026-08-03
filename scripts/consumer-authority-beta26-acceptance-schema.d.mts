export const BETA26_ACCEPTANCE_SCHEMA_VERSION: "consumer-authority-beta26-acceptance.1"

export class Beta26AcceptanceManifestError extends Error {
  readonly code: string
}

export function canonicalBeta26AcceptanceManifest(): Readonly<Record<string, unknown>>
export function readBeta26AcceptanceManifest(packageRoot: string): Readonly<Record<string, unknown>>
export function parseBeta26AcceptanceManifest(value: unknown, packageVersion: string): Readonly<Record<string, unknown>>
