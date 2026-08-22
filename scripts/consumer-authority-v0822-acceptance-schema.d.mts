export const V0822_ACCEPTANCE_SCHEMA_VERSION: "consumer-authority-v0822-acceptance.1"

export class V0822AcceptanceManifestError extends Error {
  readonly code: "v0822-acceptance-schema"
}

export type V0822AcceptanceManifest = Readonly<Record<string, unknown>> & Readonly<{
  readonly authority: Readonly<{
    readonly readOnlyVerify: Readonly<{
      readonly archiveInput: Readonly<{
        readonly ancestorDirectoryChurn: string
        readonly arbitrarySymlinkAncestorOrLeaf: string
        readonly darwinSystemTemporaryAlias: string
        readonly directParentIntegrity: string
        readonly nonDarwin: string
      }>
      readonly artifactDigestInput: string
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

export function canonicalV0822AcceptanceManifest(): V0822AcceptanceManifest
export function readV0822AcceptanceManifest(packageRoot: string): V0822AcceptanceManifest
export function parseV0822AcceptanceManifest(value: unknown, packageVersion: string): V0822AcceptanceManifest
