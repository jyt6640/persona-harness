export const V0813_ACCEPTANCE_SCHEMA_VERSION: "consumer-authority-v0813-acceptance.1"

export class V0813AcceptanceManifestError extends Error {
  readonly code: "v0813-acceptance-schema"
}

export type V0813AcceptanceManifest = Readonly<Record<string, unknown>> & Readonly<{
  authority: Readonly<{
    fetchSelection: Readonly<{
      requiredTuple: readonly string[]
      repositoryOnly: string
      returnedArtifact: string
      receipt: string
    }>
    fetchResult: Readonly<{
      schemaVersion: string
      sourceReason: readonly string[]
      sourceReasonWhen: string
      nonSourceReasons: string
      privacy: string
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
  v0812HistoricalRelease: Readonly<{
    reusableForV0813: boolean
    version: string
  }>
  v0810HistoricalRelease: Readonly<{
    reusableForV0813: boolean
    version: string
  }>
  v0811HistoricalRelease: Readonly<{
    reusableForV0813: boolean
    version: string
  }>
  v089HistoricalRelease: Readonly<{
    reusableForV0813: boolean
    version: string
  }>
}>

export function canonicalV0813AcceptanceManifest(): V0813AcceptanceManifest
export function readV0813AcceptanceManifest(packageRoot: string): V0813AcceptanceManifest
export function parseV0813AcceptanceManifest(value: unknown, packageVersion: string): V0813AcceptanceManifest
