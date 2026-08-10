export const V082_ACCEPTANCE_SCHEMA_VERSION: "consumer-authority-v082-acceptance.1"

export class V082AcceptanceManifestError extends Error {
  readonly code: "v082-acceptance-schema"
}

export type V082AcceptanceManifest = Readonly<Record<string, unknown>> & Readonly<{
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
}>

export function canonicalV082AcceptanceManifest(): V082AcceptanceManifest
export function readV082AcceptanceManifest(packageRoot: string): V082AcceptanceManifest
export function parseV082AcceptanceManifest(value: unknown, packageVersion: string): V082AcceptanceManifest
