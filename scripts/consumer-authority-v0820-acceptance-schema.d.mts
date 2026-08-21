export const V0820_ACCEPTANCE_SCHEMA_VERSION: "consumer-authority-v0820-acceptance.1"

export class V0820AcceptanceManifestError extends Error {
  readonly code: "v0820-acceptance-schema"
}

export type V0820AcceptanceManifest = Readonly<Record<string, unknown>> & Readonly<{
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
  readonly initialization: Readonly<{
    readonly packageTemplateIdentity: string
    readonly repairStaging: string
  }>
}>

export function canonicalV0820AcceptanceManifest(): V0820AcceptanceManifest
export function readV0820AcceptanceManifest(packageRoot: string): V0820AcceptanceManifest
export function parseV0820AcceptanceManifest(value: unknown, packageVersion: string): V0820AcceptanceManifest
