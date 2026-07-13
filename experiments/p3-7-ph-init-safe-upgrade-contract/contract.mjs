import { createHash } from "node:crypto"

export const BASE = {
  corpusSha256: "dc52b9ffa4def89c0ffea510d8ef09a028b643552c07c1014c3d5e8984bed920",
  lockSha256: "6c0e411eec338a620376145e40bc441baaba7b4899a4b6f8c88ac0cc6b279fb3",
  registrySha256: "a1d03979d86d420a43c8a03b2647fe340e99ccbced1cccfda9082fa064fe8058",
  schemaVersion: "p3-7-ph-init-safe-upgrade.1",
  lockFile: "canonical-lock.json",
  recordIds: [
    "p3-7-r01-ownership-marker",
    "p3-7-r02-idempotent-owned-rerun",
    "p3-7-r03-safe-owned-upgrade",
    "p3-7-r04-modified-config-conflict",
    "p3-7-r05-modified-rules-conflict",
    "p3-7-r06-modified-agents-conflict",
    "p3-7-r07-foreign-file-preservation",
    "p3-7-r08-rollback-write-failure",
    "p3-7-r09-symlink-escape",
    "p3-7-r10-partial-initialization",
    "p3-7-r11-concurrent-race",
    "p3-7-r12-deterministic-dry-run",
    "p3-7-r13-binding-mismatch",
    "p3-7-r14-missing-ownership-marker",
  ],
}

export const SUCCESSOR = {
  ...BASE,
  corpusSha256: "c25b76585526c9c9c976945a3fb20e45c29c62eec4aaec6b194c5f8f903b318d",
  lockSha256: "dd3e81a282045429407848be9e52fbd1ebdb3c32841db6e3ab945b0746996d66",
  schemaVersion: "p3-7-ph-init-safe-upgrade.2",
  lockFile: "canonical-lock.v2.json",
  recordIds: [...BASE.recordIds, "p3-7-r15-new-profile-binding"],
}

export const BINDING = {
  packageName: "persona-harness",
  packageSourceCommit: "37bc06726970f170edac3a887447ae1182302be7",
  profileId: "p3-7-synthetic-profile-java-spring",
  profileFingerprint: "profile-fingerprint-p3-7-java-spring-v1",
  projectId: "p3-7-synthetic-project-alpha",
  projectFingerprint: "project-fingerprint-p3-7-alpha-v1",
}

export const BOUNDARY = {
  reportOnly: true,
  sourceOnly: true,
  enforcement: false,
  fixtureDataAuthority: "none",
  productMitigationClaim: false,
  productBehaviorChange: false,
  packageDistribution: false,
  actualPhInit: false,
  realProjectAccess: false,
  childProcess: false,
  networkAccess: false,
  p2Work: false,
  mutationPolicy: "append-only-new-schema-new-result",
}

export function validateCorpus(corpus, expected, successor, errors) {
  expect(errors, corpus.schemaVersion, expected.schemaVersion, "SCHEMA_VERSION", "schemaVersion")
  expect(errors, corpus.corpusId, "p3-7-ph-init-safe-upgrade", "CORPUS_ID", "corpusId")
  expect(errors, corpus.canonicalBase?.commit, "37bc06726970f170edac3a887447ae1182302be7", "BASE_COMMIT", "canonicalBase.commit")
  expect(errors, corpus.canonicalBase?.parent, "c03b81db09e31d36f1873459891886ae13771409", "BASE_PARENT", "canonicalBase.parent")
  expect(errors, corpus.binding, BINDING, "BINDING", "binding")
  expect(errors, corpus.boundary, BOUNDARY, "BOUNDARY", "boundary")
  expect(errors, corpus.dependencies, { configRecoveryAndPathSafety: "P3-6-owned", reimplementationHere: false }, "DEPENDENCY", "dependencies")
  expect(errors, JSON.stringify(corpus.records?.map((record) => record?.id)), JSON.stringify(expected.recordIds), "RECORD_ORDER", "records")
  if (!successor && corpus.canonicalLock !== "canonical-lock.json") addError(errors, "LOCK_PATH", "canonicalLock", "base lock path is wrong")
  if (successor && corpus.canonicalLock !== "canonical-lock.v2.json") addError(errors, "LOCK_PATH", "canonicalLock", "successor lock path is wrong")
}

