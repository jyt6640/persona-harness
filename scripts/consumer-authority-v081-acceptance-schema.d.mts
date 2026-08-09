export const V081_ACCEPTANCE_SCHEMA_VERSION: "consumer-authority-v081-acceptance.1"

export class V081AcceptanceManifestError extends Error {
  readonly code: "v081-acceptance-schema"
}

export type V081AcceptanceManifest = Readonly<Record<string, unknown>> & Readonly<{
  package: Readonly<{
    version: string
  }>
}>

export function canonicalV081AcceptanceManifest(): V081AcceptanceManifest
export function readV081AcceptanceManifest(packageRoot: string): V081AcceptanceManifest
export function parseV081AcceptanceManifest(value: unknown, packageVersion: string): V081AcceptanceManifest
