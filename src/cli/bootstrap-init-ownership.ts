import { realpathSync } from "node:fs"

import type { BootstrapWriteBoundary } from "../io/bootstrap-write-boundary.js"
import {
  createInitManifest,
  INIT_MANIFEST_RELATIVE_PATH,
  InitManifestError,
  parseInitManifestBytes,
  serializeInitManifest,
  sha256Bytes,
  type InitManifestFile,
} from "./init-manifest.js"
import { verifyInitOwnership, type VerifiedInitOwnership } from "./init-ownership.js"
import { PROFILE_PATH } from "./intake-profile.js"

const HARNESS_CONFIG_PATH = ".persona/harness.jsonc"
const OPENCODE_CONFIG_PATH = ".opencode/opencode.json"

export type BootstrapInitOwnershipChanges = {
  readonly harness: boolean
  readonly openCode: boolean
  readonly profile: boolean
}

export type BootstrapInitOwnershipContext =
  | { readonly kind: "attach-fresh-staging"; readonly projectRealPath: string }
  | { readonly kind: "attach-repair-staging"; readonly projectRealPath: string }
  | { readonly kind: "current-project" }

export function prepareBootstrapInitOwnership(
  boundary: BootstrapWriteBoundary,
  changes: BootstrapInitOwnershipChanges,
  context: BootstrapInitOwnershipContext,
): VerifiedInitOwnership {
  const manifestBytes = boundary.readProjectFile(INIT_MANIFEST_RELATIVE_PATH)
  if (manifestBytes === undefined) {
    throw new InitManifestError("Init ownership manifest is missing; no files were changed.")
  }
  const profileBytes = boundary.readProjectFile(PROFILE_PATH)
  const verified = verifyInitOwnership(parseInitManifestBytes(manifestBytes), {
    ownedFileCheck: context.kind === "attach-repair-staging"
      ? { kind: "attach-repair-staging" }
      : { kind: "exact" },
    profileBinding: changes.profile
      ? { kind: "replacement-authorized" }
      : { kind: "exact", digest: profileBytes === undefined ? null : sha256Bytes(profileBytes) },
    projectRealPath: context.kind === "attach-repair-staging"
      ? context.projectRealPath
      : realpathSync("."),
    readOwnedFile: (relativePath) => boundary.readProjectFile(relativePath),
  })
  for (const path of [
    ...(changes.harness ? [HARNESS_CONFIG_PATH] : []),
    ...(changes.openCode ? [OPENCODE_CONFIG_PATH] : []),
  ]) {
    if (!verified.ownedFiles.has(path)) {
      throw new InitManifestError(`Init ownership manifest does not own bootstrap target ${path}.`)
    }
  }
  return verified
}

export function finalizeBootstrapInitOwnership(
  boundary: BootstrapWriteBoundary,
  verified: VerifiedInitOwnership,
  changes: BootstrapInitOwnershipChanges,
  context: BootstrapInitOwnershipContext,
): void {
  const allowedChanges = new Set([
    ...(changes.harness ? [HARNESS_CONFIG_PATH] : []),
    ...(changes.openCode ? [OPENCODE_CONFIG_PATH] : []),
  ])
  const files: InitManifestFile[] = verified.manifest.files.map((entry) => {
    const current = boundary.readProjectFile(entry.path)
    if (current === undefined) {
      throw new InitManifestError(`Init ownership conflict at ${entry.path}; no files were changed.`)
    }
    const digest = sha256Bytes(current)
    if (digest !== entry.digest && !allowedChanges.has(entry.path)) {
      throw new InitManifestError(`Init ownership conflict at ${entry.path}; no files were changed.`)
    }
    return { ...entry, digest }
  })
  const profileBytes = boundary.readProjectFile(PROFILE_PATH)
  const profileDigest = profileBytes === undefined ? null : sha256Bytes(profileBytes)
  if (!changes.profile && profileDigest !== verified.manifest.project.profileDigest) {
    throw new InitManifestError("Project profile binding mismatch; no files were changed.")
  }
  const manifest = createInitManifest(
    verified.manifest.package,
    {
      ...verified.manifest.project,
      profileDigest,
      realPath: context.kind === "current-project" ? verified.manifest.project.realPath : context.projectRealPath,
    },
    files,
  )
  boundary.writeProjectFileAtomically(INIT_MANIFEST_RELATIVE_PATH, serializeInitManifest(manifest))
}
