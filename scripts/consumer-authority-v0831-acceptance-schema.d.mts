export const V0831_ACCEPTANCE_SCHEMA_VERSION: "consumer-authority-v0831-acceptance.1"

export class V0831AcceptanceManifestError extends Error {
  readonly code: "v0831-acceptance-schema"
}

export type V0831AcceptanceManifest = Readonly<Record<string, unknown>> & Readonly<{
  readonly package: Readonly<{
    readonly channel: string
    readonly scope: string
    readonly version: string
  }>
  readonly v0830HistoricalRelease: Readonly<{
    readonly outcome: string
    readonly reusableForV0831: boolean
    readonly version: string
  }>
  readonly releaseTruth: Readonly<{
    readonly stableBody: string
    readonly publishedHistory: string
    readonly liveLookup: string
    readonly verification: string
  }>
  readonly workflowFinishSourceReadDiagnostic: Readonly<{
    readonly blockerId: string
    readonly recordedArtifacts: string
    readonly retry: string
  }>
}>

export function canonicalV0831AcceptanceManifest(): V0831AcceptanceManifest
export function readV0831AcceptanceManifest(packageRoot: string): V0831AcceptanceManifest
export function parseV0831AcceptanceManifest(value: unknown, packageVersion: string): V0831AcceptanceManifest
