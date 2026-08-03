export const BETA28_ACCEPTANCE_SCHEMA_VERSION: "consumer-authority-beta28-acceptance.1"

export class Beta28AcceptanceManifestError extends Error {
  readonly code: string
}

export function canonicalBeta28AcceptanceManifest(): Readonly<Record<string, unknown>>
export function readBeta28AcceptanceManifest(packageRoot: string): Readonly<Record<string, unknown>>
export function parseBeta28AcceptanceManifest(value: unknown, packageVersion: string): Readonly<Record<string, unknown>>
