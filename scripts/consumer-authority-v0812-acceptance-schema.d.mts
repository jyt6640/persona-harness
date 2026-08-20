export const V0812_ACCEPTANCE_SCHEMA_VERSION: "consumer-authority-v0812-acceptance.1"

export class V0812AcceptanceManifestError extends Error {
  readonly code: "v0812-acceptance-schema"
}

export type V0812AcceptanceManifest = Readonly<Record<string, unknown>> & Readonly<{
  authority: Readonly<{
    fetchSelection: Readonly<{
      requiredTuple: readonly string[]
      repositoryOnly: string
      returnedArtifact: string
      receipt: string
    }>
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
    reusableForV0812: boolean
    version: string
  }>
  v0811HistoricalRelease: Readonly<{
    reusableForV0812: boolean
    version: string
  }>
  v089HistoricalRelease: Readonly<{
    reusableForV0812: boolean
    version: string
  }>
}>

export function canonicalV0812AcceptanceManifest(): V0812AcceptanceManifest
export function readV0812AcceptanceManifest(packageRoot: string): V0812AcceptanceManifest
export function parseV0812AcceptanceManifest(value: unknown, packageVersion: string): V0812AcceptanceManifest