export function validateRegistry(registry, corpus, errors) {
  expect(errors, registry.schemaVersion, "p3-7-ph-init-fixture-registry.1", "REGISTRY_SCHEMA", "registry.schemaVersion")
  expect(errors, registry.binding, corpus?.binding, "REGISTRY_BINDING", "registry.binding")
  if (!Array.isArray(registry.fixtures)) {
    addError(errors, "FIXTURES_INVALID", "fixtures", "fixtures must be an array")
    return
  }
  for (const fixture of registry.fixtures) validateFixture(fixture, errors)
}

export function validateFixture(fixture, errors, externalBinding) {
  if (!isRecord(fixture)) {
    addError(errors, "FIXTURE_INVALID", "fixtures", "fixture must be an object")
    return
  }
  if (fixture.bindingRef !== "registry" && !isRecord(fixture.binding) && !isRecord(externalBinding)) {
    addError(errors, "FIXTURE_BINDING", String(fixture.id), "fixture binding must reference registry")
  }
  const entries = Array.isArray(fixture.state?.entries) ? fixture.state.entries : []
  if (!Array.isArray(fixture.state?.entries)) addError(errors, "STATE_ENTRIES", String(fixture.id), "state entries must be an array")
  for (const entry of entries) validateEntry(entry, String(fixture.id), errors)
  const operation = fixture.operation
  const oracle = fixture.oracle
  if (!isRecord(operation) || !isRecord(oracle)) {
    addError(errors, "FIXTURE_SHAPE", String(fixture.id), "operation and oracle are required")
    return
  }
  expect(errors, oracle.noDataLoss, true, "NO_DATA_LOSS", `${fixture.id}.oracle.noDataLoss`)
  expect(errors, oracle.overwriteForeignFiles, false, "FOREIGN_OVERWRITE", `${fixture.id}.oracle.overwriteForeignFiles`)
  expect(errors, oracle.noFollow, true, "NO_FOLLOW", `${fixture.id}.oracle.noFollow`)
  expect(errors, oracle.deterministic, true, "DETERMINISTIC", `${fixture.id}.oracle.deterministic`)
  expect(errors, oracle.productBehaviorChange, false, "PRODUCT_CHANGE", `${fixture.id}.oracle.productBehaviorChange`)
  const writes = Array.isArray(oracle.writes) ? oracle.writes : []
  if (!Array.isArray(oracle.writes)) addError(errors, "ORACLE_WRITES", `${fixture.id}.oracle.writes`, "writes must be an array")
  if (["fail-closed", "no-op", "dry-run"].includes(oracle.decision)) expect(errors, JSON.stringify(writes), "[]", "NO_WRITES", `${fixture.id}.oracle.writes`)
  for (const entry of entries) {
    if (!isRecord(entry)) continue
    if (entry.owner === "foreign" && writes.includes(entry.path)) addError(errors, "FOREIGN_OVERWRITE", `${fixture.id}.${entry.path}`, "foreign file cannot be written")
    if (entry.owner === "persona-harness" && entry.kind === "file") {
      const changed = entry.currentContent !== entry.ownedBaselineContent
      if ((entry.marker === null || changed) && entry.currentContent !== null) {
        expect(errors, oracle.decision, "fail-closed", "OWNERSHIP_CONFLICT", `${fixture.id}.${entry.path}`)
      }
    }
    if (entry.kind === "symlink" || entry.kind === "escape" || String(entry.path).startsWith("../")) {
      expect(errors, oracle.decision, "fail-closed", "PATH_CONFLICT", `${fixture.id}.${entry.path}`)
    }
  }
  const manifest = Array.isArray(fixture.operation.backup?.manifest) ? fixture.operation.backup.manifest : []
  expect(errors, JSON.stringify(operation.backupPaths), JSON.stringify(manifest.map((item) => item.path)), "BACKUP_PATHS", `${fixture.id}.operation.backupPaths`)
  if (operation.dryRun) expect(errors, oracle.decision, "dry-run", "DRY_RUN_DECISION", `${fixture.id}.oracle.decision`)
  if (operation.writeFailureAt !== null) {
    expect(errors, oracle.decision, "fail-closed", "WRITE_FAILURE_DECISION", `${fixture.id}.oracle.decision`)
    expect(errors, oracle.rollbackRequired, true, "ROLLBACK_REQUIRED", `${fixture.id}.oracle.rollbackRequired`)
    expect(errors, oracle.stateUnchanged, true, "ROLLBACK_STATE", `${fixture.id}.oracle.stateUnchanged`)
  }
  if (operation.race !== "none") expect(errors, oracle.decision, "fail-closed", "RACE_DECISION", `${fixture.id}.oracle.decision`)
  if (fixture.state?.partialMarker !== null) {
    expect(errors, oracle.decision, "fail-closed", "PARTIAL_DECISION", `${fixture.id}.oracle.decision`)
    expect(errors, operation.resolution, "explicit-nondestructive-recovery-required", "PARTIAL_RESOLUTION", `${fixture.id}.operation.resolution`)
  }
  if (fixture.bindingOverride) expect(errors, oracle.decision, "fail-closed", "BINDING_DECISION", `${fixture.id}.oracle.decision`)
  validateBackup(fixture, errors)
  expect(errors, fixture.state?.stateDigest, hashJson({ entries, partialMarker: fixture.state?.partialMarker }), "STATE_DIGEST", `${fixture.id}.state.stateDigest`)
  expect(errors, fixture.oracle.resultDigest, hashJson(resultProjection(oracle)), "RESULT_DIGEST", `${fixture.id}.oracle.resultDigest`)
  const withoutFingerprint = { ...fixture }
  delete withoutFingerprint.fingerprint
  expect(errors, fixture.fingerprint, hashJson(withoutFingerprint), "FIXTURE_FINGERPRINT", `${fixture.id}.fingerprint`)
}

