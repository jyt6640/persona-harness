export const V0818_ACCEPTANCE_SCHEMA_VERSION: "consumer-authority-v0818-acceptance.1"

export class V0818AcceptanceManifestError extends Error {
  readonly code: "v0818-acceptance-schema"
}

export type V0818AcceptanceManifest = Readonly<Record<string, unknown>> & Readonly<{
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

export function canonicalV0818AcceptanceManifest(): V0818AcceptanceManifest
export function readV0818AcceptanceManifest(packageRoot: string): V0818AcceptanceManifest
export function parseV0818AcceptanceManifest(value: unknown, packageVersion: string): V0818AcceptanceManifest
