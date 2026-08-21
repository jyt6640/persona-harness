export const V0815_ACCEPTANCE_SCHEMA_VERSION: "consumer-authority-v0815-acceptance.1"

export class V0815AcceptanceManifestError extends Error {
  readonly code: "v0815-acceptance-schema"
}

export type V0815AcceptanceManifest = Readonly<Record<string, unknown>> & Readonly<{
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

export function canonicalV0815AcceptanceManifest(): V0815AcceptanceManifest
export function readV0815AcceptanceManifest(packageRoot: string): V0815AcceptanceManifest
export function parseV0815AcceptanceManifest(value: unknown, packageVersion: string): V0815AcceptanceManifest
