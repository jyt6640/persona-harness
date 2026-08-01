export const BETA18_ACCEPTANCE_SCHEMA_VERSION: "consumer-authority-beta18-acceptance.1"

export class Beta18AcceptanceManifestError extends Error {
  readonly code: string
}

export function canonicalBeta18AcceptanceManifest(): Readonly<Record<string, unknown>>
export function readBeta18AcceptanceManifest(packageRoot: string): Readonly<Record<string, unknown>>
export function parseBeta18AcceptanceManifest(value: unknown, packageVersion: string): Readonly<Record<string, unknown>>
