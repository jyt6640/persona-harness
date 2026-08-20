export const V0814_ACCEPTANCE_SCHEMA_VERSION: "consumer-authority-v0814-acceptance.1"

export class V0814AcceptanceManifestError extends Error {
  readonly code: "v0814-acceptance-schema"
}

export type V0814AcceptanceManifest = Readonly<Record<string, unknown>> & Readonly<{
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
  observerGhVersionProbe: Readonly<{
    ceilingMs: number
    timeoutCode: string
    unavailableCode: string
    unsupportedCode: string
    invalidCode: string
    selectorCode: string
    stageCode: string
    output: string
  }>
  package: Readonly<{
    channel: string
    scope: string
    version: string
  }>
  v0813HistoricalRelease: Readonly<{
    reusableForV0814: boolean
    version: string
  }>
  v0812HistoricalRelease: Readonly<{
    reusableForV0814: boolean
    version: string
  }>
  v0810HistoricalRelease: Readonly<{
    reusableForV0814: boolean
    version: string
  }>
  v0811HistoricalRelease: Readonly<{
    reusableForV0814: boolean
    version: string
  }>
  v089HistoricalRelease: Readonly<{
    reusableForV0814: boolean
    version: string
  }>
}>

export function canonicalV0814AcceptanceManifest(): V0814AcceptanceManifest
export function readV0814AcceptanceManifest(packageRoot: string): V0814AcceptanceManifest
export function parseV0814AcceptanceManifest(value: unknown, packageVersion: string): V0814AcceptanceManifest
