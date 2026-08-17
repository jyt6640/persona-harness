export const V089_ACCEPTANCE_SCHEMA_VERSION: "consumer-authority-v089-acceptance.1"

export class V089AcceptanceManifestError extends Error {
  readonly code: "v089-acceptance-schema"
}

export type V089AcceptanceManifest = Readonly<Record<string, unknown>> & Readonly<{
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
  v088HistoricalRelease: Readonly<{
    reusableForV089: boolean
    version: string
  }>
}>

export function canonicalV089AcceptanceManifest(): V089AcceptanceManifest
export function readV089AcceptanceManifest(packageRoot: string): V089AcceptanceManifest
export function parseV089AcceptanceManifest(value: unknown, packageVersion: string): V089AcceptanceManifest
