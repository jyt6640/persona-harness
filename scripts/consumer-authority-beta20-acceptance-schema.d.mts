export const BETA20_ACCEPTANCE_SCHEMA_VERSION: "consumer-authority-beta20-acceptance.1"

export class Beta20AcceptanceManifestError extends Error {
  readonly code: string
}

export function canonicalBeta20AcceptanceManifest(): Readonly<Record<string, unknown>>
export function readBeta20AcceptanceManifest(packageRoot: string): Readonly<Record<string, unknown>>
export function parseBeta20AcceptanceManifest(value: unknown, packageVersion: string): Readonly<Record<string, unknown>>