function validateEntry(entry, fixtureId, errors) {
  if (!isRecord(entry)) {
    addError(errors, "ENTRY_INVALID", fixtureId, "entry must be an object")
    return
  }
  if (typeof entry.path !== "string" || entry.path.length === 0) addError(errors, "ENTRY_PATH", fixtureId, "entry path is required")
  if (entry.kind === "file" && typeof entry.currentContent !== "string" && entry.currentContent !== null) addError(errors, "ENTRY_CONTENT", fixtureId, "file content must be string or null")
  if (entry.kind === "symlink" && typeof entry.linkTarget !== "string") addError(errors, "SYMLINK_TARGET", fixtureId, "symlink target is required")
}

function validateBackup(fixture, errors) {
  const backup = fixture.operation?.backup
  if (!isRecord(backup) || !Array.isArray(backup.manifest)) {
    addError(errors, "BACKUP_MANIFEST", String(fixture.id), "backup manifest is required")
    return
  }
  if (typeof backup.location !== "string" || !backup.location.startsWith("synthetic://")) addError(errors, "BACKUP_LOCATION", String(fixture.id), "backup location must be synthetic")
  const entries = Array.isArray(fixture.state?.entries) ? fixture.state.entries : []
  for (const item of backup.manifest) {
    const entry = entries.find((candidate) => candidate?.path === item?.path)
    const expectedDigest = typeof entry?.currentContent === "string" ? sha256Text(entry.currentContent) : null
    expect(errors, item?.digest, expectedDigest, "BACKUP_DIGEST", `${fixture.id}.backup.${String(item?.path)}`)
  }
  expect(errors, backup.manifestDigest, hashJson(backup.manifest), "BACKUP_MANIFEST_DIGEST", `${fixture.id}.backup.manifestDigest`)
}

