export const GA_ACCEPTANCE_SCHEMA_VERSION: "consumer-authority-ga-acceptance.1"

export class GaAcceptanceManifestError extends Error {
  readonly code: "ga-acceptance-schema"
}

export type GaAcceptanceManifest = Readonly<Record<string, unknown>> & Readonly<{
  package: Readonly<{
    version: string
  }>
}>

export function canonicalGaAcceptanceManifest(): GaAcceptanceManifest
export function readGaAcceptanceManifest(packageRoot: string): GaAcceptanceManifest
export function parseGaAcceptanceManifest(value: unknown, packageVersion: string): GaAcceptanceManifest
