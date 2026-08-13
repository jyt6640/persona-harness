import type { PackageContentIdentity } from "./package-content-identity.mjs"

export const CANONICAL_PACKAGE_PACKER_SCHEMA_VERSION: "canonical-package-packer.1"
export const CANONICAL_PACKAGE_PACKER_PROFILE: {
  readonly locale: "C"
  readonly node: "20.19.0"
  readonly npm: "10.8.2"
  readonly timezone: "UTC"
  readonly umask: "0022"
}

export class CanonicalPackagePackerError extends Error {
  readonly code: string
}

export function resolveCanonicalNpmCli(
  nodeExecutable?: string,
  npmCliPath?: string,
): { readonly nodeExecutable: string; readonly npmCliPath: string }
export function canonicalNpmInvocation(
  args: readonly string[],
  nodeExecutable?: string,
  npmCliPath?: string,
): readonly string[]

export function assertCanonicalPackagePackerProfile(value: unknown): typeof CANONICAL_PACKAGE_PACKER_PROFILE
export function canonicalPackageFacts(
  bytes: Buffer,
  identity: { readonly name: string; readonly version: string },
  profile?: typeof CANONICAL_PACKAGE_PACKER_PROFILE,
): {
  readonly package: { readonly name: string; readonly version: string }
  readonly schemaVersion: "canonical-package-packer.1"
  readonly tarball: {
    readonly contentIdentity: PackageContentIdentity
    readonly sha256: string
    readonly size: number
  }
  readonly toolchain: typeof CANONICAL_PACKAGE_PACKER_PROFILE
}
export function createCanonicalNpmEnvironment(root: string, workspace: string, nodeExecutable: string): Record<string, string>
export function createCanonicalPackageTarball(
  root: string,
  outputDirectory: string,
  runtime?: {
    readonly nodeExecutable?: string
    readonly npmCliPath?: string
    readonly profile?: typeof CANONICAL_PACKAGE_PACKER_PROFILE
  },
): {
  readonly facts: ReturnType<typeof canonicalPackageFacts>
  readonly factsPath: string
  readonly tarballPath: string
}
