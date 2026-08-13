import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs"
import { join, relative, resolve, sep } from "node:path"
import process from "node:process"

import type { InitOptions } from "./init.js"
import { preserveBootstrapHarnessOptIns } from "./init-harness-overlay.js"
import {
  createInitManifest,
  readInitManifest,
  sha256Bytes,
  type InitManifest,
  type InitManifestFile,
  type InitPackageBinding,
  type InitProjectBinding,
} from "./init-manifest.js"
import { verifyInitOwnership, type VerifiedInitOwnership } from "./init-ownership.js"
import {
  buildTargets,
  ensureRegularOrMissing,
  isMissing,
  packageBinding,
  profileDigest,
  sourceTemplateDigest,
} from "./init-source.js"
import type { InitTarget } from "./init-transaction.js"
import { InitManifestError } from "./init-manifest.js"

export type PreparedInit = {
  readonly currentManifest: InitManifest | null
  readonly manifest: InitManifest
  readonly packageRoot: string
  readonly pluginPath: string
  readonly projectDir: string
  readonly targets: readonly InitTarget[]
}

function ensureNoFollowPath(projectDir: string, relativePath: string): void {
  const root = resolve(projectDir)
  const target = resolve(root, relativePath)
  const escaped = relative(root, target)
  if (escaped === ".." || escaped.startsWith(`..${sep}`) || escaped.startsWith(sep)) {
    throw new InitManifestError(`Init target escapes the project root: ${relativePath}`)
  }
  let current = root
  for (const segment of relativePath.split("/")) {
    current = join(current, segment)
    if (isMissing(current)) {
      return
    }
    const stat = lstatSync(current)
    if (stat.isSymbolicLink()) {
      throw new InitManifestError(`Init target contains a symbolic link: ${relativePath}`)
    }
    if (current !== target && !stat.isDirectory()) {
      throw new InitManifestError(`Init target parent is not a directory: ${relativePath}`)
    }
  }
}

function existingBytes(projectDir: string, relativePath: string): Buffer | null {
  ensureNoFollowPath(projectDir, relativePath)
  const path = join(projectDir, relativePath)
  if (isMissing(path)) {
    return null
  }
  ensureRegularOrMissing(path, relativePath)
  return readFileSync(path)
}

function verifiedManifestBinding(
  projectDir: string,
  manifest: InitManifest,
  currentPackage: InitPackageBinding,
  currentProfileDigest: string | null,
): VerifiedInitOwnership {
  return verifyInitOwnership(manifest, {
    ownedFileCheck: { kind: "exact" },
    packageBinding: currentPackage,
    profileBinding: { kind: "exact", digest: currentProfileDigest },
    projectRealPath: realpathSync(projectDir),
    readOwnedFile: (relativePath) => existingBytes(projectDir, relativePath) ?? undefined,
  })
}

function rejectForeignNewTargets(
  projectDir: string,
  manifest: InitManifest,
  targets: readonly InitTarget[],
): void {
  const ownedPaths = new Set(manifest.files.map((entry) => entry.path))
  for (const target of targets) {
    if (ownedPaths.has(target.relativePath)) {
      continue
    }
    if (existingBytes(projectDir, target.relativePath) !== null) {
      throw new InitManifestError(`Init ownership conflict at ${target.relativePath}; no files were changed.`)
    }
  }
}

function nextInitState(
  projectDir: string,
  packageRoot: string,
  sourceTargets: readonly InitTarget[],
  current: InitManifest | null,
): { readonly manifest: InitManifest; readonly targets: readonly InitTarget[] } {
  const currentProfileDigest = profileDigest(projectDir)
  const currentPackage = packageBinding(packageRoot, sourceTemplateDigest(sourceTargets))
  let verified: VerifiedInitOwnership | undefined
  if (current !== null) {
    verified = verifiedManifestBinding(projectDir, current, currentPackage, currentProfileDigest)
  }
  const targets = verified === undefined
    ? sourceTargets
    : preserveBootstrapHarnessOptIns(sourceTargets, verified.ownedFiles)
  if (current !== null) {
    rejectForeignNewTargets(projectDir, current, targets)
  }
  const projectBinding: InitProjectBinding = {
    realPath: realpathSync(projectDir),
    profileDigest: currentProfileDigest,
  }
  const currentByPath = new Map(current?.files.map((entry) => [entry.path, entry]) ?? [])
  const nextByPath = new Map(
    targets.map((target): [string, InitManifestFile] => [
      target.relativePath,
      {
        path: target.relativePath,
        owner: "persona-harness",
        marker: "ph-init-owned-v1",
        digest: sha256Bytes(target.nextBytes),
      },
    ]),
  )
  for (const [path, entry] of currentByPath) {
    if (!nextByPath.has(path)) {
      nextByPath.set(path, entry)
    }
  }
  return {
    manifest: createInitManifest(currentPackage, projectBinding, [...nextByPath.values()]),
    targets,
  }
}

function partialInitialization(projectDir: string): boolean {
  const personaPath = join(projectDir, ".persona")
  if (isMissing(personaPath)) {
    return false
  }
  const stat = lstatSync(personaPath)
  if (stat.isSymbolicLink()) {
    throw new InitManifestError("The .persona directory is a symbolic link; no files were changed.")
  }
  if (!stat.isDirectory()) {
    throw new InitManifestError("The .persona path is not a directory; no files were changed.")
  }
  return true
}

function prepareBootstrapPersonaTargets(
  projectDir: string,
  targets: readonly InitTarget[],
): readonly InitTarget[] {
  const harnessBytes = existingBytes(projectDir, ".persona/harness.jsonc")
  const effectiveTargets = harnessBytes === null
    ? targets
    : preserveBootstrapHarnessOptIns(targets, new Map([[".persona/harness.jsonc", harnessBytes]]))
  for (const target of effectiveTargets) {
    if (!target.relativePath.startsWith(".persona/")) continue
    const current = existingBytes(projectDir, target.relativePath)
    if (current !== null && !current.equals(target.nextBytes)) {
      throw new InitManifestError(
        `A preinitialized Persona directory already contains init target ${target.relativePath}; no files were changed.`,
      )
    }
  }
  return effectiveTargets
}

export function prepareInit(options: InitOptions, defaultPackageRoot: string): PreparedInit {
  const projectDir = resolve(options.projectDir ?? process.cwd())
  const packageRoot = resolve(options.packageRoot ?? defaultPackageRoot)
  const pluginPath = join(packageRoot, "dist", "index.js")
  const currentManifest = readInitManifest(projectDir)
  const partialPersona = currentManifest === null && partialInitialization(projectDir)
  if (partialPersona && options.bootstrapPersonaState?.kind !== "preinitialized") {
    throw new InitManifestError("A partial or unrecognized Persona Harness initialization exists; no files were changed.")
  }
  const builtTargets = buildTargets(projectDir, packageRoot, pluginPath)
  const sourceTargets = partialPersona ? prepareBootstrapPersonaTargets(projectDir, builtTargets) : builtTargets
  const state = nextInitState(projectDir, packageRoot, sourceTargets, currentManifest)
  return {
    currentManifest,
    manifest: state.manifest,
    packageRoot,
    pluginPath,
    projectDir,
    targets: state.targets,
  }
}
