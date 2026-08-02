export const BETA21_ACCEPTANCE_SCHEMA_VERSION: "consumer-authority-beta21-acceptance.1"

export class Beta21AcceptanceManifestError extends Error {
  readonly code: string
}

export function canonicalBeta21AcceptanceManifest(): Readonly<Record<string, unknown>>
export function readBeta21AcceptanceManifest(packageRoot: string): Readonly<Record<string, unknown>>
export function parseBeta21AcceptanceManifest(value: unknown, packageVersion: string): Readonly<Record<string, unknown>>
