export const V0827_ACCEPTANCE_SCHEMA_VERSION: "consumer-authority-v0827-acceptance.1"

export class V0827AcceptanceManifestError extends Error {
  readonly code: "v0827-acceptance-schema"
}

export type V0827AcceptanceManifest = Readonly<Record<string, unknown>> & Readonly<{
  readonly package: Readonly<{
    readonly channel: string
    readonly scope: string
    readonly version: string
  }>
  readonly v0826HistoricalRelease: Readonly<{
    readonly outcome: string
    readonly reusableForV0827: boolean
    readonly version: string
  }>
  readonly releaseTruth: Readonly<{
    readonly stableBody: string
    readonly publishedHistory: string
    readonly liveLookup: string
    readonly verification: string
  }>
}>

export function canonicalV0827AcceptanceManifest(): V0827AcceptanceManifest
export function readV0827AcceptanceManifest(packageRoot: string): V0827AcceptanceManifest
export function parseV0827AcceptanceManifest(value: unknown, packageVersion: string): V0827AcceptanceManifest
