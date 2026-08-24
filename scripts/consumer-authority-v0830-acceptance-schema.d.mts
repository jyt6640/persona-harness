export const V0830_ACCEPTANCE_SCHEMA_VERSION: "consumer-authority-v0830-acceptance.1"

export class V0830AcceptanceManifestError extends Error {
  readonly code: "v0830-acceptance-schema"
}

export type V0830AcceptanceManifest = Readonly<Record<string, unknown>> & Readonly<{
  readonly package: Readonly<{
    readonly channel: string
    readonly scope: string
    readonly version: string
  }>
  readonly v0829HistoricalRelease: Readonly<{
    readonly outcome: string
    readonly reusableForV0830: boolean
    readonly version: string
  }>
  readonly releaseTruth: Readonly<{
    readonly stableBody: string
    readonly publishedHistory: string
    readonly liveLookup: string
    readonly verification: string
  }>
}>

export function canonicalV0830AcceptanceManifest(): V0830AcceptanceManifest
export function readV0830AcceptanceManifest(packageRoot: string): V0830AcceptanceManifest
export function parseV0830AcceptanceManifest(value: unknown, packageVersion: string): V0830AcceptanceManifest
