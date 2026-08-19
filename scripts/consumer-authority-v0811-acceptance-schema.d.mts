export const V0811_ACCEPTANCE_SCHEMA_VERSION: "consumer-authority-v0811-acceptance.1"

export class V0811AcceptanceManifestError extends Error {
  readonly code: "v0811-acceptance-schema"
}

export type V0811AcceptanceManifest = Readonly<Record<string, unknown>> & Readonly<{
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
  v0810HistoricalRelease: Readonly<{
    reusableForV0811: boolean
    version: string
  }>
  v089HistoricalRelease: Readonly<{
    reusableForV0811: boolean
    version: string
  }>
}>

export function canonicalV0811AcceptanceManifest(): V0811AcceptanceManifest
export function readV0811AcceptanceManifest(packageRoot: string): V0811AcceptanceManifest
export function parseV0811AcceptanceManifest(value: unknown, packageVersion: string): V0811AcceptanceManifest
