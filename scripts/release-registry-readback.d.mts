export type ReleaseRegistryReadback = {
  readonly diagnostics: readonly string[]
  readonly distTag: string
  readonly package: "persona-harness"
  readonly provenance: "requires-staged-artifact-attestation"
  readonly registry: {
    readonly gitHead: string
    readonly integrity: string
    readonly shasum: string
    readonly tarballSha256: string
    readonly contentIdentity: {
      readonly schemaVersion: "package-content-identity.1"
      readonly contentSha256: string
      readonly identitySha256: string
      readonly entryCount: number
      readonly modeCounts: Readonly<Partial<Record<"0600" | "0644" | "0700" | "0755", number>>>
    }
    readonly version: string
  }
  readonly registryMutation: "not-performed"
  readonly schemaVersion: "release-registry-readback.3"
  readonly secretRemovalConfirmed: true
  readonly sourceHead: string
  readonly status: "blocked" | "passed"
  readonly version: string
}

export function assessReleaseRegistryReadback(input: unknown): ReleaseRegistryReadback
export function readReleaseRegistryReadback(root: string, expected: unknown): ReleaseRegistryReadback
export function readCanonicalPackageFacts(path: string): unknown | undefined
export function assessCanonicalPackageFacts(path: string): { readonly status: "ready"; readonly value: unknown } | { readonly status: "blocked"; readonly code: "release-registry-package-facts-path" | "release-registry-package-facts-shape" | "release-registry-package-facts-package" | "release-registry-package-facts-tarball" | "release-registry-package-facts-toolchain" }
export function parseReleaseRegistryReadbackArguments(args: readonly string[]): unknown | undefined
