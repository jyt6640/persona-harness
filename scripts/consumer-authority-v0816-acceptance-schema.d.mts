export const V0816_ACCEPTANCE_SCHEMA_VERSION: "consumer-authority-v0816-acceptance.1"

export class V0816AcceptanceManifestError extends Error {
  readonly code: "v0816-acceptance-schema"
}

export type V0816AcceptanceManifest = Readonly<Record<string, unknown>> & Readonly<{
  readonly authority: Readonly<{
    readonly readOnlyVerify: Readonly<{
      readonly command: string
      readonly noCredentialFetchStoreConsumeFinishReplay: boolean
      readonly schemaVersion: string
    }>
  }>
  readonly package: Readonly<{
    readonly channel: string
    readonly scope: string
    readonly version: string
  }>
}>

export function canonicalV0816AcceptanceManifest(): V0816AcceptanceManifest
export function readV0816AcceptanceManifest(packageRoot: string): V0816AcceptanceManifest
export function parseV0816AcceptanceManifest(value: unknown, packageVersion: string): V0816AcceptanceManifest
