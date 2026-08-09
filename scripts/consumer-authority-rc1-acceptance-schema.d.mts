export const RC1_ACCEPTANCE_SCHEMA_VERSION: "consumer-authority-rc1-acceptance.1"

export class Rc1AcceptanceManifestError extends Error {
  readonly code: "rc1-acceptance-schema"
}

export type Rc1AcceptanceManifest = Readonly<Record<string, unknown>> & Readonly<{
  package: Readonly<{
    version: string
  }>
}>

export function canonicalRc1AcceptanceManifest(): Rc1AcceptanceManifest
export function readRc1AcceptanceManifest(packageRoot: string): Rc1AcceptanceManifest
export function parseRc1AcceptanceManifest(value: unknown, packageVersion: string): Rc1AcceptanceManifest
