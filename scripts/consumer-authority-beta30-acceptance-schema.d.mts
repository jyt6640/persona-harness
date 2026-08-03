export const BETA30_ACCEPTANCE_SCHEMA_VERSION: "consumer-authority-beta30-acceptance.1"

export class Beta30AcceptanceManifestError extends Error {
  readonly code: "beta30-acceptance-schema"
}

export function canonicalBeta30AcceptanceManifest(): Record<string, unknown>
export function readBeta30AcceptanceManifest(packageRoot: string): Record<string, unknown>
export function parseBeta30AcceptanceManifest(value: unknown, packageVersion: string): Record<string, unknown>
