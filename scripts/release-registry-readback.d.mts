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
    readonly version: string
  }
  readonly registryMutation: "not-performed"
  readonly schemaVersion: "release-registry-readback.1"
  readonly secretRemovalConfirmed: true
  readonly sourceHead: string
  readonly status: "blocked" | "passed"
  readonly version: string
}

export function assessReleaseRegistryReadback(input: unknown): ReleaseRegistryReadback
export function readReleaseRegistryReadback(root: string, expected: unknown): ReleaseRegistryReadback
