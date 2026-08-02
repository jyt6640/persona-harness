export const BETA22_ACCEPTANCE_SCHEMA_VERSION: "consumer-authority-beta22-acceptance.1"

export class Beta22AcceptanceManifestError extends Error {
  readonly code: string
}

export function canonicalBeta22AcceptanceManifest(): Readonly<Record<string, unknown>>
export function readBeta22AcceptanceManifest(packageRoot: string): Readonly<Record<string, unknown>>
export function parseBeta22AcceptanceManifest(value: unknown, packageVersion: string): Readonly<Record<string, unknown>>
