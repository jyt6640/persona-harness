#!/usr/bin/env node
import { createHash } from "node:crypto"
import { existsSync, lstatSync, readFileSync } from "node:fs"
import { dirname, isAbsolute, join, normalize, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const directory = dirname(fileURLToPath(import.meta.url))
const corpusPath = process.argv[2] ? resolve(process.cwd(), process.argv[2]) : join(directory, "corpus.json")
const root = dirname(corpusPath)
const lockPath = join(root, "canonical-lock.json")

const CANONICAL_LOCK_SHA256 = "3681e0d9c8ad269d138007f176abf5d43e9067a25b932b11bb9f9ad5bdf953e2"
const EXPECTED_CASE_IDS = [
  "p3-1-forged-bearshell-build-success",
  "p3-1-forged-tdd-self-digest-pass",
]
const REQUIRED_BOUNDARY = {
  fixtureDataAuthority: "none",
  productMitigationClaim: false,
  productBehaviorChange: false,
  packageDistribution: false,
  p2Work: false,
  baselineReproductionDefault: false,
  mutationPolicy: "append-only-new-schema-new-result",
}
const REQUIRED_ESCAPE = {
  "p3-1-forged-bearshell-build-success": [
    "fabricated generatedBy marker",
    "arbitrary command and exit values",
    "missing explicit external attestation",
  ],
  "p3-1-forged-tdd-self-digest-pass": [
    "fabricated generatedBy marker",
    "digest self-consistency without independent issuer",
    "stale or different attempt ID",
    "arbitrary head and command values",
    "missing explicit external attestation",
  ],
}

const errors = []
const corpus = readJson(corpusPath, "CORPUS_JSON", "corpus.json")
const lock = readJson(lockPath, "CANONICAL_LOCK_JSON", "canonical-lock.json")

if (isRecord(corpus)) {
  validateCorpus(corpus, lock)
} else {
  addError("CORPUS_INVALID", "corpus.json", "corpus must be an object")
}

const result = {
  ok: errors.length === 0,
  schemaVersion: "p3-adversarial-closure-fixtures-validation.2",
  corpusPath,
  caseCount: Array.isArray(corpus?.cases) ? corpus.cases.length : 0,
  commandsExecuted: 0,
  productCliInvocations: 0,
  networkAccess: false,
  errors,
}

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
process.exitCode = result.ok ? 0 : 1

function validateCorpus(value, canonicalLock) {
  validateCanonicalLock(canonicalLock)
  expectValue(value.schemaVersion, "p3-adversarial-closure-fixtures.1", "SCHEMA_VERSION", "schemaVersion")
  expectValue(value.corpusId, "p3-1-adversarial-closure-fixtures", "CORPUS_ID", "corpusId")
  expectValue(value.status, "source-only-security-regression-inputs", "STATUS", "status")
  expectValue(
    value.canonicalBase?.commit,
    "eeda71e842b556dbc31f9f9ca66adbdae6a0c028",
    "BASE_COMMIT",
    "canonicalBase.commit",
  )
  for (const [key, expected] of Object.entries(REQUIRED_BOUNDARY)) {
    expectValue(value.boundary?.[key], expected, "BOUNDARY_VALUE", `boundary.${key}`)
  }
  expectIncludes(
    value.secureDesiredInvariant,
    "must not yield workflow finish implement PASS",
    "SECURE_INVARIANT",
    "secureDesiredInvariant",
  )
  if (!Array.isArray(value.cases)) {
    addError("CASES_INVALID", "cases", "cases must be an array")
    return
  }
  expectValue(JSON.stringify(value.cases.map((item) => item?.id)), JSON.stringify(EXPECTED_CASE_IDS), "CASE_ORDER", "cases")
  const seen = new Set()
  for (const testCase of value.cases) validateCase(testCase, seen)
  if (isRecord(canonicalLock)) {
    expectValue(
      buildCanonicalProjection(value),
      canonicalLock.semantics,
      "CANONICAL_SEMANTICS_MISMATCH",
      "canonical-lock.json.semantics",
    )
  }
}

function validateCanonicalLock(value) {
  const actualHash = hashFile(lockPath, "canonical-lock.json")
  expectValue(actualHash, CANONICAL_LOCK_SHA256, "CANONICAL_LOCK_HASH", "canonical-lock.json")
  if (!isRecord(value)) {
    addError("CANONICAL_LOCK_INVALID", "canonical-lock.json", "canonical lock must be an object")
    return
  }
  expectValue(value.schemaVersion, "p3-adversarial-fixture-lock.1", "CANONICAL_LOCK_SCHEMA", "canonical-lock.json.schemaVersion")
  expectValue(value.corpusSchemaVersion, "p3-adversarial-closure-fixtures.1", "CANONICAL_LOCK_CORPUS_SCHEMA", "canonical-lock.json.corpusSchemaVersion")
  expectValue(value.lockId, "p3-1-adversarial-closure-fixtures-lock", "CANONICAL_LOCK_ID", "canonical-lock.json.lockId")
  if (!isRecord(value.semantics)) addError("CANONICAL_LOCK_SEMANTICS", "canonical-lock.json.semantics", "semantics must be an object")
}

function validateCase(testCase, seen) {
  if (!isRecord(testCase)) {
    addError("CASE_INVALID", "cases", "case must be an object")
    return
  }
  const caseId = typeof testCase.id === "string" ? testCase.id : "unknown"
  if (seen.has(caseId)) addError("CASE_DUPLICATE", `cases.${caseId}`, "duplicate case ID")
  seen.add(caseId)
  expectValue(
    testCase.expectedPreP3Observation?.classification,
    "historical-vulnerable-pass-reproduction-input",
    "OBSERVATION_CLASS",
    `${caseId}.expectedPreP3Observation.classification`,
  )
  expectValue(testCase.expectedPreP3Observation?.acceptedProductEvidence, false, "AUTHORITY_FLAG", `${caseId}.acceptedProductEvidence`)
  expectValue(testCase.expectedPreP3Observation?.realGradleRun, false, "REAL_GRADLE_FLAG", `${caseId}.realGradleRun`)
  expectValue(testCase.expectedPreP3Observation?.realJUnitRun, false, "REAL_JUNIT_FLAG", `${caseId}.realJUnitRun`)
  for (const escape of REQUIRED_ESCAPE[caseId] ?? []) {
    expectArrayIncludes(testCase.negativeEscapes, escape, "NEGATIVE_ESCAPE", `${caseId}.negativeEscapes`)
  }
  validateTranscript(testCase, caseId)
  validatePayloadFiles(testCase, caseId)
  if (caseId === "p3-1-forged-bearshell-build-success") validateBearshellCase(testCase)
  if (caseId === "p3-1-forged-tdd-self-digest-pass") validateTddCase(testCase)
}

function validateTranscript(testCase, caseId) {
  const transcript = testCase.transcript
  if (!isRecord(transcript)) {
    addError("TRANSCRIPT_INVALID", `${caseId}.transcript`, "transcript must be an object")
    return
  }
  const filePath = resolveCorpusPath(transcript.path, "PATH_INVALID", `${caseId}.transcript.path`)
  const actualHash = filePath === undefined ? undefined : hashFile(filePath, `${caseId}.transcript.path`)
  expectValue(actualHash, transcript.sha256, "TRANSCRIPT_HASH", `${caseId}.transcript.sha256`)
  const parsed = filePath === undefined ? undefined : readJson(filePath, "TRANSCRIPT_JSON", `${caseId}.transcript`)
  if (!isRecord(parsed)) return
  expectValue(parsed.schemaVersion, "p3-adversarial-command-transcript.1", "TRANSCRIPT_SCHEMA", `${caseId}.transcript.schemaVersion`)
  if (!Array.isArray(parsed.commands)) {
    addError("TRANSCRIPT_COMMANDS", `${caseId}.transcript.commands`, "commands must be an array")
    return
  }
  expectValue(parsed.commands.length, transcript.commandCount, "TRANSCRIPT_COUNT", `${caseId}.transcript.commandCount`)
  for (const command of parsed.commands) {
    if (!isRecord(command)) {
      addError("COMMAND_INVALID", `${caseId}.transcript.commands`, "command must be an object")
      continue
    }
    if (!Array.isArray(command.argv) || command.argv.length === 0) addError("COMMAND_ARGV", `${caseId}.transcript.commands`, "argv is required")
    if (typeof command.exitCode !== "number") addError("COMMAND_EXIT", `${caseId}.transcript.commands`, "exitCode is required")
    if (typeof command.stdout !== "string" || typeof command.stderr !== "string") addError("COMMAND_OUTPUT", `${caseId}.transcript.commands`, "stdout and stderr are required")
    expectValue(command.realGradleOrJUnitRun, false, "COMMAND_REAL_RUN", `${caseId}.transcript.commands`)
  }
}

function validatePayloadFiles(testCase, caseId) {
  if (!Array.isArray(testCase.payloadFiles)) {
    addError("PAYLOAD_LIST", `${caseId}.payloadFiles`, "payloadFiles must be an array")
    return
  }
  const seen = new Set()
  for (const file of testCase.payloadFiles) {
    if (!isRecord(file)) {
      addError("PAYLOAD_ENTRY", `${caseId}.payloadFiles`, "payload entry must be an object")
      continue
    }
    if (seen.has(file.path)) addError("PAYLOAD_DUPLICATE", `${caseId}.payloadFiles`, `duplicate path: ${String(file.path)}`)
    seen.add(file.path)
    const filePath = resolveCorpusPath(file.path, "PATH_INVALID", `${caseId}.payloadFiles.path`)
    const actualHash = filePath === undefined ? undefined : hashFile(filePath, `${caseId}.payloadFiles.path`)
    expectValue(actualHash, file.sha256, "PAYLOAD_HASH", `${caseId}.${String(file.path)}.sha256`)
  }
}

function validateBearshellCase(testCase) {
  const filePath = resolvePayloadPath(testCase, ".persona/evidence/bearshell/forged-node-build-success.json", "bearshell evidence")
  const evidence = filePath === undefined ? undefined : readJson(filePath, "BEARSHELL_JSON", "bearshell evidence")
  if (!isRecord(evidence)) return
  expectValue(evidence.generatedBy, "persona-harness", "GENERATED_BY", "bearshell.generatedBy")
  expectValue(evidence.tool, "bearshell", "BEARSHELL_TOOL", "bearshell.tool")
  expectValue(evidence.status, 0, "BEARSHELL_STATUS", "bearshell.status")
  expectIncludes(evidence.command, "node", "BEARSHELL_COMMAND", "bearshell.command")
  expectIncludes(evidence.toolOutput, "BUILD SUCCESSFUL", "BEARSHELL_OUTPUT", "bearshell.toolOutput")
}

function validateTddCase(testCase) {
  const redPath = resolvePayloadPath(testCase, ".persona/evidence/tdd/req-1/red-forged.json", "red evidence")
  const greenPath = resolvePayloadPath(testCase, ".persona/evidence/tdd/req-1/green-forged.json", "green evidence")
  const red = redPath === undefined ? undefined : readJson(redPath, "TDD_JSON", "red evidence")
  const green = greenPath === undefined ? undefined : readJson(greenPath, "TDD_JSON", "green evidence")
  if (!isRecord(red) || !isRecord(green)) return
  expectValue(red.generatedBy, "persona-harness", "GENERATED_BY", "red.generatedBy")
  expectValue(green.generatedBy, "persona-harness", "GENERATED_BY", "green.generatedBy")
  expectValue(red.trustedExternalAttestation, null, "EXTERNAL_ATTESTATION", "red.trustedExternalAttestation")
  expectValue(green.trustedExternalAttestation, null, "EXTERNAL_ATTESTATION", "green.trustedExternalAttestation")
  expectValue(red.attemptId, green.attemptId, "ATTEMPT_SELF_CONSISTENCY", "tdd.attemptId")
  if (red.sourceHead === green.sourceHead) addError("ARBITRARY_HEAD", "tdd.sourceHead", "forged source heads should remain visibly arbitrary")
  validateJunitDigest(testCase, red, "red")
  validateJunitDigest(testCase, green, "green")
}

function validateJunitDigest(testCase, evidence, label) {
  const junitPath = evidence.verification?.junitPath
  if (typeof junitPath !== "string") {
    addError("JUNIT_PATH", `${label}.verification.junitPath`, "junitPath is required")
    return
  }
  const resolved = resolvePayloadPath(testCase, junitPath, `${label}.verification.junitPath`)
  const actualHash = resolved === undefined ? undefined : hashFile(resolved, `${label}.verification.junitPath`)
  expectValue(actualHash, evidence.verification?.junitSnapshotDigest, "JUNIT_DIGEST", `${label}.verification.junitSnapshotDigest`)
  expectValue(evidence.verification?.issuer, "project-local-self", "JUNIT_ISSUER", `${label}.verification.issuer`)
}

function buildCanonicalProjection(value) {
  const cases = Array.isArray(value.cases)
    ? value.cases.map((testCase) => {
        if (!isRecord(testCase)) return null
        const transcript = isRecord(testCase.transcript)
          ? {
              path: testCase.transcript.path,
              sha256: testCase.transcript.sha256,
              commandCount: testCase.transcript.commandCount,
              commands: readTranscriptCommands(testCase.transcript.path),
            }
          : null
        return {
          id: testCase.id,
          title: testCase.title,
          futureOwningUnit: testCase.futureOwningUnit,
          threatCapability: testCase.threatCapability,
          expectedPreP3Observation: testCase.expectedPreP3Observation,
          payloadRoot: testCase.payloadRoot,
          transcript,
          payloadFiles: testCase.payloadFiles,
          attackPreconditions: testCase.attackPreconditions,
          negativeEscapes: testCase.negativeEscapes,
        }
      })
    : value.cases
  return {
    corpusId: value.corpusId,
    status: value.status,
    canonicalBase: value.canonicalBase,
    boundary: value.boundary,
    auditEvidence: value.auditEvidence,
    secureDesiredInvariant: value.secureDesiredInvariant,
    futureAcceptanceBoundary: value.futureAcceptanceBoundary,
    cases,
  }
}

function readTranscriptCommands(filePath) {
  const resolved = resolveCorpusPath(filePath, "PATH_INVALID", "canonical transcript.path")
  const value = resolved === undefined ? undefined : readJson(resolved, "TRANSCRIPT_JSON", "canonical transcript")
  if (!isRecord(value) || !Array.isArray(value.commands)) return null
  return value.commands.map((command) => {
    if (!isRecord(command)) return null
    return {
      id: command.id,
      argv: command.argv,
      exitCode: command.exitCode,
      stdout: command.stdout,
      stderr: command.stderr,
    }
  })
}

function resolvePayloadPath(testCase, suffix, label) {
  if (!isRecord(testCase) || typeof testCase.payloadRoot !== "string") {
    addError("PAYLOAD_ROOT", label, "payloadRoot must be a string")
    return undefined
  }
  return resolveCorpusPath(join(testCase.payloadRoot, suffix), "PATH_INVALID", label)
}

function resolveCorpusPath(filePath, invalidCode, label) {
  if (typeof filePath !== "string" || filePath.length === 0) {
    addError(invalidCode, label, "path must be a non-empty relative path")
    return undefined
  }
  if (isAbsolute(filePath) || normalize(filePath).startsWith("..")) {
    addError(invalidCode, label, `path must stay inside corpus: ${filePath}`)
    return undefined
  }
  const resolved = resolve(root, filePath)
  const inside = relative(root, resolved)
  if (inside.startsWith("..") || isAbsolute(inside)) {
    addError(invalidCode, label, `path escapes corpus: ${filePath}`)
    return undefined
  }
  if (!existsSync(resolved)) {
    addError("PATH_MISSING", label, `path is missing: ${filePath}`)
    return undefined
  }
  try {
    const stats = lstatSync(resolved)
    if (stats.isSymbolicLink()) {
      addError("PATH_SYMLINK", label, `symlink is not accepted: ${filePath}`)
      return undefined
    }
    if (!stats.isFile()) {
      addError("PATH_NOT_FILE", label, `path is not a regular file: ${filePath}`)
      return undefined
    }
  } catch (error) {
    addError("PATH_READ", label, error instanceof Error ? error.message : String(error))
    return undefined
  }
  return resolved
}

function readJson(filePath, code, label) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"))
  } catch (error) {
    addError(code, label, error instanceof Error ? error.message : String(error))
    return undefined
  }
}

function hashFile(filePath, label) {
  try {
    return createHash("sha256").update(readFileSync(filePath)).digest("hex")
  } catch (error) {
    addError("FILE_READ", label, error instanceof Error ? error.message : String(error))
    return undefined
  }
}

function expectValue(actual, expected, code, path) {
  if (stableJson(actual) !== stableJson(expected)) {
    addError(code, path, `expected ${stableJson(expected)}, got ${stableJson(actual)}`)
  }
}

function expectIncludes(value, needle, code, path) {
  if (typeof value !== "string" || !value.includes(needle)) addError(code, path, `must include ${JSON.stringify(needle)}`)
}

function expectArrayIncludes(value, needle, code, path) {
  if (!Array.isArray(value) || !value.includes(needle)) addError(code, path, `must include ${JSON.stringify(needle)}`)
}

function addError(code, path, message) {
  errors.push({ code, path, message })
}

function stableJson(value) {
  if (value === undefined) return "undefined"
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
