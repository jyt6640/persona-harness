export const BETA24_ACCEPTANCE_SCHEMA_VERSION: "consumer-authority-beta24-acceptance.1"

export class Beta24AcceptanceManifestError extends Error {
  readonly code: string
}

export function canonicalBeta24AcceptanceManifest(): Readonly<Record<string, unknown>>
export function readBeta24AcceptanceManifest(packageRoot: string): Readonly<Record<string, unknown>>
export function parseBeta24AcceptanceManifest(value: unknown, packageVersion: string): Readonly<Record<string, unknown>>
