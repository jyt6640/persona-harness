import { spawnSync } from "node:child_process"
import { lstatSync } from "node:fs"
import { basename, isAbsolute, normalize } from "node:path"

const DPKG_QUERY = "/usr/bin/dpkg-query"
const MAX_PACKAGE_RECORD_BYTES = 16 * 1024
const MAX_PACKAGE_RECORD_PATH_LENGTH = 4_096
const POLICY_PRIMARY_GH_RECORD = "/usr/bin/gh"
const DOCUMENTED_ANCILLARY_GH_RECORDS = new Set([
  "/usr/share/bash-completion/completions/gh",
])

const PACKAGE_RECORD_SHAPES = Object.freeze([
  "record-encoding",
  "record-path",
  "primary-missing",
  "primary-unsafe",
  "ancillary-missing-or-unsafe",
  "ancillary-unknown",
  "executable-ambiguous",
  "lstat-failed",
  "canonical",
])

export const OBSERVER_GH_PACKAGE_RECORD_SHAPES = PACKAGE_RECORD_SHAPES
export const OBSERVER_GH_POLICY_PRIMARY_RECORD = POLICY_PRIMARY_GH_RECORD
export const OBSERVER_GH_DOCUMENTED_ANCILLARY_RECORDS = Object.freeze([
  ...DOCUMENTED_ANCILLARY_GH_RECORDS,
])

export class ObserverGhPackageRecordError extends Error {
  constructor(shape) {
    super(shape)
    this.shape = shape
  }
}

export class ObserverGhPackageOwnershipError extends Error {}

export function readInstalledGhPackageRecord(options = {}) {
  const settings = isRecord(options) ? options : {}
  const execute = typeof settings.execute === "function" ? settings.execute : spawnSync
  const architecture = expectedDpkgArchitecture(settings.architecture)
  const status = runDpkgQuery(execute, ["--showformat=${db:Status-Abbrev}\t${Architecture}\n", "--show", "gh"])
  if (!hasExactInstalledGhOwnership(status, architecture)) {
    throw new ObserverGhPackageOwnershipError("installed-gh-ownership-required")
  }
  const record = runDpkgQuery(execute, ["--listfiles", "gh"])
  return parseObserverGhPackageRecord(record)
}

export function parseObserverGhPackageRecord(value) {
  if (!Buffer.isBuffer(value) || value.length === 0 || value.length > MAX_PACKAGE_RECORD_BYTES) {
    throw new ObserverGhPackageRecordError("record-encoding")
  }
  if (value.includes(0) || value.includes(13) || hasUtf8Bom(value)) {
    throw new ObserverGhPackageRecordError("record-encoding")
  }

  let text
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(value)
  } catch {
    throw new ObserverGhPackageRecordError("record-encoding")
  }
  const withoutOptionalFinalLf = text.endsWith("\n") ? text.slice(0, -1) : text
  if (withoutOptionalFinalLf.length === 0) {
    throw new ObserverGhPackageRecordError("record-encoding")
  }

  const records = withoutOptionalFinalLf.split("\n")
  const seen = new Set()
  for (const record of records) {
    if (record.length === 0 || seen.has(record)) {
      throw new ObserverGhPackageRecordError("record-encoding")
    }
    if (!isCanonicalAbsoluteRecordPath(record)) {
      throw new ObserverGhPackageRecordError("record-path")
    }
    seen.add(record)
  }
  return Object.freeze([...records])
}

export function selectInstalledObserverGhCandidate(records, options = {}) {
  if (!Array.isArray(records) || !records.every((record) => typeof record === "string" && isCanonicalAbsoluteRecordPath(record))) {
    throw new ObserverGhPackageRecordError("record-path")
  }

  const lstat = isRecord(options) && typeof options.lstat === "function" ? options.lstat : lstatSync
  const primary = selectExactPrimaryRecord(records, lstat)
  assessDocumentedAncillaryRecord(records, lstat)
  assessUnknownGhRecords(records, lstat)
  return Object.freeze({ candidate: primary, packageRecordShape: "canonical" })
}

