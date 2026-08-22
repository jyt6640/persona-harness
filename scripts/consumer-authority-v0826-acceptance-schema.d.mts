export const V0826_ACCEPTANCE_SCHEMA_VERSION: "consumer-authority-v0826-acceptance.1"

export class V0826AcceptanceManifestError extends Error {
  readonly code: "v0826-acceptance-schema"
}

export type V0826AcceptanceManifest = Readonly<Record<string, unknown>> & Readonly<{
  readonly package: Readonly<{
    readonly channel: string
    readonly scope: string
    readonly version: string
  }>
  readonly v0825HistoricalRelease: Readonly<{
    readonly outcome: string
    readonly reusableForV0826: boolean
    readonly version: string
  }>
  readonly releaseTruth: Readonly<{
    readonly stableBody: string
    readonly publishedHistory: string
    readonly liveLookup: string
    readonly verification: string
  }>
}>

export function canonicalV0826AcceptanceManifest(): V0826AcceptanceManifest
export function readV0826AcceptanceManifest(packageRoot: string): V0826AcceptanceManifest
export function parseV0826AcceptanceManifest(value: unknown, packageVersion: string): V0826AcceptanceManifest
