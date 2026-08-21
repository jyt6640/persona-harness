export const V0819_ACCEPTANCE_SCHEMA_VERSION: "consumer-authority-v0819-acceptance.1"

export class V0819AcceptanceManifestError extends Error {
  readonly code: "v0819-acceptance-schema"
}

export type V0819AcceptanceManifest = Readonly<Record<string, unknown>> & Readonly<{
  readonly authority: Readonly<{
    readonly readOnlyVerify: Readonly<{
      readonly archiveInput: Readonly<{
        readonly ancestorDirectoryChurn: string
        readonly arbitrarySymlinkAncestorOrLeaf: string
        readonly darwinSystemTemporaryAlias: string
        readonly directParentIntegrity: string
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

export function canonicalV0819AcceptanceManifest(): V0819AcceptanceManifest
export function readV0819AcceptanceManifest(packageRoot: string): V0819AcceptanceManifest
export function parseV0819AcceptanceManifest(value: unknown, packageVersion: string): V0819AcceptanceManifest
