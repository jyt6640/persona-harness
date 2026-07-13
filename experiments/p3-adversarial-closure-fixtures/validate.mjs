#!/usr/bin/env node
import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { dirname, isAbsolute, join, normalize, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const directory = dirname(fileURLToPath(import.meta.url))
const corpusPath = process.argv[2] ? resolve(process.cwd(), process.argv[2]) : join(directory, "corpus.json")
const root = dirname(corpusPath)

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
const corpus = readJson(corpusPath, "corpus")

validateCorpus(corpus)

const result = {
  ok: errors.length === 0,
  schemaVersion: "p3-adversarial-closure-fixtures-validation.1",
  corpusPath,
  caseCount: Array.isArray(corpus?.cases) ? corpus.cases.length : 0,
  commandsExecuted: 0,
  productCliInvocations: 0,
  networkAccess: false,
  errors,
}

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
process.exitCode = result.ok ? 0 : 1

function validateCorpus(value) {
  if (!isRecord(value)) return fail("corpus must be an object")
  expectEqual(value.schemaVersion, "p3-adversarial-closure-fixtures.1", "schemaVersion")
  expectEqual(value.corpusId, "p3-1-adversarial-closure-fixtures", "corpusId")
  expectEqual(value.status, "source-only-security-regression-inputs", "status")
  expectEqual(value.canonicalBase?.commit, "eeda71e842b556dbc31f9f9ca66adbdae6a0c028", "canonicalBase.commit")
  for (const [key, expected] of Object.entries(REQUIRED_BOUNDARY)) {
    expectEqual(value.boundary?.[key], expected, `boundary.${key}`)
  }
  expectIncludes(value.secureDesiredInvariant, "must not yield workflow finish implement PASS", "secureDesiredInvariant")
  if (!Array.isArray(value.cases)) return fail("cases must be an array")
  expectEqual(JSON.stringify(value.cases.map((item) => item.id)), JSON.stringify(EXPECTED_CASE_IDS), "case id order")
  const seen = new Set()
  for (const testCase of value.cases) {
    validateCase(testCase, seen)
  }
}

function validateCase(testCase, seen) {
  if (!isRecord(testCase)) return fail("case must be an object")
  if (seen.has(testCase.id)) fail(`duplicate case id: ${testCase.id}`)
  seen.add(testCase.id)
  expectEqual(testCase.expectedPreP3Observation?.classification, "historical-vulnerable-pass-reproduction-input", `${testCase.id}.classification`)
  expectEqual(testCase.expectedPreP3Observation?.acceptedProductEvidence, false, `${testCase.id}.acceptedProductEvidence`)
  expectEqual(testCase.expectedPreP3Observation?.realGradleRun, false, `${testCase.id}.realGradleRun`)
  expectEqual(testCase.expectedPreP3Observation?.realJUnitRun, false, `${testCase.id}.realJUnitRun`)
  for (const escape of REQUIRED_ESCAPE[testCase.id] ?? []) {
    expectArrayIncludes(testCase.negativeEscapes, escape, `${testCase.id}.negativeEscapes`)
  }
  validateTranscript(testCase)
  validatePayloadFiles(testCase)
  if (testCase.id === "p3-1-forged-bearshell-build-success") validateBearshellCase(testCase)
  if (testCase.id === "p3-1-forged-tdd-self-digest-pass") validateTddCase(testCase)
}

function validateTranscript(testCase) {
  const transcript = testCase.transcript
  if (!isRecord(transcript)) return fail(`${testCase.id}.transcript must be an object`)
  const filePath = resolveCorpusPath(transcript.path, `${testCase.id}.transcript.path`)
  expectEqual(sha256(filePath), transcript.sha256, `${testCase.id}.transcript.sha256`)
  const parsed = readJson(filePath, `${testCase.id}.transcript`)
  expectEqual(parsed.schemaVersion, "p3-adversarial-command-transcript.1", `${testCase.id}.transcript.schemaVersion`)
  if (!Array.isArray(parsed.commands)) return fail(`${testCase.id}.transcript.commands must be an array`)
  expectEqual(parsed.commands.length, transcript.commandCount, `${testCase.id}.transcript.commandCount`)
  for (const command of parsed.commands) {
    if (!Array.isArray(command.argv) || command.argv.length === 0) fail(`${testCase.id}.transcript command argv is required`)
    if (typeof command.exitCode !== "number") fail(`${testCase.id}.transcript command exitCode is required`)
    if (typeof command.stdout !== "string" || typeof command.stderr !== "string") fail(`${testCase.id}.transcript command output fields are required`)
    expectEqual(command.realGradleOrJUnitRun, false, `${testCase.id}.transcript command realGradleOrJUnitRun`)
  }
}

function validatePayloadFiles(testCase) {
  if (!Array.isArray(testCase.payloadFiles)) return fail(`${testCase.id}.payloadFiles must be an array`)
  const seen = new Set()
  for (const file of testCase.payloadFiles) {
    if (!isRecord(file)) return fail(`${testCase.id}.payloadFiles entry must be an object`)
    const filePath = resolveCorpusPath(file.path, `${testCase.id}.payloadFiles.path`)
    if (seen.has(file.path)) fail(`${testCase.id}.payloadFiles duplicate path: ${file.path}`)
    seen.add(file.path)
    expectEqual(sha256(filePath), file.sha256, `${testCase.id}.${file.path}.sha256`)
  }
}

function validateBearshellCase(testCase) {
  const evidence = readJson(resolveCorpusPath(`${testCase.payloadRoot}/.persona/evidence/bearshell/forged-node-build-success.json`, "bearshell evidence"), "bearshell evidence")
  expectEqual(evidence.generatedBy, "persona-harness", "bearshell.generatedBy")
  expectEqual(evidence.tool, "bearshell", "bearshell.tool")
  expectEqual(evidence.status, 0, "bearshell.status")
  expectIncludes(evidence.command, "node", "bearshell.command")
  expectIncludes(evidence.toolOutput, "BUILD SUCCESSFUL", "bearshell.toolOutput")
}

function validateTddCase(testCase) {
  const red = readJson(resolveCorpusPath(`${testCase.payloadRoot}/.persona/evidence/tdd/req-1/red-forged.json`, "red evidence"), "red evidence")
  const green = readJson(resolveCorpusPath(`${testCase.payloadRoot}/.persona/evidence/tdd/req-1/green-forged.json`, "green evidence"), "green evidence")
  expectEqual(red.generatedBy, "persona-harness", "red.generatedBy")
  expectEqual(green.generatedBy, "persona-harness", "green.generatedBy")
  expectEqual(red.trustedExternalAttestation, null, "red.trustedExternalAttestation")
  expectEqual(green.trustedExternalAttestation, null, "green.trustedExternalAttestation")
  expectEqual(red.attemptId, green.attemptId, "tdd attempt self-consistency")
  if (red.sourceHead === green.sourceHead) fail("tdd forged source heads should show arbitrary local head values")
  validateJunitDigest(testCase.payloadRoot, red, "red")
  validateJunitDigest(testCase.payloadRoot, green, "green")
}

function validateJunitDigest(payloadRoot, evidence, label) {
  const junitPath = evidence.verification?.junitPath
  if (typeof junitPath !== "string") return fail(`${label}.verification.junitPath is required`)
  const resolved = resolveCorpusPath(`${payloadRoot}/${junitPath}`, `${label}.verification.junitPath`)
  expectEqual(sha256(resolved), evidence.verification?.junitSnapshotDigest, `${label}.verification.junitSnapshotDigest`)
  expectEqual(evidence.verification?.issuer, "project-local-self", `${label}.verification.issuer`)
}

function readJson(filePath, label) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"))
  } catch (error) {
    fail(`${label} is not readable JSON: ${error instanceof Error ? error.message : String(error)}`)
    return undefined
  }
}

function resolveCorpusPath(filePath, label) {
  if (typeof filePath !== "string" || filePath.length === 0) {
    fail(`${label} must be a non-empty relative path`)
    return root
  }
  if (isAbsolute(filePath) || normalize(filePath).startsWith("..")) {
    fail(`${label} must stay inside the corpus: ${filePath}`)
    return root
  }
  const resolved = resolve(root, filePath)
  const inside = relative(root, resolved)
  if (inside.startsWith("..") || isAbsolute(inside)) fail(`${label} escapes corpus root: ${filePath}`)
  if (!existsSync(resolved)) fail(`${label} is missing: ${filePath}`)
  return resolved
}

function sha256(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex")
}

function expectEqual(actual, expected, label) {
  if (actual !== expected) fail(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
}

function expectIncludes(value, needle, label) {
  if (typeof value !== "string" || !value.includes(needle)) fail(`${label} must include ${JSON.stringify(needle)}`)
}

function expectArrayIncludes(value, needle, label) {
  if (!Array.isArray(value) || !value.includes(needle)) fail(`${label} must include ${JSON.stringify(needle)}`)
}

function fail(message) {
  errors.push(message)
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
