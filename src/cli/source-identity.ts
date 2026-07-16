import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { lstatSync, readdirSync, readFileSync, realpathSync } from "node:fs"
import { join } from "node:path"

import type { GitIdentity } from "./ci-reverification-identity.js"
import type { MutationEntry } from "./ci-reverification-mutation.js"
import {
  SOURCE_IDENTITY_EXCLUSIONS,
  SOURCE_IDENTITY_SCHEMA,
  type SourceIdentity,
} from "./source-identity-types.js"

export {
  SOURCE_IDENTITY_EXCLUSIONS,
  SOURCE_IDENTITY_SCHEMA,
  parseSourceIdentity,
  sameSourceIdentity,
} from "./source-identity-types.js"
export type { SourceIdentity } from "./source-identity-types.js"
const DEFAULT_LIMITS = {
  maxEntries: 20_000,
  maxFileBytes: 8 * 1024 * 1024,
  maxTotalBytes: 64 * 1024 * 1024,
} as const

type SourceIdentityEntry =
  | { readonly kind: "directory"; readonly mode: string; readonly path: string }
  | { readonly classification: "tracked" | "untracked"; readonly contentDigest: string; readonly kind: "file"; readonly mode: string; readonly path: string }
  | { readonly kind: "missing-tracked"; readonly path: string }
type SourceIdentityLimits = {
  readonly maxEntries?: number
  readonly maxFileBytes?: number
  readonly maxTotalBytes?: number
}
type ResolvedSourceIdentityLimits = {
  readonly maxEntries: number
  readonly maxFileBytes: number
  readonly maxTotalBytes: number
}
type SourceIdentityCapture =
  | { readonly diagnosticCode: string; readonly status: "unavailable" }
  | { readonly status: "available"; readonly value: SourceIdentity }

class SourceIdentityError extends Error {
  constructor(readonly code: string) {
    super(code)
  }
}

export function captureSourceIdentity(
  projectDir: string,
  git: GitIdentity,
  evidenceRelativePath: string,
  overrides: SourceIdentityLimits = {},
): SourceIdentityCapture {
  if (!git.available || git.head === undefined || git.status === undefined) {
    return unavailable("source-identity-git-unavailable")
  }
  const limits = { ...DEFAULT_LIMITS, ...overrides }
  try {
    const root = realpathSync(projectDir)
    const evidenceRoot = normalizedRelativePath(evidenceRelativePath)
    const tracked = trackedIndex(projectDir, limits.maxEntries)
    const scanned = scanWorkspace(root, evidenceRoot, tracked.paths, limits)
    const missingTracked = [...tracked.paths]
      .filter((path) => !isExcluded(path, evidenceRoot) && !scanned.paths.has(path))
      .sort()
      .map((path) => ({ kind: "missing-tracked", path }) satisfies SourceIdentityEntry)
    const entries = [...scanned.entries, ...missingTracked].sort((left, right) => entryKey(left).localeCompare(entryKey(right)))
    if (entries.length > limits.maxEntries) throw new SourceIdentityError("source-identity-entry-limit")
    const trackedEntryCount = scanned.trackedEntryCount + missingTracked.length
    const statusDigest = relevantStatusDigest(git.status.entries, evidenceRoot)
    const source = JSON.stringify({
      entries,
      exclusions: SOURCE_IDENTITY_EXCLUSIONS,
      git: {
        head: git.head,
        statusDigest,
        trackedIndexDigest: tracked.digest,
      },
    })
    return {
      status: "available",
      value: {
        contentDigest: digest(source),
        entryCount: entries.length,
        exclusions: SOURCE_IDENTITY_EXCLUSIONS,
        gitStatusDigest: statusDigest,
        repositoryHead: git.head,
        schemaVersion: SOURCE_IDENTITY_SCHEMA,
        trackedEntryCount,
        trackedIndexDigest: digest(tracked.digest),
        untrackedEntryCount: scanned.untrackedEntryCount,
      },
    }
  } catch (error) {
    if (error instanceof SourceIdentityError) return unavailable(error.code)
    return unavailable("source-identity-unavailable")
  }
}

function trackedIndex(projectDir: string, maxEntries: number): { readonly digest: string; readonly paths: ReadonlySet<string> } {
  const result = spawnSync("git", ["ls-files", "--stage", "-z"], {
    cwd: projectDir,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
    shell: false,
    timeout: 5_000,
  })
  if (result.status !== 0 || typeof result.stdout !== "string") {
    throw new SourceIdentityError("source-identity-index-unavailable")
  }
  const records = result.stdout.split("\0").filter((entry) => entry.length > 0)
  if (records.length > maxEntries) throw new SourceIdentityError("source-identity-entry-limit")
  const paths = new Set<string>()
  for (const record of records) {
    const delimiter = record.indexOf("\t")
    if (delimiter < 0) throw new SourceIdentityError("source-identity-index-malformed")
    const path = normalizedRelativePath(record.slice(delimiter + 1))
    paths.add(path)
  }
  return { digest: digest([...records].sort().join("\0")), paths }
}