function selectExactPrimaryRecord(records, lstat) {
  if (!records.includes(POLICY_PRIMARY_GH_RECORD)) {
    throw new ObserverGhPackageRecordError("primary-missing")
  }
  const stat = lstatRecord(POLICY_PRIMARY_GH_RECORD, lstat, "primary-missing")
  if (!isRegularNonSymlinkExecutable(stat)) {
    throw new ObserverGhPackageRecordError("primary-unsafe")
  }
  return POLICY_PRIMARY_GH_RECORD
}

function assessDocumentedAncillaryRecord(records, lstat) {
  for (const record of DOCUMENTED_ANCILLARY_GH_RECORDS) {
    if (!records.includes(record)) {
      throw new ObserverGhPackageRecordError("ancillary-missing-or-unsafe")
    }
    const stat = lstatRecord(record, lstat, "ancillary-missing-or-unsafe")
    if (!isRegularNonSymlinkNonExecutable(stat)) {
      throw new ObserverGhPackageRecordError("ancillary-missing-or-unsafe")
    }
  }
}

function assessUnknownGhRecords(records, lstat) {
  for (const record of records) {
    if (basename(record) !== "gh" || record === POLICY_PRIMARY_GH_RECORD || DOCUMENTED_ANCILLARY_GH_RECORDS.has(record)) {
      continue
    }
    const stat = lstatRecord(record, lstat, undefined)
    if (isRegularNonSymlinkExecutable(stat)) {
      throw new ObserverGhPackageRecordError("executable-ambiguous")
    }
    throw new ObserverGhPackageRecordError("ancillary-unknown")
  }
}

function lstatRecord(record, lstat, missingShape) {
  try {
    return lstat(record)
  } catch (error) {
    if (missingShape !== undefined && isMissingPathError(error)) {
      throw new ObserverGhPackageRecordError(missingShape)
    }
    throw new ObserverGhPackageRecordError("lstat-failed")
  }
}

function runDpkgQuery(execute, args) {
  let result
  try {
    result = execute(DPKG_QUERY, args, {
      encoding: "buffer",
      env: { LANG: "C", LC_ALL: "C" },
      maxBuffer: MAX_PACKAGE_RECORD_BYTES,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 5_000,
    })
  } catch {
    throw new ObserverGhPackageOwnershipError("installed-gh-query-unavailable")
  }
  if (!isRecord(result) || result.error !== undefined || result.status !== 0 || !Buffer.isBuffer(result.stdout)) {
    throw new ObserverGhPackageOwnershipError("installed-gh-query-unavailable")
  }
  return result.stdout
}

function hasExactInstalledGhOwnership(value, architecture) {
  const expected = Buffer.from(`ii \t${architecture}\n`, "utf8")
  return value.length === expected.length && value.equals(expected)
}

function expectedDpkgArchitecture(architecture) {
  if (architecture === undefined) {
    switch (process.arch) {
      case "x64":
        return "amd64"
      case "arm64":
        return "arm64"
      default:
        throw new ObserverGhPackageOwnershipError("installed-gh-architecture-unsupported")
    }
  }
  if (architecture === "amd64" || architecture === "arm64") return architecture
  throw new ObserverGhPackageOwnershipError("installed-gh-architecture-unsupported")
}

function isCanonicalAbsoluteRecordPath(value) {
  return typeof value === "string"
    && value.length > 1
    && value.length <= MAX_PACKAGE_RECORD_PATH_LENGTH
    && isAbsolute(value)
    && !value.includes("\0")
    && normalize(value) === value
    && !value.includes("//")
}

function isRegularNonSymlinkExecutable(stat) {
  return stat.isFile() && !stat.isSymbolicLink() && (stat.mode & 0o111) !== 0
}

function isRegularNonSymlinkNonExecutable(stat) {
  return stat.isFile() && !stat.isSymbolicLink() && (stat.mode & 0o111) === 0
}

function hasUtf8Bom(value) {
  return value.length >= 3 && value[0] === 0xef && value[1] === 0xbb && value[2] === 0xbf
}

function isMissingPathError(error) {
  return isRecord(error) && error.code === "ENOENT"
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}
