export const PACKAGE_CONTENT_IDENTITY_SCHEMA_VERSION: "package-content-identity.1"
export const MAX_PACKAGE_CONTENT_TARBALL_BYTES: number
export const PACKAGE_CONTENT_MAX_MEMBER_BYTES: number
export const PACKAGE_CONTENT_MAX_MANIFEST_BYTES: number

export type PackageContentIdentity = {
  readonly schemaVersion: "package-content-identity.1"
  readonly contentSha256: string
  readonly identitySha256: string
  readonly entryCount: number
  readonly modeCounts: Readonly<Partial<Record<"0600" | "0644" | "0700" | "0755", number>>>
}

export class PackageContentIdentityError extends Error {
  readonly code: string
}

export function readPackageContentIdentity(bytes: Buffer): PackageContentIdentity
export function assertWindowsPackageInstallSurface(bytes: Buffer): void
export function readPackageTarball(bytes: Buffer): {
  readonly identity: PackageContentIdentity
  readonly manifest: { readonly name: string; readonly version: string }
}
export function canonicalizePackageTarball(bytes: Buffer): {
  readonly bytes: Buffer
  readonly identity: PackageContentIdentity
  readonly manifest: { readonly name: string; readonly version: string }
}
export function classifyPackageContentIdentity(
  expected: PackageContentIdentity,
  observed: PackageContentIdentity,
): "match" | "entry-count-mismatch" | "content-mismatch" | "mode-mismatch" | "content-and-mode-mismatch" | "entry-count-and-content-mismatch" | "entry-count-and-mode-mismatch" | "entry-count-and-content-and-mode-mismatch" | "structure-mismatch"
export function assertPackageContentIdentity(value: unknown): PackageContentIdentity
