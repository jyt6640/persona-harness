export const V0817_ACCEPTANCE_SCHEMA_VERSION: "consumer-authority-v0817-acceptance.1"

export class V0817AcceptanceManifestError extends Error {
  readonly code: "v0817-acceptance-schema"
}

export type V0817AcceptanceManifest = Readonly<Record<string, unknown>> & Readonly<{
  readonly authority: Readonly<{
    readonly readOnlyVerify: Readonly<{
      readonly archiveInput: Readonly<{
        readonly arbitrarySymlinkAncestorOrLeaf: string
        readonly darwinSystemTemporaryAlias: string
        readonly nonDarwin: string
      }>
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

export function canonicalV0817AcceptanceManifest(): V0817AcceptanceManifest
export function readV0817AcceptanceManifest(packageRoot: string): V0817AcceptanceManifest
export function parseV0817AcceptanceManifest(value: unknown, packageVersion: string): V0817AcceptanceManifest
