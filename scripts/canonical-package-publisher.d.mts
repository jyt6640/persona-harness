export const CANONICAL_PUBLISHER_RUNTIME: Readonly<{ readonly node: "24.18.0"; readonly npm: "11.16.0" }>
export const CANONICAL_PACKAGE_PUBLISHER_SCHEMA_VERSION: "canonical-package-publisher.1"
export const CANONICAL_PACKAGE_PUBLISHER_PLAN_SCHEMA_VERSION: "canonical-package-publisher-plan.1"

export class CanonicalPackagePublisherError extends Error {
  readonly code: string
}

export type CanonicalPublisherRuntime = Readonly<{ readonly node: string; readonly npm: string }>
export type CanonicalPublisherEnvironment = Readonly<{
  readonly HOME: string
  readonly NPM_CONFIG_CACHE: string
  readonly NPM_CONFIG_GLOBALCONFIG: string
  readonly NPM_CONFIG_USERCONFIG: string
}>

export function assertCanonicalPublisherRuntime(value: unknown): Readonly<{ readonly node: "24.18.0"; readonly npm: "11.16.0" }>
export function canonicalPackagePublisherPlan(): Readonly<Record<string, unknown>>
export function parseCanonicalPackagePublisherPlan(value: unknown): Readonly<Record<string, unknown>>
export function createCanonicalPublisherArgs(input: Readonly<{
  readonly dryRun: boolean
  readonly distTag: string
  readonly tarballPath: string
}>): readonly string[]
export function verifyCanonicalPublisherHandoff(input: Readonly<{
  readonly canonicalDirectory: string
  readonly dryRun: boolean
  readonly distTag: string
  readonly packageFactsPath: string
  readonly publisherEnvironment: CanonicalPublisherEnvironment
  readonly publisherRuntime: CanonicalPublisherRuntime
  readonly publisherRuntimeDirectory: string
  readonly tarballPath: string
}>): Readonly<{
  readonly argv: readonly string[]
  readonly canonicalPackerRuntime: Readonly<Record<string, unknown>>
  readonly package: Readonly<{ readonly name: string; readonly version: string }>
  readonly publisherEnvironment: CanonicalPublisherEnvironment
  readonly publisherRuntime: Readonly<{ readonly node: "24.18.0"; readonly npm: "11.16.0" }>
  readonly schemaVersion: "canonical-package-publisher.1"
  readonly status: "passed"
  readonly tarballSha256: string
}>

export function isSafeVersion(value: unknown): boolean
