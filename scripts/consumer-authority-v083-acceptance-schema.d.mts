export const V083_ACCEPTANCE_SCHEMA_VERSION: "consumer-authority-v083-acceptance.1"

export class V083AcceptanceManifestError extends Error {
  readonly code: "v083-acceptance-schema"
}

export type V083AcceptanceManifest = Readonly<Record<string, unknown>> & Readonly<{
  acceptanceResponsibilities: Readonly<{
    package: Readonly<{
      excludes: readonly string[]
      requires: readonly string[]
    }>
    sourceAndProtectedUbuntuCi: Readonly<{
      requires: readonly string[]
    }>
  }>
  hostedResidual: Readonly<{
    whyLocalCannotClose: string
  }>
  package: Readonly<{
    channel: string
    scope: string
    version: string
  }>
  prearmedExternalHandoff: Readonly<{
    finalObserverProcedure: Readonly<{
      observerGhSelection: string
    }>
  }>
  v082HistoricalRelease: Readonly<{
    reusableForV083: boolean
    version: string
  }>
}>

export function canonicalV083AcceptanceManifest(): V083AcceptanceManifest
export function readV083AcceptanceManifest(packageRoot: string): V083AcceptanceManifest
export function parseV083AcceptanceManifest(value: unknown, packageVersion: string): V083AcceptanceManifest
