import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { lstatSync, readdirSync, readFileSync, realpathSync } from "node:fs"
import { join } from "node:path"

export const SOURCE_IDENTITY_SCHEMA = "source-identity.1"
export const SOURCE_IDENTITY_EXCLUSIONS = [
  ".git/**",
  ".gradle/**",
  "build/**",
  "node_modules/**",
  "<configured-evidence>/**",
]

const MAX_ENTRIES = 20_000
const MAX_FILE_BYTES = 8 * 1024 * 1024
const MAX_TOTAL_BYTES = 64 * 1024 * 1024

export function captureSourceIdentity(projectDir, evidenceRelativePath = ".persona/evidence") {
  const root = realpathSync(projectDir)
  const evidenceRoot = normalizeRelativePath(evidenceRelativePath)
  const tracked = readTrackedIndex(root)
  const scanned = scanWorkspace(root, evidenceRoot, tracked.paths)
  const missingTracked = [...tracked.paths]
    .filter((path) => !isExcluded(path, evidenceRoot) && !scanned.paths.has(path))
    .sort()
    .map((path) => ({ kind: "missing-tracked", path }))
  const entries = [...scanned.entries, ...missingTracked].sort((left, right) => entryKey(left).localeCompare(entryKey(right)))
  if (entries.length > MAX_ENTRIES) throw new Error("source identity entry limit exceeded")

  const status = execFileSync("git", ["status", "--porcelain=v1", "-z", "--untracked-files=all"], {
    cwd: root,
    encoding: "buffer",
  })
  const gitStatusEntries = parseStatus(status)
  const head = execFileSync("git", ["rev-parse", "--verify", "HEAD^{commit}"], { cwd: root, encoding: "utf8" }).trim().toLowerCase()
  const source = JSON.stringify({
    entries,
    exclusions: SOURCE_IDENTITY_EXCLUSIONS,
    git: {
      head,
      statusDigest: sha256(JSON.stringify(gitStatusEntries)),
      trackedIndexDigest: sha256(tracked.digest),
    },
  })
  return {
    contentDigest: sha256(source),
    entryCount: entries.length,
    exclusions: SOURCE_IDENTITY_EXCLUSIONS,
    gitStatusDigest: sha256(JSON.stringify(gitStatusEntries)),
    repositoryHead: head,
    schemaVersion: SOURCE_IDENTITY_SCHEMA,
    trackedEntryCount: scanned.trackedEntryCount + missingTracked.length,
    trackedIndexDigest: sha256(tracked.digest),
    untrackedEntryCount: scanned.untrackedEntryCount,
  }
}

function readTrackedIndex(root) {
  const records = execFileSync("git", ["ls-files", "--stage", "-z"], { cwd: root, encoding: "utf8" })
    .split("\0")
    .filter((record) => record.length > 0)
    .sort()
  const paths = new Set(records.map((record) => normalizeRelativePath(record.slice(record.indexOf("\t") + 1))))
  return { digest: sha256(records.join("\0")), paths }
}

function scanWorkspace(root, evidenceRoot, trackedPaths) {
  const entries = []
  const paths = new Set()
  let totalBytes = 0
  let trackedEntryCount = 0
  let untrackedEntryCount = 0

  const visit = (directory, parent) => {
    const names = readdirSync(directory).sort()
    for (const name of names) {
      if (name.includes("\0") || name.includes("\\")) throw new Error("source identity path is invalid")
      const path = parent === "" ? name : `${parent}/${name}`
      if (isExcluded(path, evidenceRoot)) continue
      const absolutePath = join(directory, name)
      const stat = lstatSync(absolutePath, { bigint: true })
      if (stat.isSymbolicLink()) throw new Error("source identity contains a symlink")
      if (stat.isDirectory()) {
        paths.add(path)
        entries.push({ kind: "directory", mode: mode(stat.mode), path })
        visit(absolutePath, path)
        continue
      }
      if (!stat.isFile()) throw new Error("source identity contains a special file")
      const size = Number(stat.size)
      if (!Number.isSafeInteger(size) || size > MAX_FILE_BYTES) throw new Error("source identity file limit exceeded")
      totalBytes += size
      if (totalBytes > MAX_TOTAL_BYTES) throw new Error("source identity total size limit exceeded")
      const classification = trackedPaths.has(path) ? "tracked" : "untracked"
      if (classification === "tracked") trackedEntryCount += 1
      else untrackedEntryCount += 1
      paths.add(path)
      entries.push({
        classification,
        contentDigest: sha256(readFileSync(absolutePath)),
        kind: "file",
        mode: mode(stat.mode),
        path,
      })
      if (entries.length > MAX_ENTRIES) throw new Error("source identity entry limit exceeded")
    }
  }

  visit(root, "")
  return { entries, paths, trackedEntryCount, untrackedEntryCount }
}

function parseStatus(bytes) {
  const fields = bytes.toString("utf8").split("\0")
  const entries = []
  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index]
    if (field === undefined || field === "") continue
    const status = field.slice(0, 2)
    const path = field.slice(3).replaceAll("\\", "/").replace(/^\.\//u, "")
    if (status.includes("R")) {
      entries.push({ kind: "renamed", newPath: path, oldPath: fields[++index] ?? "" })
    } else if (status === "??") {
      entries.push({ kind: "untracked", path })
    } else if (status.includes("T")) {
      entries.push({ kind: "typeChanged", path })
    } else if (status.includes("D")) {
      entries.push({ kind: "deleted", path })
    } else if (status.includes("A")) {
      entries.push({ kind: "added", path })
    } else {
      entries.push({ kind: "trackedModified", path })
    }
  }
  return entries.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
}

function normalizeRelativePath(value) {
  const path = value.replaceAll("\\", "/").replace(/^\.\//u, "")
  if (path === "" || path.startsWith("/") || path.split("/").some((part) => part === "" || part === "." || part === "..")) {
    throw new Error("source identity path is invalid")
  }
  return path
}

function isExcluded(path, evidenceRoot) {
  return path === ".git" || path.startsWith(".git/")
    || path === ".gradle" || path.startsWith(".gradle/")
    || path === "build" || path.startsWith("build/")
    || path === "node_modules" || path.startsWith("node_modules/")
    || path === evidenceRoot || path.startsWith(`${evidenceRoot}/`)
}

function entryKey(entry) {
  return entry.kind === "file"
    ? `${entry.path}\0${entry.kind}\0${entry.classification}\0${entry.mode}\0${entry.contentDigest}`
    : entry.kind === "directory"
      ? `${entry.path}\0${entry.kind}\0${entry.mode}`
      : `${entry.path}\0${entry.kind}`
}

function mode(value) {
  return Number(value & 0o777n).toString(8).padStart(4, "0")
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`
}
