export const V0810_ACCEPTANCE_SCHEMA_VERSION: "consumer-authority-v0810-acceptance.1"

export class V0810AcceptanceManifestError extends Error {
  readonly code: "v0810-acceptance-schema"
}

export type V0810AcceptanceManifest = Readonly<Record<string, unknown>> & Readonly<{
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
  v089HistoricalRelease: Readonly<{
    reusableForV0810: boolean
    version: string
  }>
}>

export function canonicalV0810AcceptanceManifest(): V0810AcceptanceManifest
export function readV0810AcceptanceManifest(packageRoot: string): V0810AcceptanceManifest
export function parseV0810AcceptanceManifest(value: unknown, packageVersion: string): V0810AcceptanceManifest
