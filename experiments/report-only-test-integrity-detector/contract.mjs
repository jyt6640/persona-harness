import { createHash } from "node:crypto"
import { lstatSync, readFileSync } from "node:fs"
import { isAbsolute, normalize, relative, resolve } from "node:path"

export const CASE_IDS = [
  "test-integrity-empty-junit-positive-001",
  "test-integrity-asserting-junit-negative-001",
  "test-integrity-disabled-without-reason-positive-001",
  "test-integrity-disabled-with-reason-negative-001",
]

export const RULE_IDS = ["TEST-EMPTY-JUNIT", "TEST-DISABLED-REASON"]

export function validateCorpus({ corpus, lock, rootDir, expectedLockSha256, actualLockSha256 }) {
  const errors = []
  if (!isRecord(corpus)) add(errors, "CORPUS_INVALID", "corpus", "corpus must be an object")
  if (!isRecord(lock)) add(errors, "LOCK_INVALID", "canonical-lock.json", "canonical lock must be an object")
  if (actualLockSha256 !== expectedLockSha256) add(errors, "CANONICAL_LOCK_HASH", "canonical-lock.json", "canonical lock bytes drifted")
  if (!isRecord(corpus) || !isRecord(lock)) return { errors, projection: undefined }

  expect(errors, corpus.schemaVersion, "report-only-test-integrity-corpus.1", "SCHEMA_VERSION", "schemaVersion")
  expect(errors, corpus.corpusId, "report-only-test-integrity", "CORPUS_ID", "corpusId")
  expect(errors, corpus.status, "source-only-research-input", "CORPUS_STATUS", "status")
  expect(errors, corpus.payloadRoot, "fixtures", "PAYLOAD_ROOT_INVALID", "payloadRoot")
  expect(errors, corpus.canonicalLock, "canonical-lock.json", "LOCK_PATH_INVALID", "canonicalLock")
  expect(errors, corpus.canonicalLockSha256, actualLockSha256, "LOCK_REFERENCE", "canonicalLockSha256")
  expect(errors, lock.schemaVersion, "report-only-test-integrity-lock.1", "LOCK_SCHEMA", "canonical-lock.json.schemaVersion")
  expect(errors, lock.corpusSchemaVersion, corpus.schemaVersion, "LOCK_CORPUS_SCHEMA", "canonical-lock.json.corpusSchemaVersion")
  expect(errors, lock.corpusId, corpus.corpusId, "LOCK_CORPUS_ID", "canonical-lock.json.corpusId")
  expectBoundary(errors, corpus.boundary)
  expectMutationPolicy(errors, corpus.mutationPolicy)

  const payloadRoot = resolvePath(rootDir, corpus.payloadRoot, errors, "payloadRoot")
  if (payloadRoot !== undefined) {
    try {
      const stat = lstatSync(payloadRoot)
      if (!stat.isDirectory() || stat.isSymbolicLink()) add(errors, "PAYLOAD_ROOT_INVALID", "payloadRoot", "payload root must be a real directory")
    } catch {
      add(errors, "PAYLOAD_ROOT_MISSING", "payloadRoot", "payload root is missing")
    }
  }

  const records = Array.isArray(corpus.records) ? corpus.records : []
  if (!Array.isArray(corpus.records)) add(errors, "RECORDS_INVALID", "records", "records must be an array")
  expect(errors, JSON.stringify(records.map((item) => isRecord(item) ? item.id : undefined)), JSON.stringify(CASE_IDS), "CANONICAL_SEMANTICS_MISMATCH", "records")
  const recordIds = new Set()
  for (const [index, item] of records.entries()) validateRecord(item, index, recordIds, errors)

  const payloadFiles = Array.isArray(corpus.payloadFiles) ? corpus.payloadFiles : []
  if (!Array.isArray(corpus.payloadFiles)) add(errors, "PAYLOAD_FILES_INVALID", "payloadFiles", "payloadFiles must be an array")
  const payloadPaths = new Set()
  for (const [index, item] of payloadFiles.entries()) {
    if (!isRecord(item)) {
      add(errors, "PAYLOAD_ENTRY_INVALID", `payloadFiles[${index}]`, "payload file must be an object")
      continue
    }
    if (typeof item.path !== "string" || payloadPaths.has(item.path)) add(errors, "PAYLOAD_DUPLICATE", `payloadFiles[${index}]`, "payload path must be unique")
    payloadPaths.add(item.path)
    const path = resolvePath(rootDir, item.path, errors, `payloadFiles[${index}].path`)
    const actual = path === undefined ? undefined : hashFile(path, rootDir, errors, `payloadFiles[${index}].path`)
    expect(errors, actual, item.sha256, "PAYLOAD_HASH", `payloadFiles[${index}].sha256`)
  }

  const transcript = isRecord(corpus.transcript) ? corpus.transcript : undefined
  if (transcript === undefined) add(errors, "TRANSCRIPT_INVALID", "transcript", "transcript must be an object")
  const transcriptPath = transcript === undefined ? undefined : resolvePath(rootDir, transcript.path, errors, "transcript.path")
  const transcriptSource = transcriptPath === undefined ? undefined : readText(transcriptPath, rootDir, errors, "transcript.path")
  if (transcript !== undefined) {
    expect(errors, transcriptSource === undefined ? undefined : sha256(transcriptSource), transcript.sha256, "TRANSCRIPT_HASH", "transcript.sha256")
    const transcriptValue = transcriptSource === undefined ? undefined : parseJson(transcriptSource, errors, "TRANSCRIPT_JSON", "transcript")
    validateTranscript(transcriptValue, transcript, errors)
  }

  const projection = buildCanonicalProjection(corpus, rootDir, errors)
  if (isRecord(lock.semantics)) {
    expect(errors, stableJson(projection), stableJson(lock.semantics), "CANONICAL_SEMANTICS_MISMATCH", "canonical-lock.json.semantics")
  } else {
    add(errors, "LOCK_SEMANTICS_INVALID", "canonical-lock.json.semantics", "lock semantics must be an object")
  }
  return { errors, projection }
}

