export const V0824_ACCEPTANCE_SCHEMA_VERSION: "consumer-authority-v0824-acceptance.1"

export class V0824AcceptanceManifestError extends Error {
  readonly code: "v0824-acceptance-schema"
}

export type V0824AcceptanceManifest = Readonly<Record<string, unknown>> & Readonly<{
  readonly package: Readonly<{
    readonly channel: string
    readonly scope: string
    readonly version: string
  }>
  readonly v0823HistoricalRelease: Readonly<{
    readonly outcome: string
    readonly reusableForV0824: boolean
    readonly version: string
  }>
  readonly workflowDemonstration: Readonly<{
    readonly cooperativeFinish: string
    readonly protectedCi: string
    readonly runtimeInjection: string
  }>
}>

export function canonicalV0824AcceptanceManifest(): V0824AcceptanceManifest
export function readV0824AcceptanceManifest(packageRoot: string): V0824AcceptanceManifest
export function parseV0824AcceptanceManifest(value: unknown, packageVersion: string): V0824AcceptanceManifest
