export const V0821_ACCEPTANCE_SCHEMA_VERSION: "consumer-authority-v0821-acceptance.1"

export class V0821AcceptanceManifestError extends Error {
  readonly code: "v0821-acceptance-schema"
}

export type V0821AcceptanceManifest = Readonly<Record<string, unknown>> & Readonly<{
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
  readonly projectFinishSourceIdentity: Readonly<{
    readonly adoptedInstructionPolicy: string
    readonly repairInferenceObservations: string
  }>
}>

export function canonicalV0821AcceptanceManifest(): V0821AcceptanceManifest
export function readV0821AcceptanceManifest(packageRoot: string): V0821AcceptanceManifest
export function parseV0821AcceptanceManifest(value: unknown, packageVersion: string): V0821AcceptanceManifest
