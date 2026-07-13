import { createHash } from "node:crypto"
import { existsSync, lstatSync, readFileSync } from "node:fs"
import { join, relative, resolve, sep } from "node:path"

import { isRecord } from "../config/jsonc.js"

export const INIT_MANIFEST_RELATIVE_PATH = ".persona/.ph-init-manifest.json"
export const INIT_OWNERSHIP_MARKER = "ph-init-owned-v1"
export const INIT_MANIFEST_SCHEMA = "persona-harness.init-manifest.v1"

export type InitManifestFile = {
  readonly path: string
  readonly owner: "persona-harness"
  readonly marker: typeof INIT_OWNERSHIP_MARKER
  readonly digest: string
}

export type InitPackageBinding = {
  readonly name: string
  readonly version: string
  readonly templateDigest: string
}

export type InitProjectBinding = {
  readonly realPath: string
  readonly profileDigest: string | null
}

export type InitManifest = {
  readonly schema: typeof INIT_MANIFEST_SCHEMA
  readonly marker: typeof INIT_OWNERSHIP_MARKER
  readonly package: InitPackageBinding
  readonly project: InitProjectBinding
  readonly files: readonly InitManifestFile[]
  readonly manifestDigest: string
}

export class InitManifestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "InitManifestError"
  }
}

export function sha256Bytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex")
}

export function sha256Text(text: string): string {
  return sha256Bytes(Buffer.from(text, "utf8"))
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stable)
  }
  if (isRecord(value)) {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
  }
  return value
}

function withoutDigest(manifest: Omit<InitManifest, "manifestDigest">): unknown {
  return {
    schema: manifest.schema,
    marker: manifest.marker,
    package: manifest.package,
    project: manifest.project,
    files: manifest.files,
  }
}

function manifestDigest(manifest: Omit<InitManifest, "manifestDigest">): string {
  return sha256Text(JSON.stringify(stable(withoutDigest(manifest))))
}

export function serializeInitManifest(manifest: InitManifest): Buffer {
  return Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8")
}

export function createInitManifest(
  packageBinding: InitPackageBinding,
  projectBinding: InitProjectBinding,
  files: readonly InitManifestFile[],
): InitManifest {
  const base: Omit<InitManifest, "manifestDigest"> = {
    schema: INIT_MANIFEST_SCHEMA,
    marker: INIT_OWNERSHIP_MARKER,
    package: packageBinding,
    project: projectBinding,
    files: [...files].sort((left, right) => left.path.localeCompare(right.path)),
  }
  return { ...base, manifestDigest: manifestDigest(base) }
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new InitManifestError(`Invalid init ownership manifest: ${label} is missing.`)
  }
  return value
}

function requireDigest(value: unknown, label: string): string {
  const digest = requireString(value, label)
  if (!/^[a-f0-9]{64}$/u.test(digest)) {
    throw new InitManifestError(`Invalid init ownership manifest: ${label} is not a SHA-256 digest.`)
  }
  return digest
}

function parseManifest(value: unknown): InitManifest {
  if (!isRecord(value)) {
    throw new InitManifestError("Invalid init ownership manifest: expected an object.")
  }
  if (value.schema !== INIT_MANIFEST_SCHEMA || value.marker !== INIT_OWNERSHIP_MARKER) {
    throw new InitManifestError("Invalid init ownership manifest: unknown schema or ownership marker.")
  }
  if (!isRecord(value.package) || !isRecord(value.project) || !Array.isArray(value.files)) {
    throw new InitManifestError("Invalid init ownership manifest: package, project, and files are required.")
  }
  const packageBinding: InitPackageBinding = {
    name: requireString(value.package.name, "package.name"),
    version: requireString(value.package.version, "package.version"),
    templateDigest: requireDigest(value.package.templateDigest, "package.templateDigest"),
  }
  const profileDigest = value.project.profileDigest
  if (profileDigest !== null && typeof profileDigest !== "string") {
    throw new InitManifestError("Invalid init ownership manifest: project.profileDigest is invalid.")
  }
  const projectBinding: InitProjectBinding = {
    realPath: requireString(value.project.realPath, "project.realPath"),
    profileDigest,
  }
  const files: InitManifestFile[] = []
  const seen = new Set<string>()
  for (const entry of value.files) {
    if (!isRecord(entry)) {
      throw new InitManifestError("Invalid init ownership manifest: file entries must be objects.")
    }
    const path = requireString(entry.path, "files.path").replace(/\\/g, "/")
    const normalized = resolve("/", path).slice(1)
    if (normalized !== path || path.startsWith("../") || path === INIT_MANIFEST_RELATIVE_PATH) {
      throw new InitManifestError("Invalid init ownership manifest: file path escapes the init scope.")
    }
    if (seen.has(path)) {
      throw new InitManifestError(`Invalid init ownership manifest: duplicate file ${path}.`)
    }
    seen.add(path)
    if (entry.owner !== "persona-harness" || entry.marker !== INIT_OWNERSHIP_MARKER) {
      throw new InitManifestError(`Invalid init ownership manifest: file ${path} is not PH-owned.`)
    }
    files.push({
      path,
      owner: "persona-harness",
      marker: INIT_OWNERSHIP_MARKER,
      digest: requireDigest(entry.digest, `files.${path}.digest`),
    })
  }
  const manifest: InitManifest = {
    schema: INIT_MANIFEST_SCHEMA,
    marker: INIT_OWNERSHIP_MARKER,
    package: packageBinding,
    project: projectBinding,
    files: files.sort((left, right) => left.path.localeCompare(right.path)),
    manifestDigest: requireDigest(value.manifestDigest, "manifestDigest"),
  }
  if (manifestDigest(manifest) !== manifest.manifestDigest) {
    throw new InitManifestError("Invalid init ownership manifest: manifest digest does not match its contents.")
  }
  return manifest
}

function assertSafePath(projectDir: string, relativePath: string): void {
  const root = resolve(projectDir)
  const target = resolve(root, relativePath)
  const escaped = relative(root, target)
  if (escaped.startsWith(`..${sep}`) || escaped === ".." || escaped.startsWith(sep)) {
    throw new InitManifestError(`Init target escapes the project root: ${relativePath}`)
  }
  let current = root
  for (const segment of relativePath.split("/")) {
    current = join(current, segment)
    if (!existsSync(current)) {
      return
    }
    const stat = lstatSync(current)
    if (stat.isSymbolicLink()) {
      throw new InitManifestError(`Init target contains a symbolic link: ${relativePath}`)
    }
  }
}

export function readInitManifest(projectDir: string): InitManifest | null {
  const path = join(resolve(projectDir), INIT_MANIFEST_RELATIVE_PATH)
  if (!existsSync(path)) {
    return null
  }
  assertSafePath(projectDir, INIT_MANIFEST_RELATIVE_PATH)
  const stat = lstatSync(path)
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new InitManifestError("Init ownership manifest is not a regular file.")
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"))
  } catch {
    throw new InitManifestError("Init ownership manifest is malformed; read-only recovery is required.")
  }
  return parseManifest(parsed)
}
