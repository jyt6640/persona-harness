export const BETA29_ACCEPTANCE_SCHEMA_VERSION: "consumer-authority-beta29-acceptance.1"

export class Beta29AcceptanceManifestError extends Error {
  readonly code: "beta29-acceptance-schema"
}

export function canonicalBeta29AcceptanceManifest(): Record<string, unknown>
export function readBeta29AcceptanceManifest(packageRoot: string): Record<string, unknown>
export function parseBeta29AcceptanceManifest(value: unknown, packageVersion: string): Record<string, unknown>
