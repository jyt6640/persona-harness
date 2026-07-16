import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { lstatSync, readdirSync, readFileSync, realpathSync } from "node:fs"
import { join } from "node:path"

const EXCLUSIONS = [".git/**", ".gradle/**", "build/**", "node_modules/**", "<configured-evidence>/**"]
const MAX_ENTRIES = 20_000
const MAX_FILE_BYTES = 8 * 1024 * 1024
const MAX_TOTAL_BYTES = 64 * 1024 * 1024

export function captureCleanSourceIdentity(projectDir) {
  const head = git(projectDir, ["rev-parse", "--verify", "HEAD^{commit}"])
  const tracked = trackedIndex(projectDir)
  const entries = []
  const paths = new Set()
  let totalBytes = 0
  let trackedEntryCount = 0
  let untrackedEntryCount = 0

  const visit = (directory, parent) => {
    for (const name of readdirSync(directory).sort()) {
      const path = parent === "" ? name : `${parent}/${name}`
      if (excluded(path)) continue
      const absolutePath = join(directory, name)
      const stat = lstatSync(absolutePath, { bigint: true })
      if (stat.isSymbolicLink()) throw new Error("source identity does not permit symlinks")
      if (stat.isDirectory()) {
        paths.add(path)
        entries.push({ kind: "directory", mode: mode(stat.mode), path })
        visit(absolutePath, path)
        continue
      }
      if (!stat.isFile()) throw new Error("source identity does not permit special files")
      const size = Number(stat.size)
      if (!Number.isSafeInteger(size) || size > MAX_FILE_BYTES) throw new Error("source identity file limit exceeded")
      totalBytes += size
      if (totalBytes > MAX_TOTAL_BYTES) throw new Error("source identity total limit exceeded")
      const classification = tracked.paths.has(path) ? "tracked" : "untracked"
      if (classification === "tracked") trackedEntryCount += 1
      else untrackedEntryCount += 1
      paths.add(path)
      entries.push({ classification, contentDigest: digest(readFileSync(absolutePath)), kind: "file", mode: mode(stat.mode), path })
      if (entries.length > MAX_ENTRIES) throw new Error("source identity entry limit exceeded")
    }
  }

  visit(realpathSync(projectDir), "")
  for (const path of [...tracked.paths].filter((entry) => !excluded(entry) && !paths.has(entry)).sort()) {
    entries.push({ kind: "missing-tracked", path })
  }
  entries.sort((left, right) => entryKey(left).localeCompare(entryKey(right)))
  if (entries.length > MAX_ENTRIES) throw new Error("source identity entry limit exceeded")

  return {
    contentDigest: digest(JSON.stringify({ entries, exclusions: EXCLUSIONS, git: { head, statusDigest: digest("[]"), trackedIndexDigest: tracked.digest } })),
    entryCount: entries.length,
    exclusions: EXCLUSIONS,
    gitStatusDigest: digest("[]"),
    repositoryHead: head,
    schemaVersion: "source-identity.1",
    trackedEntryCount: trackedEntryCount + entries.filter((entry) => entry.kind === "missing-tracked").length,
    trackedIndexDigest: digest(tracked.digest),
    untrackedEntryCount,
  }
}

function trackedIndex(projectDir) {
  const output = execFileSync("git", ["ls-files", "--stage", "-z"], { cwd: projectDir, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 })
  const records = output.split("\0").filter((entry) => entry.length > 0)
  if (records.length > MAX_ENTRIES) throw new Error("source identity entry limit exceeded")
  const paths = new Set()
  for (const record of records) {
    const delimiter = record.indexOf("\t")
    if (delimiter < 0) throw new Error("source identity index is malformed")
    paths.add(record.slice(delimiter + 1).replaceAll("\\", "/"))
  }
  return { digest: digest([...records].sort().join("\0")), paths }
}

function git(projectDir, args) {
  return execFileSync("git", args, { cwd: projectDir, encoding: "utf8" }).trim().toLowerCase()
}

function excluded(path) {
  return path === ".git" || path.startsWith(".git/")
    || path === ".gradle" || path.startsWith(".gradle/")
    || path === "build" || path.startsWith("build/")
    || path === "node_modules" || path.startsWith("node_modules/")
    || path === ".persona/evidence" || path.startsWith(".persona/evidence/")
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

function digest(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`
}
