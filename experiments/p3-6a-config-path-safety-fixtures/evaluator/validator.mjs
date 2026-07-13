import { lstatSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import {
  CORPUS_ID,
  LOCK_SCHEMA,
  VERSIONS,
  canonicalHash,
  canonicalize,
  deriveOutcome,
  expectedLockEntry,
  failure,
  hashBytes,
  isSafeFixturePath,
  isRecord,
  lockFingerprintInput,
  corpusFingerprintInput,
} from "./contract.mjs"

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"))
}

function loadBundle(root, version) {
  const config = VERSIONS[version]
  const corpusPath = join(root, config.corpusFile)
  const lockPath = join(root, config.lockFile)
  return {
    config,
    corpus: readJson(corpusPath),
    lock: readJson(lockPath),
    corpusBytes: readFileSync(corpusPath),
  }
}

function readFixture(root, fixturePath) {
  try {
    const stat = lstatSync(join(root, fixturePath))
    if (stat.isSymbolicLink() || !stat.isFile()) return { error: stat.isSymbolicLink() ? "fixture.symlink_forbidden" : "fixture.not_file" }
    const bytes = readFileSync(join(root, fixturePath)); return { bytes, fixture: JSON.parse(bytes.toString("utf8")) }
  } catch { return { error: "fixture.read_failed" } }
}

function readFixtureNames(root, failures) {
  try {
    const stat = lstatSync(join(root, "fixtures"))
    if (stat.isSymbolicLink() || !stat.isDirectory()) { failures.push(failure(stat.isSymbolicLink() ? "fixture.directory_symlink_forbidden" : "fixture.directory_not_directory", "fixtures")); return undefined }
    return readdirSync(join(root, "fixtures")).filter((name) => name.endsWith(".json"))
  } catch {
    failures.push(failure("fixture.directory_read_failed", "fixtures")); return undefined
  }
}

function validateShape(bundle, version, failures) {
  const { config, corpus, lock } = bundle
  if (!isRecord(corpus) || corpus.corpusId !== CORPUS_ID) failures.push(failure("corpus.identity", version))
  if (!isRecord(corpus) || corpus.schemaVersion !== config.schemaVersion) {
    failures.push(failure("corpus.schema_mismatch", version))
  }
  const preregistration = isRecord(corpus) ? corpus.preregistration : undefined
  if (!isRecord(preregistration)) {
    failures.push(failure("corpus.preregistration_missing", version))
  } else {
    for (const field of ["reportOnly", "sourceOnly"]) {
      if (preregistration[field] !== true) failures.push(failure(`corpus.${field}_required`, version))
    }
    if (preregistration.enforcement !== false) failures.push(failure("corpus.enforcement_forbidden", version))
    if (preregistration.oracle?.falsePositiveThreshold !== 0) failures.push(failure("corpus.false_positive_threshold", version))
    if (preregistration.oracle?.falseNegativeThreshold !== 0) failures.push(failure("corpus.false_negative_threshold", version))
  }
  if (!isRecord(lock) || lock.lockSchemaVersion !== LOCK_SCHEMA ||
      lock.corpusId !== CORPUS_ID || lock.schemaVersion !== config.schemaVersion) {
    failures.push(failure("lock.identity", version))
  }
  const records = isRecord(corpus) && Array.isArray(corpus.records) ? corpus.records : []
  if (records.length !== config.recordCount) failures.push(failure("corpus.base_record_count", version))
  const ids = new Set()
  const fixtures = new Set()
  for (const record of records) {
    if (!isRecord(record)) {
      failures.push(failure("corpus.record_shape", version))
      continue
    }
    if (typeof record.id !== "string" || ids.has(record.id)) failures.push(failure("corpus.record_duplicate", version))
    if (typeof record.id === "string") ids.add(record.id)
    if (typeof record.fixture !== "string" || fixtures.has(record.fixture)) failures.push(failure("corpus.fixture_duplicate", version))
    if (typeof record.fixture === "string") fixtures.add(record.fixture)
  }
}

