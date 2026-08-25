export const V0832_ACCEPTANCE_SCHEMA_VERSION: "consumer-authority-v0832-acceptance.1"

export class V0832AcceptanceManifestError extends Error {
  readonly code: "v0832-acceptance-schema"
}

export type V0832AcceptanceManifest = Readonly<Record<string, unknown>> & Readonly<{
  readonly package: Readonly<{
    readonly channel: string
    readonly scope: string
    readonly version: string
  }>
  readonly v0831HistoricalRelease: Readonly<{
    readonly outcome: string
    readonly reusableForV0832: boolean
    readonly version: string
  }>
  readonly releaseTruth: Readonly<{
    readonly stableBody: string
    readonly publishedHistory: string
    readonly liveLookup: string
    readonly verification: string
  }>
  readonly legacyAutoUpdateRepair: Readonly<{
    readonly command: string
    readonly eligibility: string
    readonly preservation: string
    readonly rejection: string
  }>
}>

export function canonicalV0832AcceptanceManifest(): V0832AcceptanceManifest
export function readV0832AcceptanceManifest(packageRoot: string): V0832AcceptanceManifest
export function parseV0832AcceptanceManifest(value: unknown, packageVersion: string): V0832AcceptanceManifest
