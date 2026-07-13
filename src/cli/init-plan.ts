import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs"
import { join, relative, resolve, sep } from "node:path"
import process from "node:process"

import type { InitOptions } from "./init.js"
import {
  createInitManifest,
  INIT_MANIFEST_RELATIVE_PATH,
  readInitManifest,
  sha256Bytes,
  type InitManifest,
  type InitManifestFile,
  type InitPackageBinding,
  type InitProjectBinding,
} from "./init-manifest.js"
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

const MANAGED_PATH_PREFIXES = [".persona/", ".opencode/opencode.json", ".gitignore", "AGENTS.md"] as const

export type PreparedInit = {
  readonly currentManifest: InitManifest | null
  readonly manifest: InitManifest
  readonly packageRoot: string
  readonly pluginPath: string
  readonly projectDir: string
  readonly targets: readonly InitTarget[]
}

function managedPath(relativePath: string): boolean {
  return MANAGED_PATH_PREFIXES.some((prefix) => relativePath === prefix || relativePath.startsWith(prefix))
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

function assertManifestBinding(
  projectDir: string,
  manifest: InitManifest,
  currentPackage: InitPackageBinding,
  currentProfileDigest: string | null,
): void {
  if (manifest.project.realPath !== realpathSync(projectDir)) {
    throw new InitManifestError("Project binding mismatch; no files were changed.")
  }
  if (manifest.project.profileDigest !== currentProfileDigest) {
    throw new InitManifestError("Project profile binding mismatch; no files were changed.")
  }
  if (manifest.package.name !== currentPackage.name) {
    throw new InitManifestError("Package binding mismatch; no files were changed.")
  }
  if (
    manifest.package.version === currentPackage.version
    && manifest.package.templateDigest !== currentPackage.templateDigest
  ) {
    throw new InitManifestError("Package binding mismatch; no files were changed.")
  }
  for (const entry of manifest.files) {
    if (!managedPath(entry.path) || entry.path === INIT_MANIFEST_RELATIVE_PATH) {
      throw new InitManifestError(`Init ownership manifest contains an unsupported path: ${entry.path}`)
    }
    const current = existingBytes(projectDir, entry.path)
    if (current === null || sha256Bytes(current) !== entry.digest) {
      throw new InitManifestError(`Init ownership conflict at ${entry.path}; no files were changed.`)
    }
  }
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

function nextManifest(
  projectDir: string,
  packageRoot: string,
  targets: readonly InitTarget[],
  current: InitManifest | null,
): InitManifest {
  const currentProfileDigest = profileDigest(projectDir)
  const currentPackage = packageBinding(packageRoot, sourceTemplateDigest(targets))
  if (current !== null) {
    assertManifestBinding(projectDir, current, currentPackage, currentProfileDigest)
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
  return createInitManifest(currentPackage, projectBinding, [...nextByPath.values()])
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

export function prepareInit(options: InitOptions, defaultPackageRoot: string): PreparedInit {
  const projectDir = resolve(options.projectDir ?? process.cwd())
  const packageRoot = resolve(options.packageRoot ?? defaultPackageRoot)
  const pluginPath = join(packageRoot, "dist", "index.js")
  const currentManifest = readInitManifest(projectDir)
  if (currentManifest === null && partialInitialization(projectDir)) {
    throw new InitManifestError("A partial or unrecognized Persona Harness initialization exists; no files were changed.")
  }
  const targets = buildTargets(projectDir, packageRoot, pluginPath)
  return {
    currentManifest,
    manifest: nextManifest(projectDir, packageRoot, targets, currentManifest),
    packageRoot,
    pluginPath,
    projectDir,
    targets,
  }
}