function validateRecords(bundle, root, version, failures) {
  const { corpus, lock } = bundle
  const records = isRecord(corpus) && Array.isArray(corpus.records) ? corpus.records : []
  const lockRecords = isRecord(lock) && Array.isArray(lock.records) ? lock.records : []
  const lockById = new Map(lockRecords.filter(isRecord).map((record) => [record.id, record]))
  const actualFixtures = new Set()
  const outcomes = []
  let falsePositiveCount = 0
  let falseNegativeCount = 0
  const fixtureNames = readFixtureNames(root, failures); if (fixtureNames === undefined) return { outcomes, falsePositiveCount, falseNegativeCount }
  for (const record of records) {
    if (!isRecord(record) || typeof record.id !== "string" || typeof record.fixture !== "string") continue
    if (!isSafeFixturePath(root, record.fixture)) {
      failures.push(failure("fixture.path_unsafe", record.id))
      continue
    }
    actualFixtures.add(record.fixture)
    const loadedFixture = readFixture(root, record.fixture)
    if (loadedFixture.error !== undefined) {
      failures.push(failure(loadedFixture.error, record.fixture))
      continue
    }
    const { bytes: fixtureBytes, fixture } = loadedFixture
    const lockEntry = lockById.get(record.id)
    const expected = expectedLockEntry(record, fixtureBytes, fixture)
    if (!isRecord(lockEntry) || JSON.stringify(canonicalize(lockEntry)) !== JSON.stringify(canonicalize(expected))) {
      failures.push(failure("lock.fixture_mismatch", record.id))
    }
    const actual = deriveOutcome(fixture)
    outcomes.push({ id: record.id, ...actual })
    const expectedReject = record.expectedOutcome === "reject_fail_closed"
    const actualReject = actual.disposition === "reject_fail_closed"
    if (expectedReject && !actualReject) falseNegativeCount += 1
    if (!expectedReject && actualReject) falsePositiveCount += 1
    if (record.expectedFailureCode !== actual.failureCode) failures.push(failure("corpus.oracle_mismatch", record.id))
    if (isRecord(fixture) && fixture.oracle !== undefined &&
        JSON.stringify(canonicalize(fixture.oracle)) !== JSON.stringify(canonicalize({
          outcome: actual.disposition,
          failureCode: actual.failureCode,
          completionAuthority: actual.completionAuthority,
          diagnosticMode: actual.diagnosticMode,
          normalClosure: actual.normalClosure,
          bounded: actual.bounded,
          stackLeaked: actual.stackLeaked,
        }))) {
      failures.push(failure("fixture.oracle_mismatch", record.id))
    }
  }
  const expectedFixtures = new Set(actualFixtures)
  if (version === "base") {
    try {
      const successor = readJson(join(root, VERSIONS.successor.corpusFile))
      if (isRecord(successor) && Array.isArray(successor.records)) {
        for (const record of successor.records) {
          if (isRecord(record) && typeof record.fixture === "string") expectedFixtures.add(record.fixture)
        }
      }
    } catch {
      failures.push(failure("corpus.successor_read_failed", "successor"))
    }
  }
  const onDiskFixtures = new Set(fixtureNames.map((name) => `fixtures/${name}`))
  if (JSON.stringify([...expectedFixtures].sort()) !== JSON.stringify([...onDiskFixtures].sort())) failures.push(failure("lock.fixture_set_mismatch", "fixtures"))
  return { outcomes, falsePositiveCount, falseNegativeCount }
}

function validateFingerprints(bundle, failures) {
  const { corpus, lock, corpusBytes } = bundle
  if (!isRecord(corpus) || !isRecord(lock)) return {}
  const corpusFingerprint = canonicalHash(corpusFingerprintInput(corpus))
  if (corpus.preregistration?.corpusFingerprint !== corpusFingerprint ||
      lock.corpusFingerprint !== corpusFingerprint ||
      lock.corpusBytesSha256 !== hashBytes(corpusBytes)) {
    failures.push(failure("lock.fingerprint_mismatch", "corpus"))
  }
  const lockFingerprint = canonicalHash(lockFingerprintInput(lock))
  if (lock.lockFingerprint !== lockFingerprint) failures.push(failure("lock.self_fingerprint_mismatch", "lock"))
  return { corpusFingerprint, lockFingerprint }
}

function validateSingle(root, version) {
  const failures = []
  let bundle
  try {
    bundle = loadBundle(root, version)
  } catch {
    return { failures: [failure("bundle.read_failed", version)], outcomes: [], falsePositiveCount: 0, falseNegativeCount: 0 }
  }
  validateShape(bundle, version, failures)
  const fingerprints = validateFingerprints(bundle, failures)
  const records = validateRecords(bundle, root, version, failures)
  return { ...bundle, ...records, ...fingerprints, failures }
}

