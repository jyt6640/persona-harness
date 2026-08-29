export const CONTEXT_COMPATIBILITY_MANIFEST_SCHEMA_VERSION: "persona-context-compatibility-manifest.1"
export const CONTEXT_COMPATIBILITY_RESULT_SCHEMA_VERSION: "persona-context-compatibility-result.1"

export type ContextCompatibilityManifest = {
  readonly package: {
    readonly contentIdentity: {
      readonly contentSha256: string
      readonly entryCount: number
      readonly identitySha256: string
      readonly modeCounts: Readonly<Record<string, number>>
      readonly schemaVersion: "package-content-identity.1"
    }
    readonly name: "persona-harness"
    readonly tarballSha256: string
    readonly version: string
  }
  readonly requiredPackagePaths: readonly string[]
  readonly scenarios: readonly (
    | "status-default"
    | "preview-safe-target"
    | "explain-safe-target"
    | "init-preview-no-write"
    | "init-enable-no-overwrite"
    | "invalid-config"
  )[]
  readonly schemaVersion: "persona-context-compatibility-manifest.1"
  readonly sourceFallback: false
}

export type ContextCompatibilityResult = {
  readonly code: string
  readonly schemaVersion: "persona-context-compatibility-result.1"
  readonly state: "BLOCKED" | "PASS"
}

export class ContextCompatibilityManifestError extends Error {
  readonly code: string
}

export function parseContextCompatibilityManifest(value: unknown): ContextCompatibilityManifest

export function runContextCompatibilityManifest(
  manifest: unknown,
  options: {
    readonly archivePath: string
    readonly installedPackageRoot: string
    readonly sourceRoot: string
    readonly temporaryRoot: string
  },
): ContextCompatibilityResult
