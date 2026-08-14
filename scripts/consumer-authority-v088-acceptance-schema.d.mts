export const V088_ACCEPTANCE_SCHEMA_VERSION: "consumer-authority-v088-acceptance.1"

export class V088AcceptanceManifestError extends Error {
  readonly code: "v088-acceptance-schema"
}

export type V088AcceptanceManifest = Readonly<Record<string, unknown>> & Readonly<{
  authority: Readonly<{
    fixturePlan: Readonly<{ registryInstall: string }>
    hostedFixture: Readonly<{ revision: string }>
  }>
  hostedResidual: Readonly<{ id: string }>
  package: Readonly<{
    channel: string
    scope: string
    version: string
  }>
  v087HistoricalRelease: Readonly<{
    reusableForV088: boolean
    version: string
  }>
}>

export function canonicalV088AcceptanceManifest(): V088AcceptanceManifest
export function readV088AcceptanceManifest(packageRoot: string): V088AcceptanceManifest
export function parseV088AcceptanceManifest(value: unknown, packageVersion: string): V088AcceptanceManifest
