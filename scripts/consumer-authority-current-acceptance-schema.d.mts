export const CURRENT_ACCEPTANCE_SCHEMA_VERSION: "consumer-authority-current-acceptance.1"

export class CurrentAcceptanceManifestError extends Error {
  readonly code: "current-acceptance-schema"
}

export type CurrentAcceptanceManifest = Readonly<Record<string, unknown>> & Readonly<{
  readonly authority: Readonly<{
    readonly fixturePlan: Readonly<{
      readonly registryInstall: string
    }>
    readonly hostedFixture: Readonly<{
      readonly revision: string
    }>
  }>
  readonly hostedResidual: Readonly<{
    readonly id: string
  }>
  readonly package: Readonly<{
    readonly channel: string
    readonly scope: string
    readonly version: string
  }>
  readonly previousPublishedRelease: Readonly<{
    readonly outcome: string
    readonly reusableForCurrent: boolean
    readonly version: string
  }>
}>

export function readCurrentAcceptanceManifest(packageRoot: string): CurrentAcceptanceManifest
export function parseCurrentAcceptanceManifest(value: unknown, packageVersion: string): CurrentAcceptanceManifest