export function validateLock(lock, expected, corpusSha256, registrySha256, registry, corpus, errors) {
  expect(errors, lock.schemaVersion, expected === BASE ? "p3-7-ph-init-lock.1" : "p3-7-ph-init-lock.2", "LOCK_SCHEMA", "lock.schemaVersion")
  expect(errors, lock.corpusSchemaVersion, expected.schemaVersion, "LOCK_CORPUS_SCHEMA", "lock.corpusSchemaVersion")
  expect(errors, lock.corpusSha256, corpusSha256, "LOCK_CORPUS_HASH", "lock.corpusSha256")
  expect(errors, lock.fixtureRegistrySha256, registrySha256, "LOCK_REGISTRY_HASH", "lock.fixtureRegistrySha256")
  expect(errors, JSON.stringify(lock.recordOrder), JSON.stringify(expected.recordIds), "LOCK_RECORD_ORDER", "lock.recordOrder")
  if (expected === BASE) {
    expect(errors, JSON.stringify(lock.boundary), JSON.stringify(BOUNDARY), "LOCK_BOUNDARY", "lock.boundary")
    expect(errors, JSON.stringify(lock.dependencies), JSON.stringify(corpus?.dependencies), "LOCK_DEPENDENCY", "lock.dependencies")
    const fingerprints = registry?.fixtures?.map((fixture) => ({ id: fixture.id, sha256: fixture.fingerprint }))
    expect(errors, JSON.stringify(lock.fixtureFingerprints), JSON.stringify(fingerprints), "LOCK_FIXTURES", "lock.fixtureFingerprints")
  } else {
    expect(errors, lock.baseCorpusSha256, BASE.corpusSha256, "BASE_CORPUS_BINDING", "lock.baseCorpusSha256")
    expect(errors, lock.baseLockSha256, BASE.lockSha256, "BASE_LOCK_BINDING", "lock.baseLockSha256")
    expect(errors, JSON.stringify(lock.baseRecordOrder), JSON.stringify(BASE.recordIds), "BASE_RECORD_ORDER", "lock.baseRecordOrder")
    expect(errors, JSON.stringify(lock.addedRecordIds), JSON.stringify(["p3-7-r15-new-profile-binding"]), "ADDED_RECORDS", "lock.addedRecordIds")
  }
}

export function mergeRecords(records, fixtures, errors) {
  const fixtureById = new Map(fixtures.map((fixture) => [fixture?.id, fixture]))
  return records.flatMap((record) => {
    const fixture = fixtureById.get(record?.fixtureId)
    if (!fixture) {
      addError(errors, "FIXTURE_MISSING", String(record?.id), "record fixture is missing")
      return []
    }
    expect(errors, record.expectedDecision, fixture.oracle?.decision, "ORACLE_DECISION", String(record.id))
    return [{ ...record, oracle: fixture.oracle }]
  })
}

export function addError(errors, code, path, message) {
  errors.push({ code, path, message })
}

export function expect(errors, actual, expected, code, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) addError(errors, code, label, "value does not match the frozen contract")
}

export function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function hashJson(value) {
  return sha256Text(JSON.stringify(stable(value)))
}

export function sha256Text(value) {
  return createHash("sha256").update(value).digest("hex")
}

function resultProjection(oracle) {
  return {
    conflicts: oracle.conflicts,
    decision: oracle.decision,
    preservedPaths: oracle.preservedPaths,
    rollbackRequired: oracle.rollbackRequired,
    stateUnchanged: oracle.stateUnchanged,
    writes: oracle.writes,
  }
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable)
  if (isRecord(value)) return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
  return value
}