function scanWorkspace(
  root: string,
  evidenceRoot: string,
  trackedPaths: ReadonlySet<string>,
  limits: ResolvedSourceIdentityLimits,
): {
  readonly entries: readonly SourceIdentityEntry[]
  readonly paths: ReadonlySet<string>
  readonly trackedEntryCount: number
  readonly untrackedEntryCount: number
} {
  const entries: SourceIdentityEntry[] = []
  const paths = new Set<string>()
  let totalBytes = 0
  let trackedEntryCount = 0
  let untrackedEntryCount = 0

  const visit = (directory: string, parent: string): void => {
    const names = readdirSync(directory).map((entry) => {
      if (entry.includes("\\") || entry.includes("\0")) throw new SourceIdentityError("source-identity-path-invalid")
      return entry
    }).sort()
    for (const name of names) {
      const path = parent === "" ? name : `${parent}/${name}`
      if (isExcluded(path, evidenceRoot)) continue
      const absolutePath = join(directory, name)
      const stat = lstatSync(absolutePath, { bigint: true })
      if (stat.isSymbolicLink()) throw new SourceIdentityError("source-identity-symlink")
      if (stat.isDirectory()) {
        paths.add(path)
        entries.push({ kind: "directory", mode: mode(stat.mode), path })
        if (entries.length > limits.maxEntries) throw new SourceIdentityError("source-identity-entry-limit")
        visit(absolutePath, path)
        continue
      }
      if (!stat.isFile()) throw new SourceIdentityError("source-identity-special-file")
      const size = Number(stat.size)
      if (!Number.isSafeInteger(size) || size > limits.maxFileBytes) {
        throw new SourceIdentityError("source-identity-file-limit")
      }
      totalBytes += size
      if (totalBytes > limits.maxTotalBytes) throw new SourceIdentityError("source-identity-total-limit")
      const classification = trackedPaths.has(path) ? "tracked" : "untracked"
      if (classification === "tracked") trackedEntryCount += 1
      else untrackedEntryCount += 1
      paths.add(path)
      entries.push({
        classification,
        contentDigest: digest(readFileSync(absolutePath)),
        kind: "file",
        mode: mode(stat.mode),
        path,
      })
      if (entries.length > limits.maxEntries) throw new SourceIdentityError("source-identity-entry-limit")
    }
  }

  visit(root, "")
  return { entries, paths, trackedEntryCount, untrackedEntryCount }
}

function normalizedRelativePath(value: string): string {
  const path = value.replaceAll("\\", "/").replace(/^\.\//u, "")
  if (path === "" || path.startsWith("/") || path.split("/").some((part) => part === "" || part === "." || part === "..")) {
    throw new SourceIdentityError("source-identity-path-invalid")
  }
  return path
}

function isExcluded(path: string, evidenceRoot: string): boolean {
  return path === ".git" || path.startsWith(".git/")
    || path === ".gradle" || path.startsWith(".gradle/")
    || path === "build" || path.startsWith("build/")
    || path === "node_modules" || path.startsWith("node_modules/")
    || path === evidenceRoot || path.startsWith(`${evidenceRoot}/`)
}

function relevantStatusDigest(entries: readonly MutationEntry[], evidenceRoot: string): string {
  const relevant = entries.filter((entry) => {
    if (entry.kind === "renamed") {
      return !isExcluded(entry.oldPath, evidenceRoot) || !isExcluded(entry.newPath, evidenceRoot)
    }
    return !isExcluded(entry.path, evidenceRoot)
  })
  return digest(JSON.stringify(relevant))
}

function entryKey(entry: SourceIdentityEntry): string {
  return entry.kind === "file"
    ? `${entry.path}\0${entry.kind}\0${entry.classification}\0${entry.mode}\0${entry.contentDigest}`
    : entry.kind === "directory"
      ? `${entry.path}\0${entry.kind}\0${entry.mode}`
      : `${entry.path}\0${entry.kind}`
}

function mode(value: bigint): string {
  return Number(value & 0o777n).toString(8).padStart(4, "0")
}

function digest(value: string | Buffer): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`
}

function unavailable(diagnosticCode: string): SourceIdentityCapture {
  return { diagnosticCode, status: "unavailable" }
}
