import { isAbsolute, join, relative, resolve, sep } from "node:path"

import type {
  ProjectReadBoundary,
  ProjectReadTreeEntry,
} from "./bootstrap-write-boundary.js"

const SNAPSHOT_OPTIONS = {
  excludedRoots: [".git", ".gradle", "build", "node_modules"],
  maxEntries: 20_000,
  maxFileBytes: 8 * 1024 * 1024,
  maxTotalBytes: 64 * 1024 * 1024,
} as const

export type ProjectSnapshotFile = {
  readonly absolutePath: string
  readonly bytes: Buffer
  readonly relativePath: string
  readonly text: string
}

export class ProjectReadSnapshot {
  readonly #entries: ReadonlyMap<string, ProjectReadTreeEntry>
  readonly #projectDir: string

  constructor(projectDir: string, entries: readonly ProjectReadTreeEntry[]) {
    this.#projectDir = projectDir
    this.#entries = new Map(entries.map((entry) => [entry.path, entry]))
  }

  hasDirectory(relativePath: string): boolean {
    return this.#entry(relativePath)?.kind === "directory"
  }

  hasFile(relativePath: string): boolean {
    return this.#entry(relativePath)?.kind === "file"
  }

  readFile(relativePath: string, maxBytes = 8 * 1024 * 1024): Buffer | undefined {
    if (!Number.isInteger(maxBytes) || maxBytes <= 0) return undefined
    const entry = this.#entry(relativePath)
    if (entry?.kind !== "file" || entry.bytes.length > maxBytes) return undefined
    return Buffer.from(entry.bytes)
  }

  readText(relativePath: string, maxBytes = 8 * 1024 * 1024): string | undefined {
    return this.readFile(relativePath, maxBytes)?.toString("utf8")
  }

  filesUnder(
    relativeRoot: string,
    options: {
      readonly extensions?: readonly string[]
      readonly maxEntries?: number
      readonly maxFileBytes?: number
      readonly maxTotalBytes?: number
    } = {},
  ): readonly ProjectSnapshotFile[] | undefined {
    const root = normalizedRelativePath(relativeRoot)
    if (root === undefined) return undefined
    const rootEntry = root === "." ? undefined : this.#entry(root)
    if (root !== "." && rootEntry === undefined) return []
    if (rootEntry !== undefined && rootEntry.kind !== "directory") return undefined
    const prefix = root === "." ? "" : `${root}/`
    const files = [...this.#entries.values()]
      .filter((entry): entry is Extract<ProjectReadTreeEntry, { readonly kind: "file" }> =>
        entry.kind === "file"
        && entry.path.startsWith(prefix)
        && (options.extensions === undefined || options.extensions.some((extension) => entry.path.endsWith(extension))),
      )
      .sort((left, right) => left.path.localeCompare(right.path))
    const maxEntries = options.maxEntries ?? 20_000
    const maxFileBytes = options.maxFileBytes ?? 8 * 1024 * 1024
    const maxTotalBytes = options.maxTotalBytes ?? 64 * 1024 * 1024
    if (
      !Number.isInteger(maxEntries)
      || !Number.isInteger(maxFileBytes)
      || !Number.isInteger(maxTotalBytes)
      || maxEntries <= 0
      || maxFileBytes <= 0
      || maxTotalBytes <= 0
      || files.length > maxEntries
      || files.some((entry) => entry.bytes.length > maxFileBytes)
      || files.reduce((total, entry) => total + entry.bytes.length, 0) > maxTotalBytes
    ) {
      return undefined
    }
    return files.map((entry) => ({
      absolutePath: join(this.#projectDir, entry.path),
      bytes: Buffer.from(entry.bytes),
      relativePath: entry.path.slice(prefix.length),
      text: entry.bytes.toString("utf8"),
    }))
  }

  #entry(relativePath: string): ProjectReadTreeEntry | undefined {
    const normalized = normalizedRelativePath(relativePath)
    return normalized === undefined ? undefined : this.#entries.get(normalized)
  }
}

export function captureProjectReadSnapshot(
  projectDir: string,
  boundary: ProjectReadBoundary,
): ProjectReadSnapshot {
  return new ProjectReadSnapshot(projectDir, boundary.readProjectTree(SNAPSHOT_OPTIONS))
}

export function containedProjectRelativePath(
  projectDir: string,
  configuredPath: string,
): string | undefined {
  if (configuredPath.trim().length === 0) return undefined
  const root = resolve(projectDir)
  const target = isAbsolute(configuredPath) ? resolve(configuredPath) : resolve(root, configuredPath)
  const candidate = relative(root, target)
  if (
    candidate === ""
    || candidate === ".."
    || candidate.startsWith(`..${sep}`)
    || isAbsolute(candidate)
  ) {
    return undefined
  }
  return candidate.replaceAll("\\", "/")
}

function normalizedRelativePath(value: string): string | undefined {
  const normalized = value.replaceAll("\\", "/").replace(/^\.\/+/u, "").replace(/\/+$/u, "")
  if (
    normalized === ""
    || normalized.startsWith("/")
    || normalized.startsWith("../")
    || normalized.includes("/../")
    || normalized.includes("\0")
  ) {
    return value === "." ? "." : undefined
  }
  return normalized
}