export function buildCanonicalProjection(corpus, rootDir, errors = []) {
  const records = Array.isArray(corpus.records) ? corpus.records : []
  const payloadFiles = Array.isArray(corpus.payloadFiles) ? corpus.payloadFiles : []
  const transcript = isRecord(corpus.transcript) ? corpus.transcript : {}
  const transcriptPath = resolvePath(rootDir, transcript.path, errors, "transcript.path")
  const transcriptValue = transcriptPath === undefined ? undefined : parseJson(readText(transcriptPath, rootDir, errors, "transcript.path"), errors, "TRANSCRIPT_JSON", "transcript")
  return {
    corpusId: corpus.corpusId,
    status: corpus.status,
    purpose: corpus.purpose,
    payloadRoot: corpus.payloadRoot,
    boundary: corpus.boundary,
    signals: corpus.signals,
    evaluationContract: corpus.evaluationContract,
    records: records.map((record) => isRecord(record) ? record : null),
    payloadFiles: payloadFiles.map((file) => {
      if (!isRecord(file)) return null
      const path = resolvePath(rootDir, file.path, errors, "payload.path")
      return { path: file.path, sha256: path === undefined ? null : hashFile(path, rootDir, errors, "payload.path") }
    }),
    transcript: {
      path: transcript.path,
      commandCount: transcript.commandCount,
      commands: isRecord(transcriptValue) && Array.isArray(transcriptValue.commands) ? transcriptValue.commands : [],
    },
    mutationPolicy: corpus.mutationPolicy,
  }
}

