export const BETA31_ACCEPTANCE_SCHEMA_VERSION: "consumer-authority-beta31-acceptance.1"

export class Beta31AcceptanceManifestError extends Error {
  readonly code: "beta31-acceptance-schema"
}

export function canonicalBeta31AcceptanceManifest(): Record<string, unknown>
export function readBeta31AcceptanceManifest(packageRoot: string): Record<string, unknown>
export function parseBeta31AcceptanceManifest(value: unknown, packageVersion: string): Record<string, unknown>
