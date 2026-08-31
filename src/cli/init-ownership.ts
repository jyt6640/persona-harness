import {
  INIT_MANIFEST_RELATIVE_PATH,
  InitManifestError,
  sha256Bytes,
  type InitManifest,
  type InitPackageBinding,
} from "./init-manifest.js"

const MANAGED_PATH_PREFIXES = [
  ".persona/",
  ".agents/skills/",
  ".claude/skills/",
  ".opencode/opencode.json",
  ".opencode/skills/",
  ".gitignore",
  "AGENTS.md",
] as const

export type InitProfileBindingCheck =
  | { readonly kind: "exact"; readonly digest: string | null }
  | { readonly kind: "replacement-authorized" }

export type InitOwnershipContext = {
  readonly ownedFileCheck: { readonly kind: "attach-repair-staging" } | { readonly kind: "exact" }
  readonly packageBinding?: InitPackageBinding
  readonly profileBinding: InitProfileBindingCheck
  readonly projectRealPath: string
  readonly readOwnedFile: (relativePath: string) => Buffer | undefined
}

export type VerifiedInitOwnership = {
  readonly manifest: InitManifest
  readonly ownedFiles: ReadonlyMap<string, Buffer>
}

function managedPath(relativePath: string): boolean {
  return MANAGED_PATH_PREFIXES.some((prefix) => relativePath === prefix || relativePath.startsWith(prefix))
}

function assertPackageBinding(manifest: InitManifest, current: InitPackageBinding): void {
  if (manifest.package.name !== current.name) {
    throw new InitManifestError("Package binding mismatch; no files were changed.")
  }
  if (manifest.package.version === current.version && manifest.package.templateDigest !== current.templateDigest) {
    throw new InitManifestError("Package binding mismatch; no files were changed.")
  }
}

function assertProfileBinding(manifest: InitManifest, check: InitProfileBindingCheck): void {
  switch (check.kind) {
    case "exact":
      if (manifest.project.profileDigest !== check.digest) {
        throw new InitManifestError("Project profile binding mismatch; no files were changed.")
      }
      return
    case "replacement-authorized":
      return
  }
}

export function verifyInitOwnership(
  manifest: InitManifest,
  context: InitOwnershipContext,
): VerifiedInitOwnership {
  if (manifest.project.realPath !== context.projectRealPath) {
    throw new InitManifestError("Project binding mismatch; no files were changed.")
  }
  assertProfileBinding(manifest, context.profileBinding)
  if (context.packageBinding !== undefined) assertPackageBinding(manifest, context.packageBinding)

  const ownedFiles = new Map<string, Buffer>()
  for (const entry of manifest.files) {
    if (!managedPath(entry.path) || entry.path === INIT_MANIFEST_RELATIVE_PATH) {
      throw new InitManifestError(`Init ownership manifest contains an unsupported path: ${entry.path}`)
    }
    const current = context.readOwnedFile(entry.path)
    const repairHarness = context.ownedFileCheck.kind === "attach-repair-staging"
      && entry.path === ".persona/harness.jsonc"
    if (current === undefined || (sha256Bytes(current) !== entry.digest && !repairHarness)) {
      throw new InitManifestError(`Init ownership conflict at ${entry.path}; no files were changed.`)
    }
    ownedFiles.set(entry.path, current)
  }
  return { manifest, ownedFiles }
}
