export const V0825_ACCEPTANCE_SCHEMA_VERSION: "consumer-authority-v0825-acceptance.1"

export class V0825AcceptanceManifestError extends Error {
  readonly code: "v0825-acceptance-schema"
}

export type V0825AcceptanceManifest = Readonly<Record<string, unknown>> & Readonly<{
  readonly package: Readonly<{
    readonly channel: string
    readonly scope: string
    readonly version: string
  }>
  readonly v0824HistoricalRelease: Readonly<{
    readonly outcome: string
    readonly reusableForV0825: boolean
    readonly version: string
  }>
  readonly workflowDemonstration: Readonly<{
    readonly cooperativeFinish: string
    readonly protectedCi: string
    readonly runtimeInjection: string
  }>
  readonly releaseTruth: Readonly<{
    readonly stableBody: string
    readonly publishedHistory: string
    readonly verification: string
  }>
}>

export function canonicalV0825AcceptanceManifest(): V0825AcceptanceManifest
export function readV0825AcceptanceManifest(packageRoot: string): V0825AcceptanceManifest
export function parseV0825AcceptanceManifest(value: unknown, packageVersion: string): V0825AcceptanceManifest
