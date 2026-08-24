export const V0829_ACCEPTANCE_SCHEMA_VERSION: "consumer-authority-v0829-acceptance.1"

export class V0829AcceptanceManifestError extends Error {
  readonly code: "v0829-acceptance-schema"
}

export type V0829AcceptanceManifest = Readonly<Record<string, unknown>> & Readonly<{
  readonly package: Readonly<{
    readonly channel: string
    readonly scope: string
    readonly version: string
  }>
  readonly v0828HistoricalRelease: Readonly<{
    readonly outcome: string
    readonly reusableForV0829: boolean
    readonly version: string
  }>
  readonly releaseTruth: Readonly<{
    readonly stableBody: string
    readonly publishedHistory: string
    readonly liveLookup: string
    readonly verification: string
  }>
}>

export function canonicalV0829AcceptanceManifest(): V0829AcceptanceManifest
export function readV0829AcceptanceManifest(packageRoot: string): V0829AcceptanceManifest
export function parseV0829AcceptanceManifest(value: unknown, packageVersion: string): V0829AcceptanceManifest