export function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  if (isRecord(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`
  return JSON.stringify(value)
}

export function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`
}

function validateRecord(value, index, ids, errors) {
  if (!isRecord(value)) {
    add(errors, "RECORD_INVALID", `records[${index}]`, "record must be an object")
    return
  }
  if (typeof value.id !== "string" || ids.has(value.id)) add(errors, "RECORD_DUPLICATE", `records[${index}].id`, "record ID must be unique")
  ids.add(value.id)
  for (const field of ["title", "ruleId", "category", "fixture", "anchor", "auditEvidence", "threatCapability", "desiredInvariant", "futureOwningUnit", "futureAcceptanceBoundary"]) {
    if (typeof value[field] !== "string" || value[field].length === 0) add(errors, "RECORD_FIELD", `records[${index}].${field}`, "record field must be a non-empty string")
  }
  if (typeof value.expectedWarning !== "boolean") add(errors, "RECORD_LABEL", `records[${index}].expectedWarning`, "expectedWarning must be boolean")
  if (!Array.isArray(value.attackPreconditions) || !Array.isArray(value.negativeEscapes)) add(errors, "RECORD_METADATA", `records[${index}]`, "metadata arrays are required")
}

function validateTranscript(value, expected, errors) {
  if (!isRecord(value) || value.schemaVersion !== "report-only-test-integrity-transcript.1" || !Array.isArray(value.commands)) {
    add(errors, "TRANSCRIPT_SHAPE", "transcript", "transcript schema or commands are invalid")
    return
  }
  expect(errors, value.commands.length, expected.commandCount, "TRANSCRIPT_COUNT", "transcript.commandCount")
  for (const [index, command] of value.commands.entries()) {
    if (!isRecord(command)) {
      add(errors, "TRANSCRIPT_COMMAND", `transcript.commands[${index}]`, "command must be an object")
      continue
    }
    for (const field of ["id", "stdout", "stderr"]) if (typeof command[field] !== "string") add(errors, "TRANSCRIPT_COMMAND", `transcript.commands[${index}].${field}`, "command text field is invalid")
    if (!Array.isArray(command.argv) || command.argv.length === 0) add(errors, "TRANSCRIPT_ARGV", `transcript.commands[${index}].argv`, "argv is required")
    if (command.exitCode !== 0 || command.commandsExecuted !== false || command.productCliInvocation !== false || command.networkAccess !== false || command.realProjectAccess !== false) {
      add(errors, "TRANSCRIPT_BOUNDARY", `transcript.commands[${index}]`, "transcript must remain non-executing synthetic evidence")
    }
  }
}

function resolvePath(rootDir, value, errors, path) {
  if (typeof value !== "string" || value.length === 0 || value.includes("\0") || isAbsolute(value) || normalize(value).startsWith("..")) {
    add(errors, "PATH_INVALID", path, "path must be relative and inside the corpus")
    return undefined
  }
  const resolved = resolve(rootDir, value)
  const inside = relative(rootDir, resolved)
  if (inside === ".." || inside.startsWith("../") || isAbsolute(inside)) {
    add(errors, "PATH_ESCAPE", path, "path escapes the corpus")
    return undefined
  }
  let current = rootDir
  for (const segment of value.split("/")) {
    current = resolve(current, segment)
    try {
      if (lstatSync(current).isSymbolicLink()) add(errors, "PATH_SYMLINK", path, "symlinks are not followed")
    } catch {
      add(errors, "PATH_MISSING", path, "referenced corpus path is missing")
      return undefined
    }
  }
  return resolved
}

function hashFile(path, rootDir, errors, label) {
  const source = readText(path, rootDir, errors, label)
  return source === undefined ? undefined : sha256(source)
}

function readText(path, rootDir, errors, label) {
  const inside = relative(rootDir, path)
  if (inside === ".." || inside.startsWith("../") || isAbsolute(inside)) {
    add(errors, "PATH_ESCAPE", label, "path escapes the corpus")
    return undefined
  }
  try {
    const stat = lstatSync(path)
    if (!stat.isFile() || stat.isSymbolicLink()) {
      add(errors, "PATH_SYMLINK", label, "path is not a regular non-symlink file")
      return undefined
    }
    return readFileSync(path, "utf8")
  } catch {
    add(errors, "PATH_MISSING", label, "referenced corpus file is unavailable")
    return undefined
  }
}

function parseJson(source, errors, code, path) {
  if (source === undefined) return undefined
  try {
    return JSON.parse(source)
  } catch {
    add(errors, code, path, "JSON is malformed")
    return undefined
  }
}

function expect(errors, actual, expected, code, path) {
  if (stableJson(actual) !== stableJson(expected)) add(errors, code, path, "value does not match the canonical contract")
}

function expectBoundary(errors, boundary) {
  const expected = {
    authorityEligible: false,
    commandsExecuted: 0,
    enforcement: false,
    networkAccess: false,
    packageDistribution: false,
    productCliInvocations: 0,
    realProjectAccess: false,
    reportOnly: true,
  }
  for (const [key, value] of Object.entries(expected)) expect(errors, boundary?.[key], value, "BOUNDARY_VALUE", `boundary.${key}`)
}

function expectMutationPolicy(errors, policy) {
  expect(errors, policy?.noRelabelAfterEvaluation, true, "MUTATION_POLICY", "mutationPolicy.noRelabelAfterEvaluation")
  expect(errors, policy?.noReplayOrDuplicateRows, true, "MUTATION_POLICY", "mutationPolicy.noReplayOrDuplicateRows")
  expect(errors, policy?.newCaseRequires, ["new stable record ID", "append-only corpus record", "new canonical lock version", "separate result artifact"], "MUTATION_POLICY", "mutationPolicy.newCaseRequires")
}

function add(errors, code, path, message) {
  errors.push({ code, path, message })
}

export function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
