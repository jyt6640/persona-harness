import { createHash } from "node:crypto"

import {
  ProjectReadBoundaryError,
  ProjectReadBoundaryLimitError,
  reserveProjectReadBoundary,
  type ProjectReadBoundary,
} from "../io/bootstrap-write-boundary.js"
import type { FixedGitRunner } from "./fixed-git.js"
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

export type SourceIdentityEntry =
  | { readonly kind: "directory"; readonly mode: string; readonly path: string }
  | { readonly classification: "tracked" | "untracked"; readonly contentDigest: string; readonly kind: "file"; readonly mode: string; readonly path: string }
  | { readonly kind: "missing-tracked"; readonly path: string }
type SourceIdentityLimits = {
  readonly additionalExcludedRoots?: readonly string[]
  readonly gitRunner?: FixedGitRunner
  readonly projectReadBoundary?: ProjectReadBoundary
  readonly maxEntries?: number
  readonly maxFileBytes?: number
  readonly maxTotalBytes?: number
}
type ResolvedSourceIdentityLimits = {
  readonly additionalExcludedRoots: readonly string[]
  readonly gitRunner?: FixedGitRunner
  readonly projectReadBoundary?: ProjectReadBoundary
  readonly maxEntries: number
  readonly maxFileBytes: number
  readonly maxTotalBytes: number
}
type UnavailableSourceIdentity = { readonly diagnosticCode: string; readonly status: "unavailable" }

type SourceIdentityCapture =
  | UnavailableSourceIdentity
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
    return { diagnosticCode: "source-identity-git-unavailable", status: "unavailable" }
  }
  let exclusions: readonly string[]
  try {
    exclusions = sourceExclusions(evidenceRelativePath, overrides.additionalExcludedRoots)
  } catch (error) {
    if (error instanceof SourceIdentityError) return unavailable(error.code)
    return unavailable("source-identity-path-invalid")
  }
  const suppliedBoundary = overrides.projectReadBoundary
  let boundary = suppliedBoundary
  try {
    if (boundary === undefined) boundary = reserveProjectReadBoundary(projectDir)
    return captureSourceIdentityWithinBoundary(
      projectDir,
      git,
      exclusions,
      resolvedLimits(overrides, boundary),
    )
  } catch (error) {
    if (error instanceof ProjectReadBoundaryError && error.code === "source-read-unsafe") {
      return unavailable("source-identity-symlink")
    }
    return unavailable("source-read-runtime-unavailable")
  } finally {
    if (suppliedBoundary === undefined) boundary?.close()
  }
}

