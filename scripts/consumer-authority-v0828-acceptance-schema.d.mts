export const V0828_ACCEPTANCE_SCHEMA_VERSION: "consumer-authority-v0828-acceptance.1"

export class V0828AcceptanceManifestError extends Error {
  readonly code: "v0828-acceptance-schema"
}

export type V0828AcceptanceManifest = Readonly<Record<string, unknown>> & Readonly<{
  readonly package: Readonly<{
    readonly channel: string
    readonly scope: string
    readonly version: string
  }>
  readonly v0827HistoricalRelease: Readonly<{
    readonly outcome: string
    readonly reusableForV0828: boolean
    readonly version: string
  }>
  readonly releaseTruth: Readonly<{
    readonly stableBody: string
    readonly publishedHistory: string
    readonly liveLookup: string
    readonly verification: string
  }>
}>

export function canonicalV0828AcceptanceManifest(): V0828AcceptanceManifest
export function readV0828AcceptanceManifest(packageRoot: string): V0828AcceptanceManifest
export function parseV0828AcceptanceManifest(value: unknown, packageVersion: string): V0828AcceptanceManifest
