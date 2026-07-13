import { createHash } from "node:crypto"
import { isAbsolute, posix, relative, resolve } from "node:path"

export const CORPUS_ID = "p3-6a-config-path-safety"
export const LOCK_SCHEMA = "p3-6a-config-path-safety.lock.1"
export const VERSIONS = {
  base: {
    corpusFile: "corpus.json",
    lockFile: "corpus.lock.json",
    schemaVersion: "p3-6a-config-path-safety.1",
    recordCount: 13,
  },
  successor: {
    corpusFile: "corpus.v2.json",
    lockFile: "corpus.v2.lock.json",
    schemaVersion: "p3-6a-config-path-safety.2",
    recordCount: 14,
  },
}

export const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value)
export const hashBytes = (bytes) => createHash("sha256").update(bytes).digest("hex")
export const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (!isRecord(value)) return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]))
}
export const canonicalHash = (value) => hashBytes(Buffer.from(JSON.stringify(canonicalize(value)) ?? "undefined"))
const clone = (value) => JSON.parse(JSON.stringify(value))

export function isSafeFixturePath(root, fixturePath) {
  if (typeof fixturePath !== "string" || !fixturePath.startsWith("fixtures/") || fixturePath.includes("\\")) {
    return false
  }
  const fixtureRoot = resolve(root, "fixtures")
  const resolvedFixture = resolve(root, fixturePath)
  const relativeFixture = relative(fixtureRoot, resolvedFixture)
  return relativeFixture !== "" && !relativeFixture.startsWith("..") && !isAbsolute(relativeFixture)
}

export function corpusFingerprintInput(corpus) {
  const copy = clone(corpus)
  if (!isRecord(copy) || !isRecord(copy.preregistration)) return copy
  delete copy.preregistration.corpusFingerprint
  if (isRecord(copy.preregistration.extension)) delete copy.preregistration.extension.newCorpusFingerprint
  return copy
}

export function lockFingerprintInput(lock) {
  const copy = clone(lock)
  delete copy.lockFingerprint
  return copy
}

export function failure(code, subject) {
  return {
    code,
    subject,
    kind: "structured_failure",
    completionAuthority: "fail_closed",
    diagnosticMode: "read_only_diagnostic",
    normalClosure: "blocked",
    bounded: true,
    stackLeaked: false,
  }
}

function outcome(code, subject, diagnosticMode = "read_only_diagnostic") {
  if (code === null) {
    return {
      disposition: "accept_synthetic_control",
      failureCode: null,
      completionAuthority: "not_authorized",
      diagnosticMode: "report_only",
      normalClosure: "not_evaluated",
      bounded: true,
      stackLeaked: false,
    }
  }
  return {
    disposition: "reject_fail_closed",
    failureCode: code,
    completionAuthority: "fail_closed",
    diagnosticMode,
    normalClosure: "blocked",
    bounded: true,
    stackLeaked: false,
    subject,
  }
}

function pathModelIsCanonical(pathModel) {
  if (!isRecord(pathModel)) return false
  const configured = pathModel.configured
  const canonical = pathModel.canonical
  if (!isRecord(configured) || !isRecord(canonical) || typeof pathModel.projectRoot !== "string") return false
  if (typeof configured.evidenceDir !== "string" || typeof configured.rulesDir !== "string" ||
      posix.isAbsolute(configured.evidenceDir) || posix.isAbsolute(configured.rulesDir)) return false
  const expected = {
    evidenceDir: posix.normalize(posix.join(pathModel.projectRoot, configured.evidenceDir)),
    rulesDir: posix.normalize(posix.join(pathModel.projectRoot, configured.rulesDir)),
  }
  return JSON.stringify(expected) === JSON.stringify(canonical) &&
    JSON.stringify(pathModel.closure) === JSON.stringify(canonical) &&
    JSON.stringify(pathModel.doctor) === JSON.stringify(canonical)
}

export function deriveOutcome(fixture) {
  if (!isRecord(fixture) || !isRecord(fixture.payload)) return outcome("fixture.shape", "fixture")
  const payload = fixture.payload
  const config = payload.config
  const pathModel = payload.pathModel
  const walker = payload.walker
  const diagnostic = payload.diagnostic
  if (!isRecord(config) || !isRecord(pathModel) || !isRecord(walker) || !isRecord(diagnostic)) {
    return outcome("fixture.shape", String(fixture.fixtureId ?? "fixture"))
  }
  let parsedConfig
  try {
    parsedConfig = JSON.parse(config.rawBytes)
  } catch {
    return outcome("config.malformed", ".persona/harness.jsonc", "read_only_recovery")
  }
  if (!isRecord(parsedConfig) || typeof parsedConfig.evidenceDir !== "string" ||
      typeof parsedConfig.rulesDir !== "string") {
    return outcome("config.corrupt", ".persona/harness.jsonc", "read_only_recovery")
  }
  if (config.state !== "valid") return outcome("config.unknown", ".persona/harness.jsonc")
  if (!pathModelIsCanonical(pathModel)) return outcome("paths.canonical_mismatch", "pathModel")
  const policy = walker.policy
  const observed = walker.observed
  const limits = ["maxDepth", "maxEntries", "maxBytes", "maxFileBytes"]
  if (!isRecord(policy) || !isRecord(observed) || policy.lstat !== true ||
      policy.followSymlinks !== false || limits.some((key) => typeof policy[key] !== "number")) {
    return outcome("walker.policy", "walker")
  }
  if (observed.symlink === "cycle" && observed.symlinkErrno === "ELOOP") return outcome("walker.symlink_cycle", "walker")
  if (observed.escaped === true) return outcome("walker.path_escape", "walker")
  if (typeof observed.depth !== "number" || observed.depth > policy.maxDepth) return outcome("walker.depth_exceeded", "walker")
  if (typeof observed.entries !== "number" || observed.entries > policy.maxEntries) return outcome("walker.entry_limit", "walker")
  if (typeof observed.bytes !== "number" || observed.bytes > policy.maxBytes ||
      typeof observed.fileBytes !== "number" || observed.fileBytes > policy.maxFileBytes) {
    return outcome("walker.byte_limit", "walker")
  }
  if (observed.unreadable === true) return outcome("walker.unreadable", "walker")
  if (observed.binary === true) return outcome("walker.binary", "walker")
  if (diagnostic.stackLeaked === true) return outcome("diagnostic.stack_leak", "diagnostic")
  if (diagnostic.reportedBounded !== true) return outcome("diagnostic.unbounded", "diagnostic")
  return outcome(null, "control")
}

export function expectedLockEntry(record, fixtureBytes, fixture) {
  return {
    id: record.id,
    fixture: record.fixture,
    recordCanonicalBytesSha256: canonicalHash(record),
    fixtureBytesSha256: hashBytes(fixtureBytes),
    payloadSha256: canonicalHash(fixture.payload),
    metadataSha256: canonicalHash(fixture.metadata),
  }
}