function captureSourceIdentityWithinBoundary(
  projectDir: string,
  git: GitIdentity,
  exclusions: readonly string[],
  limits: ResolvedSourceIdentityLimits,
): SourceIdentityCapture {
  try {
    if (!git.available || git.head === undefined || git.status === undefined) {
      return unavailable("source-identity-git-unavailable")
    }
    const tracked = trackedIndex(projectDir, limits.maxEntries, limits.gitRunner)
    const boundary = limits.projectReadBoundary
    if (boundary === undefined) return { diagnosticCode: "source-read-runtime-unavailable", status: "unavailable" }
    const scanned = scanCapturedWorkspace(boundary, exclusions, tracked.paths, limits)
    const missingTracked = [...tracked.paths]
      .filter((path) => !isExcluded(path, exclusions) && !scanned.paths.has(path))
      .sort()
      .map((path) => ({ kind: "missing-tracked", path }) satisfies SourceIdentityEntry)
    const entries = [...scanned.entries, ...missingTracked].sort((left, right) => entryKey(left).localeCompare(entryKey(right)))
    if (entries.length > limits.maxEntries) throw new SourceIdentityError("source-identity-entry-limit")
    const trackedEntryCount = scanned.trackedEntryCount + missingTracked.length
    const statusDigest = relevantStatusDigest(git.status.entries, exclusions)
    const source = JSON.stringify({
      entries,
      exclusions: SOURCE_IDENTITY_EXCLUSIONS,
      git: {
        head: git.head,
        statusDigest,
        trackedIndexDigest: digest(tracked.digest),
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
    if (error instanceof SourceIdentityError) return { diagnosticCode: error.code, status: "unavailable" }
    if (error instanceof ProjectReadBoundaryError && error.code === "source-read-unsafe") {
      return unavailable("source-identity-symlink")
    }
    return { diagnosticCode: "source-identity-unavailable", status: "unavailable" }
  }
}

export function captureSourceIdentityEntries(
  projectDir: string,
  git: GitIdentity,
  evidenceRelativePath: string,
  overrides: SourceIdentityLimits = {},
): { readonly diagnosticCode: string; readonly status: "unavailable" } | { readonly status: "available"; readonly value: readonly SourceIdentityEntry[] } {
  if (!git.available || git.head === undefined || git.status === undefined) {
    return { diagnosticCode: "source-identity-git-unavailable", status: "unavailable" }
  }
  let exclusions: readonly string[]
  try {
    exclusions = sourceExclusions(evidenceRelativePath, overrides.additionalExcludedRoots)
  } catch (error) {
    if (error instanceof SourceIdentityError) return unavailable(error.code)
    return unavailable("source-identity-path-invalid")
  }
  const suppliedBoundary = overrides.projectReadBoundary
  let boundary = suppliedBoundary
  try {
    if (boundary === undefined) boundary = reserveProjectReadBoundary(projectDir)
    return captureSourceIdentityEntriesWithinBoundary(
      projectDir,
      git,
      exclusions,
      resolvedLimits(overrides, boundary),
    )
  } catch (error) {
    if (error instanceof ProjectReadBoundaryError && error.code === "source-read-unsafe") {
      return unavailable("source-identity-symlink")
    }
    return { diagnosticCode: "source-read-runtime-unavailable", status: "unavailable" }
  } finally {
    if (suppliedBoundary === undefined) boundary?.close()
  }
}

function captureSourceIdentityEntriesWithinBoundary(
  projectDir: string,
  git: GitIdentity,
  exclusions: readonly string[],
  limits: ResolvedSourceIdentityLimits,
): { readonly diagnosticCode: string; readonly status: "unavailable" } | { readonly status: "available"; readonly value: readonly SourceIdentityEntry[] } {
  try {
    if (!git.available || git.head === undefined || git.status === undefined) {
      return { diagnosticCode: "source-identity-git-unavailable", status: "unavailable" }
    }
    const tracked = trackedIndex(projectDir, limits.maxEntries, limits.gitRunner)
    const boundary = limits.projectReadBoundary
    if (boundary === undefined) return { diagnosticCode: "source-read-runtime-unavailable", status: "unavailable" }
    const scanned = scanCapturedWorkspace(boundary, exclusions, tracked.paths, limits)
    const missingTracked = [...tracked.paths]
      .filter((path) => !isExcluded(path, exclusions) && !scanned.paths.has(path))
      .sort()
      .map((path) => ({ kind: "missing-tracked", path }) satisfies SourceIdentityEntry)
    return { status: "available", value: [...scanned.entries, ...missingTracked].sort((left, right) => entryKey(left).localeCompare(entryKey(right))) }
  } catch (error) {
    if (error instanceof SourceIdentityError) return { diagnosticCode: error.code, status: "unavailable" }
    if (error instanceof ProjectReadBoundaryError && error.code === "source-read-unsafe") {
      return unavailable("source-identity-symlink")
    }
    return { diagnosticCode: "source-identity-unavailable", status: "unavailable" }
  }
}

function trackedIndex(
  projectDir: string,
  maxEntries: number,
  runner?: FixedGitRunner,
): { readonly digest: string; readonly paths: ReadonlySet<string> } {
  if (runner === undefined) throw new SourceIdentityError("source-read-runtime-unavailable")
  const result = runner(["ls-files", "--stage", "-z"])
  if (!result.available || result.status !== 0) {
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

function resolvedLimits(
  overrides: SourceIdentityLimits,
  projectReadBoundary: ProjectReadBoundary,
): ResolvedSourceIdentityLimits {
  return {
    ...DEFAULT_LIMITS,
    additionalExcludedRoots: overrides.additionalExcludedRoots ?? [],
    gitRunner: overrides.gitRunner ?? ((args) => projectReadBoundary.runFixedGit(args)),
    maxEntries: overrides.maxEntries ?? DEFAULT_LIMITS.maxEntries,
    maxFileBytes: overrides.maxFileBytes ?? DEFAULT_LIMITS.maxFileBytes,
    maxTotalBytes: overrides.maxTotalBytes ?? DEFAULT_LIMITS.maxTotalBytes,
    projectReadBoundary,
  }
}

function scanCapturedWorkspace(
  boundary: ProjectReadBoundary,
  exclusions: readonly string[],
  trackedPaths: ReadonlySet<string>,
  limits: ResolvedSourceIdentityLimits,
): {
  readonly entries: readonly SourceIdentityEntry[]
  readonly paths: ReadonlySet<string>
  readonly trackedEntryCount: number
  readonly untrackedEntryCount: number
} {
  try {
    const captured = boundary.readProjectTree({
      excludedRoots: [
        ".git",
        ".gradle",
        "build",
        "node_modules",
        ...exclusions,
      ],
      maxEntries: limits.maxEntries,
      maxFileBytes: limits.maxFileBytes,
      maxTotalBytes: limits.maxTotalBytes,
    })
    const entries: SourceIdentityEntry[] = []
    const paths = new Set<string>()
    let trackedEntryCount = 0
    let untrackedEntryCount = 0
    const files = captured.filter((entry) => entry.kind === "file")
    for (const entry of files) {
      paths.add(entry.path)
      const classification = trackedPaths.has(entry.path) ? "tracked" : "untracked"
      if (classification === "tracked") trackedEntryCount += 1
      else untrackedEntryCount += 1
      entries.push({
        classification,
        contentDigest: digest(entry.bytes),
        kind: "file",
        mode: canonicalSourceMode(entry.identity.mode),
        path: entry.path,
      })
    }
    for (const entry of captured) {
      if (entry.kind !== "directory") continue
      if (!files.some((file) => file.path.startsWith(`${entry.path}/`))) continue
      paths.add(entry.path)
      entries.push({ kind: "directory", mode: "0755", path: entry.path })
    }
    return { entries, paths, trackedEntryCount, untrackedEntryCount }
  } catch (error) {
    if (error instanceof ProjectReadBoundaryLimitError) {
      throw new SourceIdentityError("source-identity-file-limit")
    }
    if (error instanceof ProjectReadBoundaryError && error.code === "source-read-unsafe") {
      throw new SourceIdentityError("source-identity-symlink")
    }
    throw new SourceIdentityError("source-identity-unavailable")
  }
}

function normalizedRelativePath(value: string): string {
  const path = value.replaceAll("\\", "/").replace(/^\.\//u, "")
  if (path === "" || path.startsWith("/") || path.split("/").some((part) => part === "" || part === "." || part === "..")) {
    throw new SourceIdentityError("source-identity-path-invalid")
  }
  return path
}

function sourceExclusions(evidenceRelativePath: string, additionalExcludedRoots: readonly string[] | undefined): readonly string[] {
  return [
    normalizedRelativePath(evidenceRelativePath),
    ...(additionalExcludedRoots ?? []).map(normalizedRelativePath),
  ]
}

function isExcluded(path: string, additionalExcludedRoots: readonly string[]): boolean {
  return path === ".git" || path.startsWith(".git/")
    || path === ".gradle" || path.startsWith(".gradle/")
    || path === "build" || path.startsWith("build/")
    || path === "node_modules" || path.startsWith("node_modules/")
    || additionalExcludedRoots.some((root) => path === root || path.startsWith(`${root}/`))
}

function relevantStatusDigest(entries: readonly MutationEntry[], exclusions: readonly string[]): string {
  const relevant = entries.filter((entry) => {
    if (entry.kind === "renamed") {
      return !isExcluded(entry.oldPath, exclusions) || !isExcluded(entry.newPath, exclusions)
    }
    return !isExcluded(entry.path, exclusions)
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

function canonicalSourceMode(value: string): string {
  const parsed = Number.parseInt(value, 8)
  if (!Number.isSafeInteger(parsed)) throw new SourceIdentityError("source-identity-unavailable")
  return (parsed & 0o111) === 0 ? "0644" : "0755"
}

function digest(value: string | Buffer): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`
}

function unavailable(diagnosticCode: string): UnavailableSourceIdentity {
  return { diagnosticCode, status: "unavailable" }
}
