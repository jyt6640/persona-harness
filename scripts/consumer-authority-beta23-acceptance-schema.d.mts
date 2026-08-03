export const BETA23_ACCEPTANCE_SCHEMA_VERSION: "consumer-authority-beta23-acceptance.1"

export class Beta23AcceptanceManifestError extends Error {
  readonly code: string
}

export function canonicalBeta23AcceptanceManifest(): Readonly<Record<string, unknown>>
export function readBeta23AcceptanceManifest(packageRoot: string): Readonly<Record<string, unknown>>
export function parseBeta23AcceptanceManifest(value: unknown, packageVersion: string): Readonly<Record<string, unknown>>
