import { createHash } from "node:crypto"

export type MutationMode = "ci" | "local"

export type MutationEntry =
  | { readonly kind: "added" | "deleted" | "trackedModified" | "typeChanged" | "untracked"; readonly path: string }
  | { readonly kind: "renamed"; readonly newPath: string; readonly oldPath: string }

export type MutationClassification = {
  readonly allowedTracked: readonly string[]
  readonly decision: "allowed" | "partial" | "report-only"
  readonly disallowedTracked: readonly string[]
  readonly observed: {
    readonly added: readonly string[]
    readonly deleted: readonly string[]
    readonly renamed: readonly { readonly newPath: string; readonly oldPath: string }[]
    readonly trackedModified: readonly string[]
    readonly typeChanged: readonly string[]
    readonly untracked: readonly string[]
  }
  readonly untracked: readonly string[]
}

export type GitStatusSnapshot = {
  readonly digest: string
  readonly entries: readonly MutationEntry[]
  readonly entryCount: number
}

function normalizedPath(raw: string): string {
  return raw.replace(/\\/gu, "/").replace(/^\.\//u, "")
}

function entryKey(entry: MutationEntry): string {
  return entry.kind === "renamed"
    ? `renamed:${entry.oldPath}\0${entry.newPath}`
    : `${entry.kind}:${entry.path}`
}

function trackedPath(entry: MutationEntry): string {
  return entry.kind === "renamed" ? entry.newPath : entry.path
}

function isAllowedTrackedPath(path: string): boolean {
  return path === "build" || path.startsWith("build/") || path === ".gradle" || path.startsWith(".gradle/")
}

export function parseGitStatusPorcelain(raw: string): GitStatusSnapshot {
  const fields = raw.split("\0")
  const entries: MutationEntry[] = []
  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index]
    if (field === undefined || field === "") continue
    const status = field.slice(0, 2)
    const path = normalizedPath(field.slice(3))
    if (status === "??") {
      entries.push({ kind: "untracked", path })
      continue
    }
    if (status.includes("R")) {
      const oldPath = normalizedPath(fields[index + 1] ?? "")
      index += 1
      entries.push({ kind: "renamed", newPath: path, oldPath })
      continue
    }
    if (status.includes("T")) {
      entries.push({ kind: "typeChanged", path })
      continue
    }
    if (status.includes("D")) {
      entries.push({ kind: "deleted", path })
      continue
    }
    if (status.includes("A")) {
      entries.push({ kind: "added", path })
      continue
    }
    entries.push({ kind: "trackedModified", path })
  }
  entries.sort((left, right) => entryKey(left).localeCompare(entryKey(right)))
  const normalized = entries.map(entryKey).join("\0")
  return {
    digest: createHash("sha256").update(normalized).digest("hex"),
    entries,
    entryCount: entries.length,
  }
}

export function classifyObservedMutations(
  pre: GitStatusSnapshot,
  post: GitStatusSnapshot,
  mode: MutationMode,
): MutationClassification {
  const preKeys = new Set(pre.entries.map(entryKey))
  const observed = post.entries.filter((entry) => !preKeys.has(entryKey(entry)))
  const tracked = observed.filter((entry) => entry.kind !== "untracked")
  const allowedTracked = tracked.filter((entry) => isAllowedTrackedPath(trackedPath(entry))).map(trackedPath).sort()
  const disallowedTracked = tracked.filter((entry) => !isAllowedTrackedPath(trackedPath(entry))).map(trackedPath).sort()
  const untracked = observed.filter((entry) => entry.kind === "untracked").map(trackedPath).sort()
  return {
    allowedTracked,
    decision: mode === "ci" && disallowedTracked.length > 0
      ? "partial"
      : observed.length > 0
        ? "report-only"
        : "allowed",
    disallowedTracked: mode === "ci" ? disallowedTracked : [],
    observed: {
      added: observed.filter((entry) => entry.kind === "added").map(trackedPath).sort(),
      deleted: observed.filter((entry) => entry.kind === "deleted").map(trackedPath).sort(),
      renamed: observed
        .filter((entry): entry is Extract<MutationEntry, { readonly kind: "renamed" }> => entry.kind === "renamed")
        .map((entry) => ({ newPath: entry.newPath, oldPath: entry.oldPath }))
        .sort((left, right) => left.newPath.localeCompare(right.newPath)),
      trackedModified: observed.filter((entry) => entry.kind === "trackedModified").map(trackedPath).sort(),
      typeChanged: observed.filter((entry) => entry.kind === "typeChanged").map(trackedPath).sort(),
      untracked,
    },
    untracked,
  }
}