function validateAppendOnly(base, successor, failures) {
  const baseRecords = Array.isArray(base.corpus?.records) ? base.corpus.records : []
  const successorRecords = Array.isArray(successor.corpus?.records) ? successor.corpus.records : []
  const baseLocks = Array.isArray(base.lock?.records) ? base.lock.records : []
  const successorLocks = Array.isArray(successor.lock?.records) ? successor.lock.records : []
  const baseLockById = new Map(baseLocks.filter(isRecord).map((record) => [record.id, record]))
  const successorLockById = new Map(successorLocks.filter(isRecord).map((record) => [record.id, record]))
  const policy = successor.corpus?.preregistration?.mutationPolicy
  if (!isRecord(policy) || policy.baseSchemaVersion !== VERSIONS.base.schemaVersion ||
      policy.baseCorpusFingerprint !== base.corpusFingerprint ||
      policy.baseLockFingerprint !== base.lockFingerprint) {
    failures.push(failure("mutation.base_binding", "successor"))
  }
  const extension = successor.corpus?.preregistration?.extension
  if (!isRecord(extension) || extension.type !== "append_only_successor" ||
      extension.newCorpusFingerprint !== successor.corpusFingerprint) {
    failures.push(failure("mutation.successor_preregistration", "successor"))
  }
  if (successorRecords.length <= baseRecords.length) failures.push(failure("mutation.append_missing", "successor"))
  for (let index = 0; index < baseRecords.length; index += 1) {
    const baseRecord = baseRecords[index]
    const successorRecord = successorRecords[index]
    const baseLock = isRecord(baseRecord) ? baseLockById.get(baseRecord.id) : undefined
    const successorLock = isRecord(successorRecord) ? successorLockById.get(successorRecord.id) : undefined
    if (canonicalHash(baseRecord) !== canonicalHash(successorRecord) ||
        JSON.stringify(canonicalize(baseLock)) !== JSON.stringify(canonicalize(successorLock))) {
      failures.push(failure("mutation.prefix_changed", String(index)))
      break
    }
  }
  const baseIds = new Set(baseRecords.filter(isRecord).map((record) => record.id))
  const baseFixtures = new Set(baseRecords.filter(isRecord).map((record) => record.fixture))
  const newRecords = successorRecords.slice(baseRecords.length).filter(isRecord)
  if (newRecords.some((record) => baseIds.has(record.id))) failures.push(failure("mutation.fresh_id", "successor"))
  if (newRecords.some((record) => baseFixtures.has(record.fixture))) failures.push(failure("mutation.fresh_fixture", "successor"))
  const newIds = newRecords.map((record) => record.id)
  const newFixtures = newRecords.map((record) => record.fixture)
  if (JSON.stringify(extension?.newRecordIds) !== JSON.stringify(newIds) ||
      JSON.stringify(extension?.newFixturePaths) !== JSON.stringify(newFixtures)) {
    failures.push(failure("mutation.extension_records", "successor"))
  }
  return {
    status: failures.length === 0 ? "pass" : "fail",
    basePrefixPreserved: failures.every((item) => item.code !== "mutation.prefix_changed"),
    addedRecordIds: newIds,
  }
}

export function validate(root, version = "base") {
  const current = validateSingle(root, version)
  const failures = [...current.failures]
  let appendOnly = { status: "not_applicable", basePrefixPreserved: true, addedRecordIds: [] }
  if (version === "successor") {
    const base = validateSingle(root, "base")
    failures.push(...base.failures)
    appendOnly = validateAppendOnly(base, current, failures)
  }
  const failureCodes = [...new Set(failures.map((item) => item.code))].sort()
  const status = failures.length === 0 && current.falsePositiveCount === 0 && current.falseNegativeCount === 0 ? "pass" : "fail"
  return {
    status,
    version,
    schemaVersion: VERSIONS[version].schemaVersion,
    corpusId: CORPUS_ID,
    reportOnly: true,
    sourceOnly: true,
    enforcement: false,
    falsePositiveCount: current.falsePositiveCount,
    falseNegativeCount: current.falseNegativeCount,
    failureCount: failures.length,
    failureCodes,
    failures,
    outcomes: current.outcomes,
    appendOnly,
  }
}
